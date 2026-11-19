// SQL tokens for syntax rules. Comments, string literals, and dollar-quoted bodies never
// count as the requested syntax, so a rule can't be satisfied by writing it in a comment.

const operators = ["->>", "#>>", "::", "->", "#>", "@>", "<@", "||", "<=", ">=", "<>", "!=", "?|", "?&", "=>", "&&"];

/**
 * @param {string} source
 * @returns {{ type: "word" | "string" | "number" | "symbol", text: string, upper: string, line: number }[]}
 */
export function tokenize(source) {
  const tokens = [];
  let index = 0, line = 1;
  const push = (type, text, startLine) => tokens.push({ type, text, upper: type === "word" ? text.toUpperCase() : text, line: startLine });
  while (index < source.length) {
    const char = source[index];
    const start = line;
    if (char === "\n") { line++; index++; continue; }
    if (/\s/.test(char)) { index++; continue; }
    if (source.startsWith("--", index)) {
      while (index < source.length && source[index] !== "\n") index++;
      continue;
    }
    if (source.startsWith("/*", index)) {
      let depth = 0;
      do {
        if (source.startsWith("/*", index)) { depth++; index += 2; }
        else if (source.startsWith("*/", index)) { depth--; index += 2; }
        else { if (source[index] === "\n") line++; index++; }
      } while (depth > 0 && index < source.length);
      continue;
    }
    const dollar = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(source.slice(index));
    if (dollar) {
      const end = source.indexOf(dollar[0], index + dollar[0].length);
      const stop = end < 0 ? source.length : end + dollar[0].length;
      line += (source.slice(index, stop).match(/\n/g) ?? []).length;
      index = stop;
      push("string", "$$", start);
      continue;
    }
    if (char === "'" || ((char === "E" || char === "e") && source[index + 1] === "'")) {
      index += char === "'" ? 1 : 2;
      while (index < source.length) {
        if (source[index] === "\\" && char !== "'") { index += 2; continue; }
        if (source[index] === "'") {
          if (source[index + 1] === "'") { index += 2; continue; }
          index++;
          break;
        }
        if (source[index] === "\n") line++;
        index++;
      }
      push("string", "''", start);
      continue;
    }
    if (char === '"') {
      let text = "";
      index++;
      while (index < source.length) {
        if (source[index] === '"') {
          if (source[index + 1] === '"') { text += '"'; index += 2; continue; }
          index++;
          break;
        }
        text += source[index++];
      }
      tokens.push({ type: "word", text, upper: text, line: start });
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(source.slice(index));
    if (word) { push("word", word[0], start); index += word[0].length; continue; }
    const number = /^(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(source.slice(index));
    if (number) { push("number", number[0], start); index += number[0].length; continue; }
    const operator = operators.find(item => source.startsWith(item, index));
    if (operator) { push("symbol", operator, start); index += operator.length; continue; }
    push("symbol", char, start);
    index++;
  }
  return tokens;
}

/** Split a pattern like "LEFT JOIN" or "COUNT ( DISTINCT" into tokens to match. */
function patternTokens(pattern) {
  return tokenize(pattern).map(token => token.upper);
}

/** How many times a token pattern appears. `...` in a pattern matches any run of tokens up to the next part. */
export function countPattern(tokens, pattern) {
  const parts = pattern.split("...").map(part => patternTokens(part.trim()));
  let count = 0;
  for (let start = 0; start < tokens.length; start++) {
    if (matchFrom(tokens, start, parts)) count++;
  }
  return count;
}

function matchFrom(tokens, start, parts) {
  let position = start;
  for (let part = 0; part < parts.length; part++) {
    const wanted = parts[part];
    if (part === 0) {
      if (!wanted.every((text, offset) => tokens[position + offset]?.upper === text)) return false;
      position += wanted.length;
      continue;
    }
    let found = -1;
    for (let at = position; at <= tokens.length - wanted.length; at++) {
      if (tokens[at].upper === ";") break;
      if (wanted.every((text, offset) => tokens[at + offset]?.upper === text)) { found = at; break; }
    }
    if (found < 0) return false;
    position = found + wanted.length;
  }
  return true;
}

/**
 * A rule passes when its pattern (or any of its alternatives) appears between min and max times.
 * @param {string} answer @param {import("./types.js").SyntaxRule[]} rules
 */
export function ruleFailures(answer, rules = []) {
  const tokens = tokenize(answer);
  return rules.filter(rule => {
    const patterns = rule.anyOf ?? [rule.has];
    const count = patterns.reduce((total, pattern) => total + countPattern(tokens, pattern), 0);
    return count < (rule.min ?? (rule.max === 0 ? 0 : 1)) || (rule.max !== undefined && count > rule.max);
  }).map(rule => rule.message);
}

/** True when the answer holds no SQL at all, only comments and whitespace. */
export function isBlank(answer) {
  return tokenize(answer).length === 0;
}
