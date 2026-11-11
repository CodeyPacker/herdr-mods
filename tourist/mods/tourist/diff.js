// Turning a unified diff into numbered rows, and keeping the part a stop is about.

const MAX_ROWS = 600;

/**
 * One row per diff line after the file header. `kind` is "@" for a hunk header,
 * "+" added, "-" removed, " " unchanged. `number` is the line in the new file
 * (the old file for removed lines).
 */
export function diffRows(text) {
  const lines = String(text ?? "").replace(/\r/g, "").split("\n");
  const first = lines.findIndex(l => l.startsWith("@@"));
  if (first < 0) return [];
  let old = 0, next = 0;
  return lines.slice(first).filter((l, i, all) => !(i === all.length - 1 && l === "")).map(line => {
    const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line);
    if (match) { old = +match[1]; next = +match[2]; return { kind: "@", text: line }; }
    const kind = line[0], body = line.slice(1) || " ";
    if (kind === "-") return { kind, number: old++, text: body };
    if (kind === "+") return { kind, number: next++, text: body };
    if (kind === " ") { old++; return { kind, number: next++, text: body }; }
    return { kind: "", text: line }; // "\ No newline at end of file"
  });
}

/** A multi-file diff split into one `{ file, rows }` per file. */
export function splitDiff(text) {
  return String(text ?? "").replace(/\r/g, "").split(/^diff --git /m).slice(1).map(part => {
    const head = part.split("\n")[0], m = / b\/(.+)$/.exec(head);
    return { file: m ? m[1] : head, rows: diffRows(part) };
  });
}

/** The hunks that touch new-file lines start..end. All hunks when none do. */
export function rowsInRange(rows, start, end) {
  const hunks = [];
  for (const row of rows) {
    if (row.kind === "@" || hunks.length === 0) hunks.push([]);
    hunks[hunks.length - 1].push(row);
  }
  const touches = hunk => hunk.some(r => (r.kind === "+" || r.kind === " ") && r.number >= start && r.number <= end);
  const picked = hunks.filter(touches);
  return (picked.length ? picked : hunks).flat().slice(0, MAX_ROWS);
}

/**
 * On a re-review, marks the rows GitHub won't take a comment on: removed lines (they're from the
 * old review's commit, not the base) and lines outside the whole PR's hunks. `prRows` are the
 * whole PR's diff rows of the same file, or null when git couldn't produce them.
 */
export function markOutsidePR(rows, prRows) {
  const ok = new Set((prRows ?? []).filter(r => r.kind === "+" || r.kind === " ").map(r => r.number));
  for (const r of rows) if (r.number !== undefined && (r.kind === "-" || !ok.has(r.number))) r.noComment = true;
  return rows;
}

/**
 * The first and last row (indexes) showing new-file lines start..end, removed lines between them
 * included. Null when none of those lines are in the diff.
 */
export function rowsFor(rows, start, end) {
  let first = -1, last = -1;
  rows.forEach((r, i) => {
    if (r.kind === "@" || r.kind === "-" || r.number === undefined || r.number < start || r.number > end) return;
    if (first < 0) first = i;
    last = i;
  });
  return first < 0 ? null : [first, last];
}

/** The row closest to new-file line `line`, for scrolling to a line the diff doesn't show. */
export function nearestRow(rows, line) {
  let best = 0, gap = Infinity;
  rows.forEach((r, i) => {
    if (r.kind === "@" || r.kind === "-" || r.number === undefined) return;
    const d = Math.abs(r.number - line);
    if (d < gap) { gap = d; best = i; }
  });
  return best;
}

/** At most `max` rows, around row `at` when the file's diff is longer. */
export function windowRows(rows, at, max = 2000) {
  if (rows.length <= max) return rows;
  const start = Math.max(0, Math.min(rows.length - max, at - Math.floor(max / 2)));
  return rows.slice(start, start + max);
}
