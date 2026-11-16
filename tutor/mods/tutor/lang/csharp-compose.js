// Turning a C# practice exercise and the learner's file into one file that `dotnet run` can run,
// and reading what came back. Plain JavaScript with no Herdr imports, so scripts can use it too.

// Strict by default: nullable on, warnings fail the build. NuGetAudit is off because with
// warnings as errors, a package advisory in the SDK's own packages would fail every run.
const HEADER = ["#:property TreatWarningsAsErrors=true", "#:property Nullable=enable", "#:property NuGetAudit=false"];

// Lines starting with this are check results printed by the harness.
export const MARK = "@@tutor ";

// A plain `using X;` or `using A = B;` line. Not `using (` or `using var`.
const USING = /^\s*(global\s+)?using\s+(static\s+)?[\w.]+(\s*=\s*[\w.<>,\s]+)?\s*;\s*$/;

/** The check lines of a `types` exercise: one `Check(...)` statement per line. */
export function checkLines(ex) {
  return String(ex.checks ?? "").split("\n").map(l => l.trim()).filter(Boolean);
}

/** A check line's name, as the C# string literal it starts with and as plain text. */
export function checkName(line) {
  const m = /^Check\(\s*("(?:[^"\\]|\\.)*")/.exec(line);
  if (!m) return null;
  return { literal: m[1], text: JSON.parse(m[1]) };
}

/**
 * The file to run. `#line` directives make compiler messages name `exercise.cs` with the
 * learner's own line numbers, and `checkN.cs` for a check that does not compile.
 */
export function compose(ex, source) {
  const lines = String(source ?? "").replace(/\r/g, "").split("\n");
  if (ex.kind === "program") return [...HEADER, `#line 1 "exercise.cs"`, ...lines].join("\n") + "\n";
  // Using directives must come before the harness's statements, so lift them to the top
  // and leave a blank line where each was, keeping the learner's line numbers.
  const usings = [];
  lines.forEach((l, i) => {
    if (USING.test(l)) { usings.push(`#line ${i + 1} "exercise.cs"`, l); lines[i] = ""; }
  });
  const out = [...HEADER, ...usings, `#line 1 "harness.cs"`,
    `void Check(string name, bool ok) => Console.WriteLine($"${MARK}{(ok ? "PASS" : "FAIL")} {name}");`];
  checkLines(ex).forEach((line, i) => {
    const name = checkName(line)?.literal ?? `"check ${i + 1}"`;
    out.push(`#line 1 "check${i + 1}.cs"`,
      `try { ${line} } catch (Exception e) { Console.WriteLine("${MARK}FAIL " + ${name} + " (threw " + e.GetType().Name + ")"); }`);
  });
  out.push(`#line 1 "exercise.cs"`, ...lines);
  return out.join("\n") + "\n";
}

/** Trailing spaces off each line and blank lines off the end, with \n line ends. */
export function tidy(text) {
  return String(text ?? "").replace(/\r/g, "").split("\n").map(l => l.replace(/\s+$/, "")).join("\n").replace(/\n+$/, "");
}

// path(line,col): error CS0029: text [project]
const DIAG = /(?:^|[\\/])([^\\/()]+)\((\d+),(\d+)\): (error|warning) (\w+): (.*?)(?: \[[^\]]*\])?$/;
// A message with no file position, such as "CSC : error CS5001: text".
const BARE = /^[\w.-]+ : (error|warning) (\w+): (.*?)(?: \[[^\]]*\])?$/;

/**
 * Reads one run. `r` is { code, stdout, stderr, timedOut }. Returns
 * { passed, compiled, timedOut, errors: [{line, col, code, text}], broken: [{check, text}],
 *   checks: [{name, ok, why}], expected, actual, crash }.
 */
export function parseRun(ex, r) {
  const all = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.replace(/\r/g, "").split("\n");
  const errors = [], broken = [], seen = new Set();
  const names = checkLines(ex).map((l, i) => checkName(l)?.text ?? `check ${i + 1}`);
  for (const line of all) {
    const m = DIAG.exec(line.trim());
    if (!m) {
      const b = BARE.exec(line.trim());
      if (b && !seen.has(line.trim())) { seen.add(line.trim()); errors.push({ line: null, col: null, code: b[2], text: b[3] }); }
      continue;
    }
    const [, file, ln, col, , code, text] = m;
    const key = `${file}|${ln}|${col}|${code}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const c = /^check(\d+)\.cs$/i.exec(file);
    if (c) broken.push({ check: names[+c[1] - 1] ?? `check ${c[1]}`, code, text });
    else if (/^exercise\.cs$/i.test(file)) errors.push({ line: +ln, col: +col, code, text });
    else errors.push({ line: null, col: null, code, text: `${file}: ${text}` });
  }
  const out = { passed: false, compiled: errors.length === 0 && broken.length === 0, timedOut: Boolean(r.timedOut),
    errors, broken, checks: [], expected: null, actual: null, crash: null };
  if (out.timedOut || !out.compiled) return out;
  // A build that failed without a message we could read: show the end of what it printed.
  if (r.code !== 0 && /build failed/i.test(all.join("\n"))) {
    out.compiled = false;
    out.errors.push({ line: null, col: null, code: "", text: tidy(all.join("\n")).split("\n").slice(-6).join("\n") });
    return out;
  }
  const stdout = String(r.stdout ?? "").replace(/\r/g, "").split("\n");
  if (r.code !== 0) out.crash = tidy(r.stderr || stdout.join("\n")).split("\n").slice(0, 8).join("\n") || `exited with code ${r.code}`;
  if (ex.kind === "program") {
    out.expected = tidy(ex.expected);
    out.actual = tidy(stdout.filter(l => !l.startsWith(MARK)).join("\n"));
    out.passed = r.code === 0 && out.actual === out.expected;
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
  out.passed = r.code === 0 && out.checks.length > 0 && out.checks.every(c => c.ok);
  return out;
}
