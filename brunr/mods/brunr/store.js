// What Brunr keeps. Two parts:
// - Saved: fold state and the chosen Environments, in the panel copy's localStorage, keyed by
//   Machine plus Collection root. Nothing from a Response is ever saved.
// - Runs: the Run of each tab, in memory only. Module code is shared by every copy of the mod, so
//   the panel copy hands a Run to the Response pane copy through this module. Shared state carries
//   only a counter (`brunr.tick`) that makes the other copies draw again.
import { setShared, shared } from "herdr";

export const TICK = "brunr.tick";

const parse = (text, fallback) => { try { return JSON.parse(text ?? "null") ?? fallback; } catch { return fallback; } };

export class Saved {
  /** `storage`: an object with getItem and setItem (localStorage in the app). */
  constructor(storage) {
    this.storage = storage;
    this.open = parse(storage?.getItem("open"), {});
    this.envs = parse(storage?.getItem("envs"), {});
    this.globals = parse(storage?.getItem("globals"), {});
  }

  write(name, value) { try { this.storage?.setItem(name, JSON.stringify(value)); } catch {} }

  /** Whether a Collection or folder row is unfolded. `fallback` until the person folds or unfolds it. */
  isOpen(key, fallback = false) { return typeof this.open[key] === "boolean" ? this.open[key] : fallback; }
  setOpen(key, value) { this.open[key] = !!value; this.write("open", this.open); }

  /** The chosen Environment of a Collection: a name, null for "No Environment", undefined when never chosen. */
  env(collectionKey) { return collectionKey in this.envs ? this.envs[collectionKey] : undefined; }
  setEnv(collectionKey, name) { this.envs[collectionKey] = name ?? null; this.write("envs", this.envs); }

  /** The chosen Global environment of a workspace file, or null. */
  globalEnv(workspacePath) { return this.globals[workspacePath] ?? null; }
  setGlobalEnv(workspacePath, name) {
    if (name) this.globals[workspacePath] = name; else delete this.globals[workspacePath];
    this.write("globals", this.globals);
  }
}

/** The Environment a Run uses: the chosen one when it still exists, else the Collection's default. */
export function chosenEnv(saved, collectionKey, collection) {
  const names = new Set((collection?.environments ?? []).map((e) => e.name));
  const picked = saved.env(collectionKey);
  if (picked === null) return null;
  if (picked !== undefined && names.has(picked)) return picked;
  const def = collection?.defaultEnvironment ?? null;
  return def && names.has(def) ? def : null;
}

// Runs, in memory

const runs = new Map();       // tab id -> what its Response pane shows
let busy = null;              // the Run in progress across the mod: { tab, key, ck, label, progress }
let waiters = [];

function changed() {
  const w = waiters;
  waiters = [];
  for (const resolve of w) resolve();
  try { setShared(TICK, ((Number(shared(TICK)) || 0) + 1) % 1000000); } catch {}
}

/** Resolves the next time any tab's Run changes. Copies wait on it to draw again. */
export function nextChange() { return new Promise((resolve) => waiters.push(resolve)); }

/** What a tab's Response pane shows, or null. */
export function getView(tab) { return runs.get(tab) ?? null; }

/** The Run in progress, or null. One Run at a time across the mod. */
export function running() { return busy; }

/**
 * Starts a Run in a tab. False when another Run is in progress.
 * `info`: `{ key, ck, label, method, url, environment, machine, tree, target, planned }`, `key` being
 * the tree row that runs, `ck` its Collection, `tree` the parsed Collection and `planned` the
 * Requests the Run is expected to send. `progress`: progressOf's result before any Request
 * finished, or null. The view's `id` stays the same for the whole Run.
 */
export function beginRun(tab, info, progress = null) {
  if (busy) return false;
  busy = { tab, key: info.key, ck: info.ck ?? null, label: info.label, progress };
  const n = Date.now();
  runs.set(tab, { kind: "run", id: n, state: "running", info, result: null, progress, n });
  changed();
  return true;
}

/**
 * Where the Run in progress stands: progressOf's result. Nothing is redrawn when it equals the
 * last one.
 */
export function setProgress(tab, progress) {
  const view = runs.get(tab);
  if (!busy || busy.tab !== tab || JSON.stringify(progress) === JSON.stringify(busy.progress)) return;
  busy = { ...busy, progress };
  if (view?.kind === "run" && view.state === "running") runs.set(tab, { ...view, progress, n: Date.now() });
  changed();
}

/** Ends the Run in progress with readRun's result. */
export function finishRun(tab, result) {
  const view = runs.get(tab);
  if (view?.kind === "run" && view.state === "running") runs.set(tab, { ...view, state: "done", result, progress: null, n: Date.now() });
  busy = null;
  changed();
}

/** Shows a Collection file in a tab's Response pane: `{ path, text, language }`. */
export function showFile(tab, file) {
  runs.set(tab, { kind: "file", file, n: Date.now() });
  changed();
}

// Asks from the mod's popups (picker, menu, the key's pass-through copy) to the panel copy. As in
// Dockr, they go through shared state and the panel takes them when it draws: a popup closes at
// once, and work started from its turn would belong to it. An ask holds names and row keys only.

export const REQUEST = "brunr.request";

/** Hands an ask to the panel: `{ kind, ... }`. */
export function ask(req) {
  setShared(REQUEST, { ...req, n: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
}

/** The latest ask's id, or null. */
export const lastAsk = () => shared(REQUEST)?.n ?? null;

/** The latest ask when it is newer than `seen`, else null. */
export function takeAsk(seen) {
  const req = shared(REQUEST);
  return req?.n && req.n !== seen ? req : null;
}

/** Forgets a tab's Run, when its pane closes. */
export function clearView(tab) {
  if (runs.delete(tab)) changed();
}
