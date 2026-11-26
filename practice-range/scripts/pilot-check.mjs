// Hand out and check pilot transfer tasks. Run from any folder:
//   node practice-range/scripts/pilot-check.mjs list
//   node practice-range/scripts/pilot-check.mjs start <task> <folder>
//   node practice-range/scripts/pilot-check.mjs check <task> <file>
// Uses the TypeScript pack's own checker. Never prints a reference answer.
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkAnswer } from "../mods/practice-range/languages/typescript/runner.mjs";

const pilot = resolve(dirname(fileURLToPath(import.meta.url)), "../course-drafts/typescript/pilot");
const tasks = { "new-task": "new-task", "type-error": "type-error", debug: "debug" };
const [action, key, path] = process.argv.slice(2);

async function load(name) {
  if (!Object.hasOwn(tasks, name)) throw new Error(`Unknown pilot task: ${name}. Run list to see them.`);
  const folder = join(pilot, tasks[name]), spec = JSON.parse(await readFile(join(folder, "task.json"), "utf8"));
  return { spec, folder, declarations: await readFile(join(folder, spec.fixtures[0].declarations), "utf8") };
}

try {
  if (action === "list") {
    for (const name of Object.keys(tasks)) {
      const { spec } = await load(name);
      console.log(`${name.padEnd(11)} after module "${spec.after}" · ${spec.title}`);
    }
  } else if (action === "start" && key && path) {
    const { spec, folder, declarations } = await load(key);
    const file = resolve(path, `${key}.ts`);
    await mkdir(resolve(path), { recursive: true });
    // The prompt goes in a comment. Supplied types go in a declaration file so the editor shows the same errors as the checker.
    const header = [`// ${spec.title}`, ...spec.prompt.match(/.{1,100}(\s|$)/g).map(line => `// ${line.trim()}`),
      `// Supplied types are in ${key}.supplied.d.ts. Do not copy them here.`, ""].join("\n");
    await writeFile(file, header + "\n" + await readFile(join(folder, spec.starter), "utf8"), { flag: "wx" });
    await writeFile(resolve(path, `${key}.supplied.d.ts`), declarations);
    await writeFile(resolve(path, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: "ES2022" }, include: ["*.ts"] }, null, 2) + "\n", { flag: "w" });
    console.log(`Wrote ${file}`);
  } else if (action === "check" && key && path) {
    const { spec, declarations } = await load(key);
    const root = await mkdtemp(join(tmpdir(), "practice-range-pilot-"));
    try {
      const result = await checkAnswer(root, { id: spec.id, mode: spec.mode, rules: spec.rules, checks: spec.checks,
        typeChecks: spec.typeChecks, rejects: spec.rejects, declarations }, await readFile(resolve(path), "utf8"));
      console.log(result.passed ? "PASSED" : `NOT PASSED · ${result.title}`);
      for (const detail of result.details) console.log(detail);
      process.exitCode = result.passed ? 0 : 2;
    } finally { await rm(root, { recursive: true, force: true }); }
  } else {
    console.log("Usage: pilot-check.mjs list | start <task> <folder> | check <task> <file>");
    process.exitCode = 1;
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
