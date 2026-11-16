// Progress: stops seen, the last stop per module, quiz scores. One JSON file per course, shared by
// every copy of the mod, so each save reads the file again and merges before writing.
import { readTextFile, writeTextFile } from "herdr";
import * as fs from "fs/promises";


const folder = path => path.slice(0, path.lastIndexOf("/"));

export const fresh = () => ({ version: 1, last: null, modules: {} });

/** Parses the file's text. Null for text that is not a progress file. */
function parse(text) {
  try {
    const p = JSON.parse(text);
    return p && typeof p === "object" && p.modules && typeof p.modules === "object" ? p : null;
  } catch { return null; }
}

/**
 * Reads progress. A missing file is a fresh start. A broken one is kept as progress.json.bad,
 * then removed, so the next save starts clean.
 */
export async function loadProgress(path) {
  const text = await readTextFile(path).catch(() => null);
  if (text === null) return fresh();
  const p = parse(text);
  if (p) return p;
  await fs.mkdir(folder(path), { recursive: true }).catch(() => {});
  const bad = `${path}.bad`;
  await writeTextFile(bad, text, await readTextFile(bad).catch(() => null)).catch(() => {});
  await fs.unlink(path).catch(() => {});
  return fresh();
}

const later = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
const earlier = (a, b) => (!a ? b : !b ? a : a < b ? a : b);

/** One module's progress from two copies: the union of what each saw, the better quiz. */
function mergeModule(mine, theirs) {
  if (!theirs) return mine;
  if (!mine) return theirs;
  const seen = [...new Set([...(mine.seen ?? []), ...(theirs.seen ?? [])])].sort((a, b) => a - b);
  let quiz = mine.quiz ?? theirs.quiz;
  if (mine.quiz && theirs.quiz) {
    const newer = later(mine.quiz.at, theirs.quiz.at) === theirs.quiz.at ? theirs.quiz : mine.quiz;
    quiz = { ...newer,
      attempts: Math.max(mine.quiz.attempts ?? 0, theirs.quiz.attempts ?? 0),
      best: Math.max(mine.quiz.best ?? 0, theirs.quiz.best ?? 0),
      passed: Boolean(mine.quiz.passed || theirs.quiz.passed) };
  }
  const out = { ...theirs, ...mine, seen };
  if (quiz) out.quiz = quiz;
  if (mine.practice || theirs.practice) {
    const practice = { ...theirs.practice };
    for (const [id, a] of Object.entries(mine.practice ?? {})) {
      const b = theirs.practice?.[id];
      practice[id] = !b ? a : { ...b, ...a,
        passed: Boolean(a.passed || b.passed), runs: Math.max(a.runs ?? 0, b.runs ?? 0),
        hints: Math.max(a.hints ?? 0, b.hints ?? 0), gaveUp: Boolean(a.gaveUp || b.gaveUp), at: later(a.at, b.at) };
    }
    out.practice = practice;
  }
  const done = earlier(mine.doneAt, theirs.doneAt);
  if (done) out.doneAt = done;
  return out;
}

/** This copy's progress merged over what is on disk. `last` is this copy's. */
export function merge(mine, disk) {
  if (!disk) return mine;
  const modules = { ...disk.modules };
  for (const [id, m] of Object.entries(mine.modules)) modules[id] = mergeModule(m, disk.modules[id]);
  return { version: 1, last: mine.last ?? disk.last ?? null, modules };
}

/**
 * Saves `p` merged with the file as it is now, and returns the merged progress.
 * `replace` writes `p` as it is (a reset). writeTextFile refuses if the file changed since it
 * was read, so a save racing another copy's reads and merges again.
 */
export async function saveProgress(path, p, { replace = false } = {}) {
  await fs.mkdir(folder(path), { recursive: true });
  for (let i = 0; ; i++) {
    const text = await readTextFile(path).catch(() => null);
    const out = replace ? p : merge(p, text === null ? null : parse(text));
    try { await writeTextFile(path, JSON.stringify(out, null, 2), text); return out; }
    catch (e) { if (i >= 3) throw e; }
  }
}
