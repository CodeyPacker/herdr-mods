/** The final hint: a skeleton with blanks. The full answer stays a separate action. @param {string} code */
export function form(code) {
  return `Complete this form:\n\n\`\`\`sql\n${code}\n\`\`\``;
}

const postgresNote = "\n\nThis is PostgreSQL syntax. Other databases spell it differently or don't have it.";

/**
 * One exercise. A rule given as a string means "use this syntax".
 * @param {string} id @param {string} title @param {string} prompt @param {string[]} tables
 * @param {string} solution @param {[string, string]} hints the first two hints. The third is the skeleton.
 * @param {string} skeleton @param {(string | import("../types.js").SyntaxRule)[]} rules
 * @param {Partial<import("../types.js").Exercise> & { pg?: boolean }} [extra]
 * @returns {import("../types.js").Exercise}
 */
export function q(id, title, prompt, tables, solution, hints, skeleton, rules, extra = {}) {
  const { pg, ...rest } = extra;
  return {
    id, title, prompt: pg ? prompt + postgresNote : prompt, tables, solution,
    hints: [...hints, form(skeleton)],
    rules: rules.map(rule => typeof rule === "string" ? { has: rule, message: `Use ${rule}.` } : rule),
    ordered: rest.ordered ?? endsWithOrderBy(solution),
    ...rest,
  };
}

/** A query whose final clause is a top-level ORDER BY returns rows in a defined order. @param {string} solution */
function endsWithOrderBy(solution) {
  const statements = solution.split(";").map(part => part.trim()).filter(Boolean);
  const last = statements.at(-1) ?? "";
  let depth = 0, outer = "";
  for (const char of last) {
    if (char === "(") depth++;
    if (depth === 0) outer += char;
    if (char === ")") depth--;
  }
  return /\bORDER\s+BY\b/i.test(outer) && /^\s*(SELECT|WITH|TABLE|VALUES|\()/i.test(last);
}
