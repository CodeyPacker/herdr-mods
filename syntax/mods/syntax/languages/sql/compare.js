// Result-set comparison. Values arrive as PostgreSQL text, so 12, 12.0 and 12.00 compare equal
// while everything else compares exactly. Pure functions, shared by the checker and tests.

const numeric = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
const maxShown = 3;

/** @param {unknown} value */
export function cellKey(value) {
  if (value === null || value === undefined) return "\u0000null";
  if (Array.isArray(value)) return JSON.stringify(value.map(item => cellKey(item)));
  const text = typeof value === "string" ? value : String(value);
  if (numeric.test(text)) return `#${Number(Number(text).toPrecision(12))}`;
  return `'${text}`;
}

/** @param {unknown} value @param {number} [type] */
export function display(value, type) {
  if (value === null || value === undefined) return "NULL";
  if (Array.isArray(value)) return `{${value.map(item => display(item)).join(",")}}`;
  if (type === 16) return value === "t" ? "true" : value === "f" ? "false" : String(value);
  const text = String(value);
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

/** @typedef {{ columns: string[], types: number[], rows: unknown[][] }} ResultSet */

function rowText(row, types) {
  return `(${row.map((value, index) => display(value, types[index])).join(", ")})`;
}

const rowKey = row => row.map(cellKey).join("\u0001");

/**
 * Compare a learner's result with the reference result.
 * @param {ResultSet} expected @param {ResultSet} actual @param {{ ordered?: boolean, label?: string }} [options]
 * @returns {string[]} problems, empty when the results match.
 */
export function compareResults(expected, actual, { ordered = false } = {}) {
  const wantNames = expected.columns.map(name => name.toLowerCase());
  const gotNames = actual.columns.map(name => name.toLowerCase());
  if (wantNames.length !== gotNames.length) {
    return [`Return ${wantNames.length} column${wantNames.length === 1 ? "" : "s"}: ${wantNames.join(", ")}.`,
      `Yours returned ${gotNames.length}: ${gotNames.join(", ") || "none"}.`];
  }
  if (wantNames.some((name, index) => name !== gotNames[index])) {
    const problems = [`Name the columns ${wantNames.join(", ")}, in that order. Yours are ${gotNames.join(", ")}.`];
    if (gotNames.includes("?column?")) problems.push("A computed column needs a name. Give it one with AS.");
    return problems;
  }
  const wantKeys = expected.rows.map(rowKey);
  const gotKeys = actual.rows.map(rowKey);
  const sameSet = (() => {
    if (wantKeys.length !== gotKeys.length) return false;
    const left = [...wantKeys].sort(), right = [...gotKeys].sort();
    return left.every((key, index) => key === right[index]);
  })();
  if (sameSet) {
    if (!ordered || wantKeys.every((key, index) => key === gotKeys[index])) return [];
    const index = wantKeys.findIndex((key, position) => key !== gotKeys[position]);
    return ["The rows are right, but not in the requested order.",
      `Row ${index + 1} should be ${rowText(expected.rows[index], expected.types)}. Yours is ${rowText(actual.rows[index], actual.types)}.`];
  }
  const problems = [];
  if (wantKeys.length !== gotKeys.length) problems.push(`Expected ${wantKeys.length} row${wantKeys.length === 1 ? "" : "s"}, got ${gotKeys.length}.`);
  const remaining = new Map();
  for (const key of wantKeys) remaining.set(key, (remaining.get(key) ?? 0) + 1);
  const extra = [];
  actual.rows.forEach((row, index) => {
    const key = gotKeys[index], left = remaining.get(key) ?? 0;
    if (left > 0) remaining.set(key, left - 1);
    else extra.push(row);
  });
  const missing = [];
  expected.rows.forEach((row, index) => {
    const key = wantKeys[index], left = remaining.get(key) ?? 0;
    if (left > 0) { missing.push(row); remaining.set(key, left - 1); }
  });
  const list = (rows, types) => rows.slice(0, maxShown).map(row => rowText(row, types)).join("; ") + (rows.length > maxShown ? `; and ${rows.length - maxShown} more` : "");
  if (missing.length) problems.push(`Missing: ${list(missing, expected.types)}.`);
  if (extra.length) problems.push(`Not expected: ${list(extra, actual.types)}.`);
  return problems;
}

/**
 * A result set as a psql-style text table, for showing learners what their query returned.
 * @param {ResultSet} result @param {{ limit?: number, width?: number }} [options]
 */
export function formatTable(result, { limit = 20, width = 60 } = {}) {
  const clip = text => text.length > width ? `${text.slice(0, width - 1)}…` : text;
  const shown = result.rows.slice(0, limit).map(row => row.map((value, index) => clip(display(value, result.types[index]).replaceAll("\n", " "))));
  const names = result.columns.map(name => clip(name));
  const widths = names.map((name, index) => Math.max(name.length, ...shown.map(row => row[index].length)));
  const line = cells => ` ${cells.map((cell, index) => cell.padEnd(widths[index])).join(" | ")}`.trimEnd();
  const total = result.rows.length;
  return [
    line(names),
    widths.map(size => "-".repeat(size + 2)).join("+"),
    ...shown.map(line),
    total > limit ? `(${total} rows, first ${limit} shown)` : `(${total} row${total === 1 ? "" : "s"})`,
  ].join("\n");
}

/**
 * Rows that differ between two results of the same query, as result sets with the after
 * (or before) columns. A changed row appears once in each.
 * @param {ResultSet} before @param {ResultSet} after
 */
export function rowChanges(before, after) {
  const counts = new Map();
  for (const row of before.rows) counts.set(rowKey(row), (counts.get(rowKey(row)) ?? 0) + 1);
  const added = [];
  for (const row of after.rows) {
    const key = rowKey(row), left = counts.get(key) ?? 0;
    if (left > 0) counts.set(key, left - 1); else added.push(row);
  }
  const removed = before.rows.filter(row => {
    const key = rowKey(row), left = counts.get(key) ?? 0;
    if (left > 0) { counts.set(key, left - 1); return true; }
    return false;
  });
  return { added: { ...after, rows: added }, removed: { ...before, rows: removed } };
}
