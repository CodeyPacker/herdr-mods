import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Windows only: Herdr's PATH can miss the folders codex and claude install to, and an npm
 * install is a .cmd file that spawn cannot run without a shell. Look in PATH, ~/.local/bin and
 * npm's folder for the .exe, or for npm's JS entry point to run with this Node.
 * @param {string} command @returns {{ command: string, args: string[] } | null}
 */
export function windowsCommand(command, { env = process.env, home = homedir(), exists = readable } = {}) {
  const path = Object.entries(env).find(([key]) => key.toLowerCase() === "path")?.[1] ?? "";
  const dirs = [...path.split(";").filter(Boolean), join(home, ".local", "bin"), ...(env.APPDATA ? [join(env.APPDATA, "npm")] : [])];
  const entry = { codex: "@openai/codex/bin/codex.js", claude: "@anthropic-ai/claude-code/cli.js" }[command];
  for (const raw of dirs) {
    const dir = raw.replace(/^"|"$/g, "");
    if (exists(join(dir, `${command}.exe`))) return { command: join(dir, `${command}.exe`), args: [] };
    if (entry && exists(join(dir, "node_modules", entry))) return { command: process.execPath, args: [join(dir, "node_modules", entry)] };
  }
  return null;
}

/** @param {string} file */
function readable(file) {
  try { accessSync(file, constants.R_OK); return true; } catch { return false; }
}

// Each request owns a process group, so cancellation also stops its subprocesses.
export function runTutorProcess(command, args, { cwd, input = "", signal, timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error("Tutor request cancelled.")); return; }
    const found = process.platform === "win32" ? windowsCommand(command) : null;
    const child = spawn(found?.command ?? command, [...(found?.args ?? []), ...args], { cwd, shell: false, detached: process.platform !== "win32", windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "", size = 0, problem = "";
    const stop = message => {
      problem ||= message;
      try {
        if (process.platform === "win32") child.kill("SIGKILL");
        else if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {}
    };
    const cancel = () => stop("Tutor request cancelled.");
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    const timer = setTimeout(() => stop("The tutor took too long. Try again."), timeout);
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); };
    for (const [stream, name] of [[child.stdout, "stdout"], [child.stderr, "stderr"]]) stream.on("data", chunk => {
      size += chunk.length;
      if (size > 256000) { stop("The tutor returned too much output. Try a shorter question."); return; }
      if (name === "stdout") stdout += chunk.toString(); else stderr += chunk.toString();
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
    child.on("error", error => { cleanup(); reject(new Error(`Could not start ${command}. Install it and sign in, then reconnect. (${error.code ?? "error"})`)); });
    child.on("close", code => { cleanup(); resolve({ code, stdout, stderr, problem }); });
  });
}
