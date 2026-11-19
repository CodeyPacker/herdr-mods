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
