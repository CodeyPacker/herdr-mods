// Turning a TypeScript practice exercise and the learner's file into one file that run.mjs can
// type-check and run, and reading what came back. Plain JavaScript with no Herdr imports.

// Lines starting with this are check results printed by the harness.
export const MARK = "@@tutor ";
// The line between the learner's code and the checks. run.mjs reports errors above it as the
// learner's, with their own line numbers, and errors in a check line by the check's number.
export const CHECKS_START = "/*@@tutor-checks*/";
const checkTag = i => `/*@@check:${i}*/`;

/** The check lines of a `checks` exercise: one `check(...)` statement per line. */
export function checkLines(ex) {
  return String(ex.checks ?? "").split("\n").map(l => l.trim()).filter(Boolean);
}

/** A check line's name, as the string literal it starts with and as plain text. */
export function checkName(line) {
  const m = /^check\(\s*("(?:[^"\\]|\\.)*")/.exec(line);
  if (!m) return null;
  return { literal: m[1], text: JSON.parse(m[1]) };
}

/**
 * The file to run: the learner's code with their line numbers, then for a `checks` exercise the
 * harness and each check, which run after the learner's code.
 */
export function compose(ex, source) {
  const code = String(source ?? "").replace(/\r/g, "").replace(/\n+$/, "");
  if (ex.kind === "program") return `${code}\n`;
  const out = [code, CHECKS_START,
    `function check(name: string, ok: boolean): void { console.log(\`${MARK}\${ok ? "PASS" : "FAIL"} \${name}\`); }`];
  checkLines(ex).forEach((line, i) => {
    const name = checkName(line)?.literal ?? `"check ${i + 1}"`;
    out.push(`try { ${line} } catch (e) { console.log("${MARK}FAIL " + ${name} + " (threw " + (e instanceof Error ? e.name : typeof e) + ")"); } ${checkTag(i)}`);
  });
  return out.join("\n") + "\n";
}

/** Trailing spaces off each line and blank lines off the end, with \n line ends. */
export function tidy(text) {
  return String(text ?? "").replace(/\r/g, "").split("\n").map(l => l.replace(/\s+$/, "")).join("\n").replace(/\n+$/, "");
}

/**
 * Reads one run of run.mjs. `r` is { code, stdout, stderr, timedOut }; run.mjs prints one JSON
 * line: { compiled, errors, broken, code, stdout, stderr, timedOut } or { missing }. Returns the
 * same shape as C#'s parseRun: { passed, compiled, timedOut, errors: [{line, col, code, text}],
 * broken: [{check, code, text}], checks: [{name, ok, why}], expected, actual, crash }.
 */
export function parseRun(ex, r) {
  const names = checkLines(ex).map((l, i) => checkName(l)?.text ?? `check ${i + 1}`);
  const out = { passed: false, compiled: false, timedOut: Boolean(r.timedOut), errors: [], broken: [], checks: [], expected: null, actual: null, crash: null };
  if (out.timedOut) return out;
  const last = String(r.stdout ?? "").trim().split("\n").at(-1) ?? "";
  let run;
  try { run = JSON.parse(last); } catch { run = null; }
  if (!run || typeof run !== "object") {
    out.errors.push({ line: null, col: null, code: "", text: tidy(`${r.stderr ?? ""}\n${r.stdout ?? ""}`).split("\n").slice(-6).join("\n") || "The TypeScript runner printed nothing." });
    return out;
  }
  if (run.missing) {
    out.errors.push({ line: null, col: null, code: "", text: run.missing });
    return out;
  }
  out.errors = (run.errors ?? []).map(e => ({ line: e.line ?? null, col: e.col ?? null, code: e.code ?? "", text: String(e.text ?? "") }));
  out.broken = (run.broken ?? []).map(b => ({ check: names[b.check] ?? `check ${b.check + 1}`, code: b.code ?? "", text: String(b.text ?? "") }));
  out.compiled = Boolean(run.compiled) && !out.errors.length && !out.broken.length;
  out.timedOut = Boolean(run.timedOut);
  if (!out.compiled || out.timedOut) return out;
  const stdout = String(run.stdout ?? "").replace(/\r/g, "").split("\n");
  if (run.code !== 0) out.crash = tidy(run.stderr || stdout.join("\n")).split("\n").slice(0, 8).join("\n") || `exited with code ${run.code}`;
  if (ex.kind === "program") {
    out.expected = tidy(ex.expected);
    out.actual = tidy(stdout.filter(l => !l.startsWith(MARK)).join("\n"));
    out.passed = run.code === 0 && out.actual === out.expected;
    return out;
  }
  const results = new Map();
  for (const l of stdout) {
    if (!l.startsWith(MARK)) continue;
    const m = /^(PASS|FAIL) (.*?)(?: \((threw \w+)\))?$/.exec(l.slice(MARK.length));
    if (m && !results.has(m[2])) results.set(m[2], { ok: m[1] === "PASS", why: m[3] ?? null });
  }
  out.checks = names.map(name => {
    const got = results.get(name);
    return { name, ok: Boolean(got?.ok), why: got ? got.why : "did not run" };
  });
  out.passed = run.code === 0 && out.checks.length > 0 && out.checks.every(c => c.ok);
  return out;
}
