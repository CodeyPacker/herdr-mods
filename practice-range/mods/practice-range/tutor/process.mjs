import { spawn } from "node:child_process";

// Each request owns a process group, so cancellation also stops its subprocesses.
export function runTutorProcess(command, args, { cwd, input = "", signal, timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error("Tutor request cancelled.")); return; }
    const child = spawn(command, args, { cwd, shell: false, detached: process.platform !== "win32", windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
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
