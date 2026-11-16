// Talking to the claude CLI, read-only. Adapted from Tourist's agent.js.
import { exec, hc, readTextFile, writeTextFile, appHome, window } from "herdr";
import * as fs from "fs/promises";
import { TOOLS } from "./constants.js";

let jobs = 0; // numbers each call's temp files

const PS_ARGS = ["-NoLogo", "-NoProfile", "-Command"]; // -NoProfile: a user profile can take seconds to load
let psExe = null; // "pwsh" or "powershell.exe" once one has run

/** Runs a PowerShell script, preferring pwsh and falling back to Windows PowerShell. */
async function runPs(script) {
  for (const exe of psExe ? [psExe] : ["pwsh", "powershell.exe"]) {
    let r;
    try { r = await exec(exe, [...PS_ARGS, script]); } catch { continue; }
    psExe = exe;
    return r;
  }
  throw new Error("Tutor needs PowerShell (pwsh or powershell.exe).");
}

/** The shell that runs an agent job: [argv..., script]. */
async function shell() {
  if (window()?.platform !== "windows") return { argv: ["sh", "-c"], ps: false };
  if (!psExe) await runPs("exit 0");
  return { argv: [psExe, ...PS_ARGS], ps: true };
}

/** True when `claude` is on PATH in the shell jobs run in. */
export async function haveClaude() {
  // where.exe needs no shell start-up, so it does not fail when several copies look at once.
  if (window()?.platform === "windows") {
    const w = await exec("where.exe", ["claude"]).catch(() => null);
    if (w?.code === 0 && /claude/i.test(w.stdout)) return true;
  }
  const r = window()?.platform === "windows"
    ? await runPs("Get-Command claude -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }").catch(() => null)
    : await exec("sh", ["-c", "command -v claude"]).catch(() => null);
  return /claude/i.test(r?.stdout ?? "");
}

/**
 * One conversation with Claude in a folder. Each `ask` after the first resumes the same
 * session, so it keeps what it already read. Held in memory only.
 */
export class AgentSession {
  constructor(cwd) { this.cwd = cwd; this.id = null; this.job = null; }

  /** Stops the call in progress, if any. */
  async stop() {
    const job = this.job;
    this.job = null;
    if (job) await hc(["kill", job]).catch(() => {});
  }

  /**
   * exec stops anything over 30 s, so claude runs as a hidden herdr-core terminal that reads
   * the prompt from a file and writes its one JSON reply to another.
   */
  async ask(prompt) {
    const dir = `${appHome()}/data/tutor/chat`.replace(/\\/g, "/");
    await fs.mkdir(dir, { recursive: true });
    const id = `${Date.now()}-${++jobs}-${Math.random().toString(36).slice(2, 8)}`; // copies of the mod each count from 1
    const inFile = `${dir}/${id}.in.txt`, outFile = `${dir}/${id}.out.json`, errFile = `${dir}/${id}.err.txt`;
    await writeTextFile(inFile, prompt, null);
    const flags = ["-p", "--output-format", "json", ...(this.id ? ["--resume", this.id] : []), ...TOOLS];
    const { argv, ps } = await shell();
    const q = ps ? (s => `'${s.replace(/'/g, "''")}'`) : (s => `'${s.replace(/'/g, `'\\''`)}'`);
    const script = ps
      ? `$OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); Get-Content -Raw -Encoding utf8 -LiteralPath ${q(inFile)} | claude ${flags.map(q).join(" ")} 2> ${q(errFile)} | Set-Content -NoNewline -Encoding utf8 -LiteralPath ${q(outFile)}`
      : `claude ${flags.map(q).join(" ")} < ${q(inFile)} > ${q(outFile)} 2> ${q(errFile)}`;
    const started = await hc(["run", "--bg", "--no-parent", "--outlive-parent", "--cwd", this.cwd, "--json", "--", ...argv, script]);
    if (started.code !== 0) throw new Error(started.stderr || "Could not start claude.");
    const address = JSON.parse(started.stdout).address;
    this.job = address;
    let stopped = false;
    try {
      for (;;) {
        const w = await hc(["wait", address, "--timeout", "20", "--json"]);
        if (this.job !== address) { stopped = true; break; }
        if (w.code !== 0 || JSON.parse(w.stdout).ended) break;
      }
    } finally {
      if (this.job === address) this.job = null;
      await hc(["rm", address]).catch(() => {});
    }
    const text = ((await readTextFile(outFile).catch(() => null)) ?? "").replace(/^﻿/, "");
    const err = (await readTextFile(errFile).catch(() => null)) ?? "";
    for (const f of [inFile, outFile, errFile]) await fs.unlink(f).catch(() => {});
    if (stopped) throw new Error("Stopped.");
    let out;
    try { out = JSON.parse(text); }
    catch { throw new Error((err || text || "Claude returned nothing.").trim().slice(-600)); }
    if (out.session_id) this.id = out.session_id;
    if (out.is_error) throw new Error(String(out.result || "Claude reported an error."));
    return String(out.result ?? "");
  }
}
