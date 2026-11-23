import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { runProcess } from "../../process.mjs";
import { exerciseSource, checkingFiles, workspaceFiles, locateLine } from "./source.mjs";
import { loadTypeScript, pinnedVersion, installedVersion, installMessage, answerSyntaxErrors, typeCheck, ruleFailures } from "./compiler.mjs";

async function writeIfChanged(path, content) {
  try { if (await readFile(path, "utf8") === content) return; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  await writeFile(path, content);
}

export function createAnswer(exercise) { return exerciseSource(exercise); }

// TypeScript answers have always been plain snippets. Existing files are never rewritten.
export function migrateAnswer() { return null; }

export async function environment() {
  const node = process.versions.node;
  if (Number(node.split(".")[0]) < 20) throw new Error(`TypeScript checks run on Node.js 20 or newer. This is Node.js ${node}.`);
  const version = await pinnedVersion();
  if (await installedVersion() !== version) throw new Error(installMessage(version));
  return { version: `TypeScript ${version}` };
}

/** Editor files beside Exercise.ts. Unchanged files are left alone so language servers keep running. */
export async function prepareWorkspace(file, _runtime, exercise) {
  for (const [name, content] of Object.entries(workspaceFiles(exercise))) await writeIfChanged(join(dirname(file), name), content);
}

export async function check(root, exercise, answer) {
  return checkAnswer(root, exercise, answer);
}

export function scratchStarter() {
  return "// Scratch: write any TypeScript and save to run it. Nothing is checked.\nconst greeting: string = \"Hello from scratch\";\nconsole.log(greeting);\n";
}

/** An exercise answer as scratch code. Supplied code comes first, so the answer's references resolve. */
export function scratchFromAnswer(exercise, answer) {
  const supplied = exercise.declarations ? `// Supplied by the exercise:\n${exercise.declarations.trimEnd()}\n\n` : "";
  const fixtures = exercise.mode === "module" || exercise.modules ? "// This exercise imports local modules, which scratch doesn't have. Inline what you need.\n" : "";
  return `${fixtures}${supplied}${answer.trimEnd()}\n\n// Try it out:\n`;
}

/** Type-check and run free-form code with no checks, and report what it printed. */
export async function runScratch(root, source) {
  const checked = await checkAnswer(root, { id: "scratch", checks: [], rules: [], mode: "script" }, source);
  const result = { ...checked, details: checked.details.map(detail => detail.replaceAll("Exercise.ts", "Scratch.ts")) };
  if (result.passed) return { passed: true, kind: "output", title: "Ran your code", details: result.details.length ? result.details : ["Your code printed nothing. Use console.log to see values."] };
  if (result.kind === "result") return { ...result, title: "Your code threw an error" };
  return result;
}

// The launcher is trusted. It prints a fresh token only after every check has finished.
const launcher = `const token = process.env.SYNTAX_CHECK_TOKEN;
delete process.env.SYNTAX_CHECK_TOKEN;
try { await import("./check.js"); }
catch (error) {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
}
process.stdout.write("\\n" + token + "\\n");
`;

/** Turn a source-mapped stack into the learner's message and line. */
function runtimeDetails(output, segments) {
  const lines = output.split("\n").map(line => line.trimEnd()).filter(Boolean);
  const start = lines.findIndex(line => !line.trimStart().startsWith("at ") && !line.startsWith("file:"));
  const failure = start < 0 ? "The code threw an error." : lines[start];
  const details = [failure.replace(/^Error: (Check \d+ failed)/, "$1")];
  // A failed check's message continues with the value the answer produced.
  for (let index = start + 1; start >= 0 && index < lines.length && /^Your code returned: /.test(lines[index]); index++) details.push(lines[index]);
  for (const line of lines) {
    const answerFrame = /Exercise\.ts:(\d+):(\d+)/.exec(line);
    const checkFrame = /check\.ts:(\d+):(\d+)/.exec(line);
    if (answerFrame) { details.push(`at Exercise.ts:${answerFrame[1]}:${answerFrame[2]}`); break; }
    if (checkFrame) {
      const place = locateLine(segments, Number(checkFrame[1]) - 1);
      if (place.kind === "answer") { details.push(`at Exercise.ts:${place.line}:${checkFrame[2]}`); break; }
    }
  }
  return details;
}

const comparisons = new Set(["===", "!==", "==", "!=", "<", "<=", ">", ">="]);
const literalKinds = ["NumericLiteral", "StringLiteral", "NoSubstitutionTemplateLiteral", "TrueKeyword", "FalseKeyword", "NullKeyword", "BigIntLiteral"];

/**
 * For each check, the side whose value the answer produced, so a failure can show it. Only a
 * plain comparison or __same(actual, expected) qualifies; anything else keeps its original form.
 */
export function checkCaptures(ts, checks) {
  const literal = node => literalKinds.some(kind => node.kind === ts.SyntaxKind[kind])
    || (ts.isIdentifier(node) && node.text === "undefined")
    || (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand));
  return checks.map(check => {
    const file = ts.createSourceFile("check.ts", check, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    if (file.statements.length !== 1 || !ts.isExpressionStatement(file.statements[0])) return null;
    let expression = file.statements[0].expression;
    const text = node => check.slice(node.getStart(file), node.getEnd());
    if (ts.isBinaryExpression(expression)) {
      const operator = expression.operatorToken.getText(file);
      if (!comparisons.has(operator)) return null;
      const { left, right } = expression;
      if (literal(left) && literal(right)) return null;
      return literal(left) ? { left: text(right), operator, right: text(left), swapped: true } : { left: text(left), operator, right: text(right) };
    }
    if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && expression.expression.text === "__same" && expression.arguments.length === 2) {
      return { actual: text(expression.arguments[0]), expected: text(expression.arguments[1]) };
    }
    return null;
  });
}

