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
  const failure = lines.find(line => !line.trimStart().startsWith("at ") && !line.startsWith("file:")) ?? "The code threw an error.";
  const details = [failure.replace(/^Error: (Check \d+ failed)/, "$1")];
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
    const { files, segments } = checkingFiles(exercise, answer);
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
      return { passed: false, kind: "result", title: "The result needs a correction", details };
    }
    const output = executed.stdout.trimEnd().slice(0, -token.length).trim();
    return { passed: true, kind: "passed", title: "Correct. Stay here or try another exercise.", details: output ? [output] : [] };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
