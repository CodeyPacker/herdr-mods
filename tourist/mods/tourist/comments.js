// Line comments on a PR review, kept in a JSON file per repo and PR so they
// survive closing the pane. They stay on this computer.
import { appHome, readTextFile, writeTextFile } from "herdr";
import * as fs from "fs/promises";

const dir = () => `${appHome()}/data/tourist/comments`.replace(/\\/g, "/");

/** The file name for one PR's comments: the repo root and PR number, made path-safe. */
export function commentKey(root, number) {
  return `${root}#pr-${number}`.replace(/[^A-Za-z0-9._-]+/g, "_");
}

/** The saved comments, oldest first. Empty when there are none or the file is unreadable. */
export async function loadComments(key) {
  try {
    const list = JSON.parse((await readTextFile(`${dir()}/${key}.json`)) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export async function saveComments(key, list) {
  await fs.mkdir(dir(), { recursive: true });
  await writeTextFile(`${dir()}/${key}.json`, JSON.stringify(list, null, 2), null);
}

/** "new" for added and unchanged lines (numbered in the PR's file), "old" for removed ones. */
export function sideOf(row) { return row.kind === "-" ? "old" : "new"; }

/**
 * The comments that sit under one diff row. A comment sits under its last line
 * (`line`/`side`). A multi-line comment also has `startLine`/`startSide`.
 */
export function commentsOn(list, file, row) {
  if (row.number === undefined) return [];
  const side = sideOf(row);
  return list.filter(c => c.file === file && c.line === row.number && c.side === side);
}

/** "12" or "12-18": where a comment sits, for labels and prompts. */
export function linesOf(c) { return c.startLine !== undefined ? `${c.startLine}-${c.line}` : String(c.line); }

const rowOf = (rows, line, side) => rows.findIndex(r => r.kind !== "@" && r.number === line && sideOf(r) === side);

/** The indexes of the shown rows covered by saved multi-line comments and by the comment being written. */
export function coveredRows(rows, list, file, open) {
  const covered = new Set();
  const add = c => {
    const end = rowOf(rows, c.line, c.side), start = rowOf(rows, c.startLine ?? c.line, c.startSide ?? c.side);
    if (end < 0 || start < 0) return;
    for (let i = Math.min(start, end); i <= Math.max(start, end); i++) covered.add(i);
  };
  for (const c of list) if (c.file === file && c.startLine !== undefined) add(c);
  if (open?.file === file) add(open);
  return covered;
}

/**
 * The rows from `from` to `to` (indexes into the shown rows), cut short at a hunk header
 * because GitHub only takes a range inside one hunk. Both ends are numbered lines.
 */
export function rangeOf(rows, from, to) {
  const step = to >= from ? 1 : -1;
  let end = from;
  for (let i = from + step; step > 0 ? i <= to : i >= to; i += step) {
    if (rows[i].kind === "@") break;
    if (rows[i].number !== undefined) end = i;
  }
  return [Math.min(from, end), Math.max(from, end)];
}
