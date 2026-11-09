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

/** The comments that sit under one diff row. */
export function commentsOn(list, file, row) {
  if (row.number === undefined) return [];
  const side = sideOf(row);
  return list.filter(c => c.file === file && c.line === row.number && c.side === side);
}
