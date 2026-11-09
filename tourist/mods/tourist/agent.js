// Finding the installed agent CLIs and talking to one of them.
import { exec, hc, readTextFile, writeTextFile, appHome, window } from "herdr";
import * as fs from "fs/promises";
import { AGENTS, TOOLS, FIX_TOOLS } from "./constants.js";

let jobs = 0; // numbers each call's temp files

export function agentName(id) { return AGENTS.find(a => a.id === id)?.name ?? "The agent"; }

/** The shell that runs an agent job: [argv..., script]. */
export async function shell() {
  if (window()?.platform !== "windows") return { argv: ["sh", "-c"], ps: false };
  const pwsh = await exec("pwsh", ["-NoLogo", "-Command", "exit 0"]).then(r => r.code === 0, () => false);
  return { argv: [pwsh ? "pwsh" : "powershell.exe", "-NoLogo", "-NoProfile", "-Command"], ps: true };
}

/** The installed agent ids, and the one to use: the last one picked, else the first found. */
export async function findAgents(on) {
  // Ask the same shell the jobs run in, so PATH matches.
  const { argv, ps } = await shell();
  const found = await Promise.all(AGENTS.map(a =>
    exec(argv[0], [...argv.slice(1), ps ? `Get-Command ${a.id} -ErrorAction Stop` : `command -v ${a.id}`], { on })
      .then(r => r.code === 0, () => false)));
  const agents = AGENTS.filter((_a, i) => found[i]).map(a => a.id);
  let saved = null;
  try { saved = localStorage.getItem("agent"); } catch {}
  return { agents, agent: agents.includes(saved) ? saved : agents[0] ?? null };
}

/** Remembers the picked agent for the next time Tourist opens. */
export function rememberAgent(id) { try { localStorage.setItem("agent", id); } catch {} }

/**
 * One conversation with Claude or Codex in a folder. Each `ask` after the first
 * resumes the same session, so the agent keeps what it already read. Read-only
 * unless `write` is set, which lets it edit files in `cwd` (a fix's worktree).
 */
export class AgentSession {
  constructor(agent, cwd, { write = false } = {}) { this.agent = agent; this.cwd = cwd; this.write = write; this.id = null; this.job = null; }

  /** Stops the call in progress, if any. */
  async stop() {
    const job = this.job;
    this.job = null;
    if (job) await hc(["kill", job]).catch(() => {});
  }

  /**
   * exec stops anything over 30 s, so the agent runs as a hidden herdr-core terminal
   * that reads the prompt from a file and writes its reply to another.
   * Claude: `claude -p`, one JSON reply. Codex: `codex exec` in its sandbox (read-only,
   * or workspace-write for a fix), JSONL events on stdout (the session id) and its last
   * message in a file.
   */
  async ask(prompt) {
    const sandbox = this.write ? "workspace-write" : "read-only";
    const agent = this.agent, name = agentName(agent);
    const dir = `${appHome()}/data/tourist`.replace(/\\/g, "/");
    await fs.mkdir(dir, { recursive: true });
    const id = `${Date.now()}-${++jobs}`;
    const inFile = `${dir}/${id}.in.txt`, outFile = `${dir}/${id}.out.json`, errFile = `${dir}/${id}.err.txt`, lastFile = `${dir}/${id}.last.txt`;
    await writeTextFile(inFile, prompt, null);
    const flags = agent === "codex"
      ? ["exec", ...(this.id ? ["resume", this.id, "-c", `sandbox_mode="${sandbox}"`] : ["--sandbox", sandbox]), "--json", "-o", lastFile, "-"]
      : ["-p", "--output-format", "json", ...(this.id ? ["--resume", this.id] : []), ...(this.write ? FIX_TOOLS : TOOLS)];
    const { argv, ps } = await shell();
    const q = ps ? (s => `'${s.replace(/'/g, "''")}'`) : (s => `'${s.replace(/'/g, `'\\''`)}'`);
    const script = ps
      ? `$OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); Get-Content -Raw -Encoding utf8 -LiteralPath ${q(inFile)} | ${agent} ${flags.map(q).join(" ")} 2> ${q(errFile)} | Set-Content -NoNewline -Encoding utf8 -LiteralPath ${q(outFile)}`
      : `${agent} ${flags.map(q).join(" ")} < ${q(inFile)} > ${q(outFile)} 2> ${q(errFile)}`;
    const started = await hc(["run", "--bg", "--no-parent", "--outlive-parent", "--cwd", this.cwd ?? "", "--json", "--", ...argv, script]);
    if (started.code !== 0) throw new Error(started.stderr || `Could not start ${agent}.`);
    const address = JSON.parse(started.stdout).address;
    this.job = address;
    try {
      for (;;) {
        const w = await hc(["wait", address, "--timeout", "20", "--json"]);
        if (w.code !== 0 || JSON.parse(w.stdout).ended) break;
      }
    } finally {
      this.job = null;
      await hc(["rm", address]).catch(() => {});
    }
    const text = ((await readTextFile(outFile)) ?? "").replace(/^﻿/, "");
    const err = (await readTextFile(errFile)) ?? "";
    const last = agent === "codex" ? ((await readTextFile(lastFile).catch(() => null)) ?? "").replace(/^﻿/, "") : "";
    for (const f of [inFile, outFile, errFile, lastFile]) await fs.unlink(f).catch(() => {});
    if (agent === "codex") {
      let failure = null;
      for (const line of text.split(/\r?\n/)) {
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === "thread.started" && ev.thread_id) this.id = ev.thread_id;
        if (ev.type === "turn.failed" || ev.type === "error") failure = ev.error?.message ?? ev.message ?? failure;
      }
      if (failure || !last.trim()) throw new Error(String(failure || err || text || `${name} returned nothing.`).trim().slice(-600));
      return last;
    }
    let out;
    try { out = JSON.parse(text); }
    catch { throw new Error((err || text || `${name} returned nothing.`).trim().slice(-600)); }
    if (out.session_id) this.id = out.session_id;
    if (out.is_error) throw new Error(String(out.result || `${name} reported an error.`));
    return String(out.result ?? "");
  }
}
