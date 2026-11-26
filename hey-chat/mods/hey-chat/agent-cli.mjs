// Short, one-off conversations with the agents' own programs, for facts rather than chats: the
// models they offer (models.mjs) and the skills they load (skills.mjs). Neither opens a session.
import { spawnAgent } from "./process.mjs";
import { lines, parse } from "./cli.mjs";

/** How long a lookup may take. */
const WAIT_MS = 15000;

/**
 * Runs `claude -p` in its JSON mode in `cwd` with `args` added, sends it `message`, and resolves
 * with the first value `pick` returns (other than undefined) for a line Claude writes. Resolves
 * with `fallback` when Claude can't start, stops, or takes too long. Claude is stopped either way.
 * @template T
 * @param {string} cwd @param {string[]} args @param {any} message
 * @param {(line: any) => T | undefined} pick @param {T} fallback
 * @returns {Promise<T>}
 */
export function askClaude(cwd, args, message, pick, fallback) {
  return new Promise((resolve) => {
    const child = spawnAgent("claude", ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", ...args],
      { cwd, stdio: ["pipe", "pipe", "ignore"] });
    let done = false;
    const finish = (/** @type {T} */ value) => {
      if (done) return;
      done = true; clearTimeout(timer); child.kill("SIGTERM"); resolve(value);
    };
    const timer = setTimeout(() => finish(fallback), WAIT_MS);
    child.on("error", () => finish(fallback));
    // "close", not "exit": what Claude wrote before it stopped is read first.
    child.on("close", () => finish(fallback));
    child.stdin?.on("error", () => {});
    child.stdout?.on("data", lines((line) => {
      const m = parse(line);
      const value = m ? pick(m) : undefined;
      if (value !== undefined) finish(value);
    }));
    child.stdin?.write(`${JSON.stringify(message)}\n`);
  });
}

/**
 * Starts `codex app-server` in `cwd`, initializes it, and resolves with what `use(call)` resolves
 * with. `call(method, params)` sends a request and resolves with its result. Rejects when Codex
 * can't start, stops, refuses a request, or takes longer than `timedOut` allows. Codex is stopped after.
 * @template T
 * @param {string} cwd @param {(call: (method: string, params: any) => Promise<any>) => Promise<T>} use
 * @param {string} [timedOut] the message when it takes too long
 * @returns {Promise<T>}
 */
export async function withCodex(cwd, use, timedOut = "Codex took too long to answer. Try again.", options = {}) {
  const child = spawnAgent("codex", ["app-server", ...(options.args ?? [])], { cwd, stdio: ["pipe", "pipe", "pipe"] });
  /** @type {Map<number, { resolve: (r: any) => void, reject: (e: Error) => void }>} */
  const calls = new Map();
  let id = 0, stderr = "";
  /** @type {Error | null} */
  let gone = null;
  const fail = (/** @type {Error} */ error) => {
    gone ??= error;
    for (const c of calls.values()) c.reject(error);
    calls.clear();
  };
  const write = (/** @type {any} */ m) => child.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", ...m })}\n`);
  /** @param {string} method @param {any} params @returns {Promise<any>} */
  const call = (method, params) => new Promise((resolve, reject) => {
    if (gone) { reject(gone); return; }
    const n = ++id;
    calls.set(n, { resolve, reject });
    write({ id: n, method, params });
  });
  child.stderr?.on("data", (d) => { stderr = (stderr + d).slice(-2000); });
  child.stdin?.on("error", () => {});
  child.on("error", fail);
  child.on("exit", () => fail(new Error(stderr.trim() || "Codex stopped unexpectedly.")));
  child.stdout?.on("data", lines((line) => {
    const m = parse(line);
    const pending = m?.method === undefined ? calls.get(m?.id) : undefined;
    if (!pending) return;
    calls.delete(m.id);
    if (m.error) pending.reject(new Error(String(m.error.message ?? "Codex refused that.")));
    else pending.resolve(m.result);
  }));
  /** @type {any} */
  let timer;
  const late = new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error(timedOut)), WAIT_MS); });
  try {
    return await Promise.race([late, (async () => {
      await call("initialize", { clientInfo: { name: "hey-chat", title: "Hey, chat", version: "1" }, ...(options.experimental ? { capabilities: { experimentalApi: true } } : {}) });
      write({ method: "initialized", params: {} });
      return use(call);
    })()]);
  } finally {
    clearTimeout(timer);
    child.kill();
  }
}
