import { mkdir, readFile, writeFile, stat, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { runProcess } from "../../process.mjs";
import { exerciseSource, legacyAnswer, checkingSource, scratchSource } from "./source.mjs";

const packDirectory = dirname(fileURLToPath(import.meta.url));
const processEnvironment = { DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1" };

function runDotnetProcess(command, args, options = {}) {
  return runProcess(command, args, { ...options, env: { ...processEnvironment, ...options.env } });
}

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
}

async function writeIfChanged(path, content) {
  try { if (await readFile(path, "utf8") === content) return; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  await writeFile(path, content);
}

export function createAnswer(exercise) { return exerciseSource(exercise); }

export function migrateAnswer(exercise, source) {
  const answer = legacyAnswer(exercise, source);
  return answer === null ? null : exerciseSource(exercise, answer);
}

export async function check(root, exercise, answer) {
  return checkAnswer(root, exercise, answer, await buildChecker(root));
}

export async function environment() {
  let result;
  try { result = await runDotnetProcess("dotnet", ["--list-sdks"]); }
  catch { throw new Error("Install a .NET SDK (8 or newer), then press Retry. The runtime alone is not enough."); }
  const versions = result.stdout.split("\n").map(line => /^(\d+)\.(\d+)\.(\d+)/.exec(line))
    .filter(Boolean).map(match => ({ major: Number(match[1]), version: match[0] })).filter(item => item.major >= 8)
    .sort((a, b) => b.major - a.major || b.version.localeCompare(a.version, undefined, { numeric: true }));
  if (!versions.length) throw new Error("Install a .NET SDK (8 or newer), then press Retry.");
  return { ...versions[0], label: `.NET SDK ${versions[0].version}` };
}

export async function buildChecker(root) {
  const sdk = await environment();
  const target = `net${sdk.major}.0`;
  const project = await readFile(join(packDirectory, "checker/Checker.csproj"), "utf8");
  const program = await readFile(join(packDirectory, "checker/Program.cs"), "utf8");
  const fingerprint = createHash("sha256").update(project + program + sdk.version).digest("hex").slice(0, 16);
  const build = join(root, "checker", fingerprint);
  const assembly = join(build, "out/Checker.dll");
  try { await stat(assembly); return { assembly, sdk, target }; } catch {}
  await mkdir(build, { recursive: true });
  await writeFile(join(build, "Checker.csproj"), project.replace("net8.0", target));
  await writeFile(join(build, "Program.cs"), program);
  // Clear package sources: the checker uses Roslyn and reference assemblies from the SDK.
  await writeFile(join(build, "NuGet.Config"), '<configuration><packageSources><clear /></packageSources></configuration>');
  await writeJson(join(build, "global.json"), { sdk: { version: sdk.version, rollForward: "disable" } });
  const result = await runDotnetProcess("dotnet", ["build", "Checker.csproj", "--configuration", "Release", "--output", "out", "--nologo", "--verbosity", "quiet"], {
    cwd: build, timeout: 120000, env: { DOTNET_CLI_HOME: build, NUGET_PACKAGES: join(build, "packages") },
  });
  if (result.code !== 0) throw new Error(`Could not prepare the C# checker.\n${result.problem || result.stdout || result.stderr}`);
  return { assembly, sdk, target };
}

export function scratchStarter() {
  return "// Scratch: write any C# and save to run it. Nothing is checked.\n// Top-level statements run first. Declare classes and records below them.\nvar greeting = \"Hello from scratch\";\nConsole.WriteLine(greeting);\n";
}

/**
 * An exercise answer as scratch code. Scratch runs top-level statements, which must come before
 * type declarations, so members are wrapped in their Practice class and types get a statement to start from.
 */
export function scratchFromAnswer(exercise, answer) {
  const body = answer.trimEnd();
  const supplied = exercise.declarations ? `\n\n// Supplied by the exercise:\n${exercise.declarations.trimEnd()}` : "";
  if (exercise.mode === "members") {
    const indented = body.split("\n").map(line => line ? `    ${line}` : line).join("\n");
    return `// Your members are in the Practice class below. Call them here to try them out.\nConsole.WriteLine("Call your Practice members above this line.");\n\npublic static class Practice\n{\n${indented}\n}${supplied}\n`;
  }
  if (exercise.mode === "types") return `// Your types are below. Create and use them here to try them out.\nConsole.WriteLine("Use your types above this line.");\n\n${body}${supplied}\n`;
  return `${body}${supplied}\n`;
}

/** Compile free-form C# as top-level statements, run it, and report what it printed. */
export async function runScratch(root, code, { timeout = 5000, expectedOutput, legacy = false } = {}) {
  const checker = await buildChecker(root);
  const directory = join(root, "checks", randomUUID());
  await mkdir(directory, { recursive: true });
  try {
    const generated = scratchSource(code, legacy);
    const file = join(directory, "Scratch.cs");
    const output = join(directory, "Attempt.dll");
    await writeFile(file, generated.source);
    await writeJson(join(directory, "request.json"), { file, output, start: generated.start, end: generated.end, rules: [], strict: legacy });
    const compiled = await runDotnetProcess("dotnet", [checker.assembly, join(directory, "request.json")], { timeout: 20000 });
    if (compiled.code !== 0) throw new Error(`The checker could not run. ${compiled.problem || compiled.stdout || compiled.stderr}`);
    const compilation = JSON.parse(compiled.stdout);
    if (!compilation.compiled) return { passed: false, kind: "compile", title: "Fix the compilation errors", details: compilation.errors };
    await writeJson(join(directory, "Attempt.runtimeconfig.json"), {
      runtimeOptions: { tfm: checker.target, framework: { name: "Microsoft.NETCore.App", version: `${checker.sdk.major}.0.0` }, rollForward: "LatestPatch" },
    });
    const executed = await runDotnetProcess("dotnet", [output], { cwd: directory, timeout });
    if (executed.problem) return { passed: false, kind: "runtime", title: "The code could not finish", details: [executed.problem] };
    const shown = typeof expectedOutput === "string" ? executed.stdout.replaceAll("\r", "").replace(/\n+$/, "") : executed.stdout.trim();
    const printed = shown ? [`Your code printed:\n${shown}`] : [];
    if (executed.code !== 0) return { passed: false, kind: "result", title: "Your code threw an exception", details: [...exceptionDetails(executed.stderr || executed.stdout).map(line => line.replaceAll("Exercise.cs", "Scratch.cs")), ...printed] };
    if (typeof expectedOutput === "string") {
      const tidy = text => text.replaceAll("\r", "").split("\n").map(line => line.trimEnd()).join("\n").replace(/\n+$/, "");
      const passed = tidy(executed.stdout) === tidy(expectedOutput);
      return { passed, kind: passed ? "passed" : "result", title: passed ? "Output matches" : "The output needs a correction",
        details: passed ? printed : [...printed, `Expected output:\n${expectedOutput}`] };
    }
    return { passed: true, kind: "output", title: "Ran your code", details: printed.length ? printed : ["Your code printed nothing. Use Console.WriteLine to see values."] };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** Tutor programs are complete top-level files, rather than snippets inside Practice.Run. */
export async function checkLegacy(root, exercise, answer) {
  if (exercise.legacy?.kind !== "program") return check(root, exercise, answer);
  const result = await runScratch(root, answer, { expectedOutput: exercise.legacy.expected, legacy: true });
  return { ...result, details: result.details.map(detail => detail.replaceAll("Scratch.cs", "Exercise.cs")) };
}

/**
 * The message of an unhandled exception, without .NET's prefix. A failed check keeps its
 * "Your code returned" line. Other exceptions add the first stack frame in Exercise.cs.
 */
export function exceptionDetails(stderr) {
  const lines = stderr.split("\n").map(line => line.trimEnd()).filter(line => line.trim());
  const start = lines.findIndex(line => line.startsWith("Unhandled exception."));
  if (start < 0) return lines.slice(0, 8);
  const stack = lines.findIndex((line, index) => index > start && /^\s+at /.test(line));
  const message = lines.slice(start, stack < 0 ? undefined : stack).slice(0, 6);
  message[0] = message[0].replace(/^Unhandled exception\. /, "").replace(/^System\.Exception: (?=Check \d+ failed)/, "");
  const frame = stack < 0 ? undefined : lines.slice(stack).find(line => /(Exercise|Scratch)\.cs/.test(line));
  return frame && !/^Check \d+ failed/.test(message[0]) ? [...message, frame.trim()] : message;
}

/** Compile a fresh snapshot, check its syntax, then execute assertions in another process. */
export async function checkAnswer(root, exercise, answer, checker, { timeout = 5000 } = {}) {
  const directory = join(root, "checks", randomUUID());
  await mkdir(directory, { recursive: true });
  try {
    const file = join(directory, "Exercise.cs");
    const output = join(directory, "Attempt.dll");
    const compile = async report => {
      const generated = checkingSource(exercise, answer, { report });
      await writeFile(file, generated.source);
      await writeJson(join(directory, "request.json"), { file, output, start: generated.start, end: generated.end, rules: exercise.rules, strict: Boolean(exercise.legacy) });
      const compiled = await runDotnetProcess("dotnet", [checker.assembly, join(directory, "request.json")], { timeout: 20000 });
      if (compiled.code !== 0) throw new Error(`The checker could not run. ${compiled.problem || compiled.stdout || compiled.stderr}`);
      return JSON.parse(compiled.stdout);
    };
    // Checks that report values capture operands in lambdas, which a few types (spans, ref
    // locals) can't allow. If that version doesn't compile, the plain checks decide.
    let compilation = await compile(true);
    if (!compilation.compiled) compilation = await compile(false);
    if (!compilation.compiled) return { passed: false, kind: "compile", title: "Fix the compilation errors", details: compilation.errors };
    if (compilation.failures.length) return { passed: false, kind: "syntax", title: "Use the requested syntax", details: compilation.failures };
    await writeJson(join(directory, "Attempt.runtimeconfig.json"), {
      runtimeOptions: { tfm: checker.target, framework: { name: "Microsoft.NETCore.App", version: `${checker.sdk.major}.0.0` }, rollForward: "LatestPatch" },
    });
    const executed = await runDotnetProcess("dotnet", [output], { cwd: directory, timeout });
    if (executed.problem) return { passed: false, kind: "runtime", title: "The code could not finish", details: [executed.problem] };
    const printed = executed.stdout.trim() ? [`Your code printed:\n${executed.stdout.trim()}`] : [];
    if (executed.code !== 0) return { passed: false, kind: "result", title: "The result needs a correction", details: [...exceptionDetails(executed.stderr || executed.stdout), ...printed] };
    return { passed: true, kind: "passed", title: "Correct. Stay here or try another exercise.", details: printed };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function prepareWorkspace(file, sdk, exercise) {
  // Editor-only project. Validation is performed against a fresh generated harness, never
  // against editable project files or assertions inside the learner's workspace.
  const legacy=exercise?.legacy ? `<OutputType>${exercise.legacy.kind==="program"?"Exe":"Library"}</OutputType><ImplicitUsings>enable</ImplicitUsings><TreatWarningsAsErrors>true</TreatWarningsAsErrors>` : "";
  await writeIfChanged(join(dirname(file), "Practice.csproj"), `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net${sdk.major}.0</TargetFramework><LangVersion>latest</LangVersion><Nullable>enable</Nullable>${legacy}</PropertyGroup></Project>`);
}
