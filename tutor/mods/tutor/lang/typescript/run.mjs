// Type-checks and runs one composed TypeScript practice file, then prints one JSON line:
//   { compiled, errors: [{line, col, code, text}], broken: [{check, code, text}], code, stdout, stderr, timedOut }
// or { missing } when no TypeScript compiler can be found. Plain Node, no Herdr.
//   node run.mjs <file.ts> [folder with node_modules/typescript ...]
//   node run.mjs --probe [folders...]   exits 0 when a compiler is found
// The compiler is this folder's pinned copy (npm ci here), else one in the folders given.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CHECKS_START } from "./compose.js";

const RUN_TIMEOUT = 10000;
const here = dirname(fileURLToPath(import.meta.url));

/** The typescript module from the first folder that has it, or null. */
function loadTypeScript(folders) {
  for (const dir of [here, ...folders]) {
    try { return createRequire(join(dir, "noop.js"))("typescript"); } catch { /* next */ }
  }
  return null;
}

// Strict, like the C# practice, and every file is its own module so names never clash with lib.
const OPTIONS = ts => ({
  strict: true, noEmit: true, target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler, moduleDetection: ts.ModuleDetectionKind.Force,
  lib: ["lib.es2023.d.ts", "lib.dom.d.ts"], skipLibCheck: true, types: [],
});

/** Type errors as { errors, broken }: lines above CHECKS_START are the learner's, check lines carry a tag. */
export function typeErrors(ts, file) {
  const program = ts.createProgram([file], OPTIONS(ts));
  const text = readFileSync(file, "utf8").replace(/\r/g, "").split("\n");
  const start = text.indexOf(CHECKS_START);
  const errors = [], broken = [];
  for (const d of ts.getPreEmitDiagnostics(program)) {
    if (d.category !== ts.DiagnosticCategory.Error) continue;
    const message = ts.flattenDiagnosticMessageText(d.messageText, " ");
    const code = `TS${d.code}`;
    if (!d.file || d.start === undefined) { errors.push({ line: null, col: null, code, text: message }); continue; }
    const at = d.file.getLineAndCharacterOfPosition(d.start);
    const line = at.line + 1, col = at.character + 1;
    if (start < 0 || at.line < start) { errors.push({ line, col, code, text: message }); continue; }
    const tag = /\/\*@@check:(\d+)\*\/\s*$/.exec(text[at.line] ?? "");
    if (tag) broken.push({ check: Number(tag[1]), code, text: message });
    else errors.push({ line: null, col: null, code, text: `harness: ${message}` });
  }
  return { errors, broken };
}

/** Runs JavaScript in its own Node process, stopping it after RUN_TIMEOUT. */
function runJs(path) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "", stderr = "", timedOut = false;
    child.stdout.on("data", d => { if (stdout.length < 200000) stdout += d; });
    child.stderr.on("data", d => { if (stderr.length < 200000) stderr += d; });
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, RUN_TIMEOUT);
    child.on("close", code => { clearTimeout(timer); resolve({ code: timedOut ? 1 : code ?? 1, stdout, stderr, timedOut }); });
    child.on("error", e => { clearTimeout(timer); resolve({ code: 1, stdout, stderr: String(e?.message ?? e), timedOut: false }); });
  });
}

/** Strips the file's own path from a stack trace, so a crash reads as exercise.ts. */
const tidyStack = (text, path) => String(text).split(path).join("exercise");

export async function runFile(file, folders) {
  const ts = loadTypeScript(folders);
  if (!ts) return { missing: "TypeScript practice needs its compiler: run npm ci in Tutor's lang/typescript folder." };
  const { errors, broken } = typeErrors(ts, file);
  if (errors.length || broken.length) return { compiled: false, errors, broken };
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText;
  const out = file.replace(/\.ts$/, "") + ".mjs";
  writeFileSync(out, js);
  try {
    const r = await runJs(out);
    return { compiled: true, errors: [], broken: [], code: r.code, stdout: r.stdout, stderr: tidyStack(r.stderr, out.replace(/\.mjs$/, "")), timedOut: r.timedOut };
  } finally { rmSync(out, { force: true }); }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const [first, ...rest] = process.argv.slice(2);
  if (first === "--probe") process.exit(loadTypeScript(rest) ? 0 : 1);
  try { console.log(JSON.stringify(await runFile(first, rest))); }
  catch (e) { console.log(JSON.stringify({ compiled: false, errors: [{ line: null, col: null, code: "", text: `The TypeScript runner failed: ${e?.message ?? e}` }], broken: [] })); }
}
