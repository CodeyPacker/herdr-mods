import { spawn } from "node:child_process";

export function runProcess(command, args, { cwd, timeout = 15000, maxOutput = 64000, env = {} } = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "", size = 0, problem = "";
    const stop = message => { problem ||= message; child.kill("SIGKILL"); };
    const timer = setTimeout(() => stop("The code exceeded the time limit. Check for an infinite loop or waiting input."), timeout);
    const collect = target => chunk => {
      size += chunk.length;
      if (size > maxOutput) { stop("The code produced too much output. Check for a loop that keeps printing."); return; }
      if (target === "stdout") stdout += chunk.toString(); else stderr += chunk.toString();
    };
    child.stdout.on("data", collect("stdout"));
    child.stderr.on("data", collect("stderr"));
    child.on("error", error => { clearTimeout(timer); reject(new Error(`${command}: ${error.message}`)); });
    child.on("close", code => { clearTimeout(timer); resolveResult({ code, stdout, stderr, problem }); });
  });
}
