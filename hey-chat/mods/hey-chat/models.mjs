#!/usr/bin/env node
// Reads the agent's model options without opening a conversation or claiming its writer.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const [agent, cwd] = process.argv.slice(2);
if (agent === "claude") {
  process.stdout.write(JSON.stringify(["sonnet", "opus", "haiku"].map(id => ({ id, name: id[0].toUpperCase() + id.slice(1) }))));
} else if (agent === "codex") {
  const child = spawn("codex", ["app-server"], { cwd, stdio: ["pipe", "pipe", "pipe"] });
  const calls = new Map();
  let id = 0, stderr = "";
  const fail = error => { for (const c of calls.values()) c.reject(error); calls.clear(); };
  const timer = setTimeout(() => { fail(new Error("Loading models timed out. Try again.")); child.kill(); }, 15000);
  child.stderr.on("data", d => { stderr = (stderr + d).slice(-2000); });
  child.on("error", fail);
  child.on("exit", () => fail(new Error(stderr.trim() || "Codex stopped while loading models.")));
  const reader = createInterface({ input: child.stdout });
  reader.on("line", line => {
    let m;
    try { m = JSON.parse(line); } catch { return; }
    const pending = calls.get(m.id);
    if (!pending) return;
    calls.delete(m.id);
    if (m.error) pending.reject(new Error(m.error.message ?? "Couldn't load models."));
    else pending.resolve(m.result);
  });
  const call = (method, params) => new Promise((resolve, reject) => {
    const request = ++id;
    calls.set(request, { resolve, reject });
    child.stdin.write(JSON.stringify({ id: request, method, params }) + "\n");
  });
  try {
    await call("initialize", { clientInfo: { name: "hey-chat-models", version: "1" } });
    child.stdin.write(JSON.stringify({ method: "initialized", params: {} }) + "\n");
    const models = [];
    let cursor = null;
    do {
      const page = await call("model/list", { cursor, includeHidden: false });
      for (const m of page.data ?? []) if (!m.hidden && m.model) models.push({ id: m.model, name: m.displayName || m.model });
      cursor = page.nextCursor;
    } while (cursor);
    process.stdout.write(JSON.stringify(models));
  } catch (e) {
    process.stderr.write(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  } finally {
    clearTimeout(timer); reader.close(); child.kill();
  }
} else {
  process.stderr.write("Unknown agent."); process.exitCode = 1;
}