/** Type-check a fresh snapshot, check its syntax, then run the trusted checks in another process. */
export async function checkAnswer(root, exercise, answer, { timeout = 5000 } = {}) {
  const ts = await loadTypeScript();
  const syntaxErrors = answerSyntaxErrors(ts, answer);
  if (syntaxErrors.length) return { passed: false, kind: "compile", title: "Fix the compilation errors", details: syntaxErrors.slice(0, 8) };
  if (/@ts-(ignore|expect-error|nocheck)/.test(answer)) {
    return { passed: false, kind: "syntax", title: "Use the requested syntax", details: ["Remove @ts-ignore, @ts-expect-error, and @ts-nocheck. The checks need the compiler's real feedback."] };
  }
  const directory = join(root, "checks", randomUUID());
  await mkdir(directory, { recursive: true });
  try {
    const { files, segments } = checkingFiles(exercise, answer, checkCaptures(ts, exercise.checks ?? []));
    for (const [name, content] of Object.entries(files)) await writeFile(join(directory, name), content);
    const compiled = typeCheck(ts, directory, exercise, segments);
    if (compiled.internal.length) throw new Error(`The TypeScript checker could not prepare this exercise.\n${compiled.internal.join("\n")}`);
    if (compiled.answerErrors.length) return { passed: false, kind: "compile", title: "Fix the compilation errors", details: compiled.answerErrors.slice(0, 8) };
    const missing = ruleFailures(ts, answer, exercise.rules);
    if (missing.length) return { passed: false, kind: "syntax", title: "Use the requested syntax", details: missing };
    if (compiled.checkFailures.length) return { passed: false, kind: "types", title: "The types need a correction", details: compiled.checkFailures.slice(0, 8) };
    const emitted = compiled.program.emit();
    if (emitted.emitSkipped) throw new Error("The TypeScript checker could not emit JavaScript.");
    await writeFile(join(directory, "package.json"), '{ "type": "module" }\n');
    await writeFile(join(directory, "run.mjs"), launcher);
    const token = randomUUID();
    const executed = await runProcess(process.execPath, ["--enable-source-maps", "--max-old-space-size=256", "run.mjs"], {
      cwd: directory, timeout, env: { SYNTAX_CHECK_TOKEN: token },
    });
    if (executed.problem) return { passed: false, kind: "runtime", title: "The code could not finish", details: [executed.problem] };
    if (executed.code === 13) return { passed: false, kind: "runtime", title: "The code could not finish", details: ["A promise never settled. Check for an await that never finishes or a missing resolve call."] };
    const finished = executed.code === 0 && executed.stdout.trimEnd().endsWith(token);
    if (!finished) {
      const details = executed.stderr.trim() ? runtimeDetails(executed.stderr, segments) : ["The code stopped before the checks finished."];
      const printed = executed.stdout.trim();
      return { passed: false, kind: "result", title: "The result needs a correction", details: printed ? [...details, `Your code printed:\n${printed}`] : details };
    }
    const output = executed.stdout.trimEnd().slice(0, -token.length).trim();
    return { passed: true, kind: "passed", title: "Correct. Stay here or try another exercise.", details: output ? [`Your code printed:\n${output}`] : [] };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
