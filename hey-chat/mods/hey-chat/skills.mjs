#!/usr/bin/env node
// The skills an agent has loaded in a folder, for the message box's / menu.
//
//   node skills.mjs --agent claude|codex --cwd <folder>
//       Prints a JSON array: { name, description, path? }, sorted by name.
//
// Claude: `claude -p` runs `/cost` (a local command, no model call, hooks off) and reports what it
// loaded in its init line. Descriptions come from each skill's SKILL.md where one is found.
// Codex: `codex app-server` answers skills/list, with descriptions and the SKILL.md path that a
// skill input needs.
import { spawn } from "node:child_process";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const HOME = homedir();
/** How long a lookup may take. */
const WAIT_MS = 15000;

/** --name value pairs. @param {string[]} argv */
function flags(argv) {
  /** @type {Record<string, string>} */
  const out = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) out[argv[i].slice(2)] = argv[++i] ?? "";
  return out;
}

/** A SKILL.md's description, from its front matter. @param {string} file */
function describe(file) {
  try {
    const head = readFileSync(file, "utf8").slice(0, 4000);
    const m = /^description:\s*(.+)$/m.exec(head);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
  } catch { return ""; }
}

/** Every SKILL.md under a folder, at most `depth` folders down, by skill folder name. @param {string} dir @param {number} depth @param {Map<string, string>} out */
function findSkills(dir, depth, out) {
  let names = [];
  try { names = readdirSync(dir); } catch { return; }
  if (names.includes("SKILL.md")) {
    const name = dir.split("/").pop() ?? "";
    if (!out.has(name)) out.set(name, join(dir, "SKILL.md"));
    return;
  }
  if (depth === 0) return;
  for (const n of names) {
    if (n.startsWith(".") && n !== ".claude") continue;
    const p = join(dir, n);
    try { if (statSync(p).isDirectory()) findSkills(p, depth - 1, out); } catch { /* gone */ }
  }
}

/** @param {string} cwd */
function claudeSkills(cwd) {
  return new Promise((resolve) => {
    const child = spawn("claude", ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
      "--no-session-persistence", "--settings", JSON.stringify({ disableAllHooks: true })], { cwd, stdio: ["pipe", "pipe", "ignore"] });
    let buf = "", done = false;
    const finish = (/** @type {string[]} */ names) => {
      if (done) return;
      done = true; clearTimeout(timer); child.kill("SIGTERM");
      // Descriptions: your skills, the folder's, then the plugins'.
      const files = new Map();
      findSkills(join(cwd, ".claude", "skills"), 1, files);
      findSkills(join(HOME, ".claude", "skills"), 3, files); // synced ones sit in skills/synced/<bucket>/
      findSkills(join(HOME, ".claude", "plugins"), 7, files);
      resolve(names.map((name) => {
        const file = files.get(name.split(":").pop() ?? name);
        return { name, description: file ? describe(file) : "" };
      }));
    };
    const timer = setTimeout(() => finish([]), WAIT_MS);
    child.on("error", () => finish([]));
    child.stdout.on("data", (d) => {
      buf += d.toString();
      let n;
      while ((n = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, n); buf = buf.slice(n + 1);
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === "system" && ev.subtype === "init") finish(Array.isArray(ev.skills) ? ev.skills : []);
      }
    });
    child.stdin.write(`${JSON.stringify({ type: "user", message: { role: "user", content: "/cost" } })}\n`);
  });
}

/** @param {string} cwd */
function codexSkills(cwd) {
  return new Promise((resolve) => {
    const child = spawn("codex", ["app-server"], { cwd, stdio: ["pipe", "pipe", "ignore"] });
    let buf = "", done = false;
    const finish = (/** @type {any[]} */ list) => { if (!done) { done = true; clearTimeout(timer); child.kill("SIGTERM"); resolve(list); } };
    const timer = setTimeout(() => finish([]), WAIT_MS);
    const write = (/** @type {any} */ m) => child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...m })}\n`);
    child.on("error", () => finish([]));
    child.stdout.on("data", (d) => {
      buf += d.toString();
      let n;
      while ((n = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, n); buf = buf.slice(n + 1);
        let m; try { m = JSON.parse(line); } catch { continue; }
        if (m.id === 1) { write({ method: "initialized", params: {} }); write({ id: 2, method: "skills/list", params: { cwds: [cwd] } }); }
        else if (m.id === 2) {
          const skills = (m.result?.data ?? []).flatMap((/** @type {any} */ e) => e.skills ?? []).filter((/** @type {any} */ s) => s.enabled !== false);
          finish(skills.map((/** @type {any} */ s) => ({ name: String(s.name), description: String(s.shortDescription || s.description || ""), path: String(s.path ?? "") })));
        }
      }
    });
    write({ id: 1, method: "initialize", params: { clientInfo: { name: "hey-chat", title: "Hey, chat", version: "1" }, capabilities: null } });
  });
}

const opts = flags(process.argv.slice(2));
const cwd = opts.cwd && existsSync(opts.cwd) ? opts.cwd : HOME;
const list = await (opts.agent === "codex" ? codexSkills(cwd) : claudeSkills(cwd));
const seen = new Set();
const out = list.filter((s) => s.name && !seen.has(s.name) && seen.add(s.name)).sort((a, b) => a.name.localeCompare(b.name));
process.stdout.write(JSON.stringify(out));
