// Course modules written in Markdown. One module.md holds what module.json holds, plus each example's code.
// node practice-range/scripts/course-markdown.mjs <module.json>   writes module.md beside it (example code inlined)
//
// Format (see COURSE_REDESIGN.md, "Module Markdown format"):
//   ---                                   front matter, one `key: value` per line
//   id: course:cs-foundations/module/x    a value starting with [ { or " is JSON, anything else is text
//   ---
//   Intro text (everything before the first ##)
//   ## Step title {kind}                  one step; kind defaults to "explanation"
//   Step text, Markdown. Plain code fences stay part of the text.
//   ```csharp example <id> [readonly] [diagnostics=[{"code":103,"line":8}]]   a runnable example, defined here
//   ```output                             right after an example: the lines it must print
//   @example <id>                         show an example defined in an earlier step
//   :::question <id> [example=<id>]       a question: prompt lines, then one choice per line:
//   - [x] text :: feedback                the [x] choice is the answer
//   :::
//   @task <id>  or  @tasks <id> <id>      place tasks (ids as in module.json, or the key after /task/)
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const COURSE_LANGUAGES = ["csharp", "typescript", "sql"];
const FRONT = ["id", "title", "requires", "outcomes", "intro", "tasks", "review", "drills", "drillGap"];

/** @param {string} value */
const frontValue = value => /^[[{"]/.test(value) ? JSON.parse(value) : value;

/**
 * Parse module.md into the module object the builder uses. Examples carry `code` instead of `source`.
 * @param {string} text
 */
export function parseModuleMarkdown(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "---") throw new Error("module.md must start with --- front matter");
  const end = lines.indexOf("---", 1);
  if (end < 0) throw new Error("module.md front matter has no closing ---");
  /** @type {Record<string, any>} */
  const module = {};
  for (const line of lines.slice(1, end)) {
    if (!line.trim()) continue;
    const at = line.indexOf(":");
    if (at < 0) throw new Error(`Front matter line needs "key: value": ${line}`);
    module[line.slice(0, at).trim()] = frontValue(line.slice(at + 1).trim());
  }
  module.steps = []; module.questions = []; module.examples = {};
  const intro = [];
  /** @type {any} */
  let step = null, text_ = [];
  const finish = () => {
    if (!step) return;
    step.text = text_.join("\n").trim();
    module.steps.push(orderStep(step));
  };
  const addExample = (/** @type {string} */ id) => {
    if (step.example === undefined && !step.examples) step.example = id;
    else { step.examples = [...(step.examples ?? [step.example]), id]; delete step.example; }
  };
  for (let i = end + 1; i < lines.length; i++) {
    const line = lines[i];
    const heading = /^## (.+?)(?: \{([a-z-]+)\})?\s*$/.exec(line);
    if (heading) { finish(); step = { kind: heading[2] ?? "explanation", title: heading[1] }; text_ = []; continue; }
    if (!step) { intro.push(line); continue; }
    const fence = /^(`{3,})(\S+) example (\S+)(.*)$/.exec(line);
    if (fence) {
      const [, ticks, lang, id, rest] = fence, code = [];
      for (i++; i < lines.length && lines[i] !== ticks; i++) code.push(lines[i]);
      /** @type {any} */
      const example = { code: code.join("\n") };
      if (!COURSE_LANGUAGES.includes(lang)) example.fence = lang;
      if (/\breadonly\b/.test(rest)) example.readOnly = true;
      const diagnostics = /\bdiagnostics=(\[.*\])/.exec(rest);
      if (diagnostics) example.diagnostics = JSON.parse(diagnostics[1]);
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      const output = /^(`{3,})output$/.exec(lines[j] ?? "");
      if (output) {
        const out = [];
        for (j++; j < lines.length && lines[j] !== output[1]; j++) out.push(lines[j]);
        example.stdout = out;
        i = j;
      }
      module.examples[id] = example;
      addExample(id);
      continue;
    }
    const ref = /^@example (\S+)\s*$/.exec(line);
    if (ref) { addExample(ref[1]); continue; }
    const task = /^@(task|tasks) (.+)$/.exec(line);
    if (task) {
      const ids = task[2].trim().split(/\s+/).map(id => id.includes("/") ? id : `${module.id.split("/module/")[0]}/task/${id}`);
      if (task[1] === "task") step.task = ids[0]; else step.tasks = [...(step.tasks ?? []), ...ids];
      continue;
    }
    const question = /^:::question (\S+)(?: example=(\S+))?\s*$/.exec(line);
    if (question) {
      /** @type {any} */
      const q = { id: question[1] };
      if (question[2]) q.example = question[2];
      const prompt = [], choices = [];
      for (i++; i < lines.length && lines[i] !== ":::"; i++) {
        const choice = /^- \[( |x)\] (.*?) :: (.*)$/.exec(lines[i]);
        if (choice) { if (choice[1] === "x") q.answer = choices.length; choices.push({ text: choice[2], feedback: choice[3] }); }
        else if (!choices.length) prompt.push(lines[i]);
        else throw new Error(`Question ${q.id}: text after the choices: ${lines[i]}`);
      }
      if (q.answer === undefined) throw new Error(`Question ${q.id} marks no answer with [x]`);
      q.prompt = prompt.join("\n").trim(); q.choices = choices;
      module.questions.push(orderQuestion(q));
      step.questions = [...(step.questions ?? []), q.id];
      continue;
    }
    text_.push(line);
  }
  finish();
  module.intro = intro.join("\n").trim();
  return orderModule(module);
}

/** Key order as in module.json, so a converted module compares equal. */
function orderModule(/** @type {any} */ module) {
  /** @type {any} */
  const out = {};
  for (const key of ["id", "title", "requires", "outcomes", "intro", "steps", "questions", "examples", "tasks", "review", "drills", "drillGap"]) if (module[key] !== undefined) out[key] = module[key];
  for (const key of Object.keys(module)) if (!(key in out)) out[key] = module[key];
  return out;
}
const orderStep = (/** @type {any} */ s) => pick(s, ["kind", "title", "text", "example", "examples", "questions", "task", "tasks"]);
const orderQuestion = (/** @type {any} */ q) => pick(q, ["id", "example", "prompt", "answer", "choices"]);
/** @param {any} value @param {string[]} keys */
function pick(value, keys) { /** @type {any} */ const out = {}; for (const key of keys) if (value[key] !== undefined) out[key] = value[key]; return out; }

/**
 * Write a module object (examples with `code`) as module.md.
 * @param {any} module
 */
export function moduleToMarkdown(module) {
  const out = ["---"];
  for (const key of FRONT) if (key !== "intro" && module[key] !== undefined) out.push(`${key}: ${typeof module[key] === "string" && !/^[[{"]/.test(module[key]) ? module[key] : JSON.stringify(module[key])}`);
  for (const key of Object.keys(module)) if (!FRONT.includes(key) && !["steps", "questions", "examples", "codeFence"].includes(key)) out.push(`${key}: ${JSON.stringify(module[key])}`);
  out.push("---", "", module.intro, "");
  const shown = new Set(), prefix = `${module.id.split("/module/")[0]}/task/`;
  const short = (/** @type {string} */ id) => id.startsWith(prefix) && !id.slice(prefix.length).includes("/") ? id.slice(prefix.length) : id;
  for (const step of module.steps) {
    out.push(`## ${step.title}${step.kind === "explanation" ? "" : ` {${step.kind}}`}`, "", step.text, "");
    for (const id of [...(step.example !== undefined ? [step.example] : []), ...(step.examples ?? [])]) {
      if (shown.has(id)) { out.push(`@example ${id}`, ""); continue; }
      shown.add(id);
      const example = module.examples[id];
      const ticks = "`".repeat([...example.code.matchAll(/`+/g)].reduce((n, m) => Math.max(n, m[0].length + 1), 3));
      const flags = [example.readOnly ? "readonly" : "", example.diagnostics ? `diagnostics=${JSON.stringify(example.diagnostics)}` : ""].filter(Boolean).join(" ");
      out.push(`${ticks}${example.fence ?? module.codeFence ?? "csharp"} example ${id}${flags ? ` ${flags}` : ""}`, example.code, ticks, "");
      if (example.stdout) out.push("```output", ...example.stdout, "```", "");
    }
    for (const id of step.questions ?? []) {
      const q = module.questions.find((/** @type {any} */ q) => q.id === id);
      out.push(`:::question ${q.id}${q.example ? ` example=${q.example}` : ""}`, q.prompt,
        ...q.choices.map((/** @type {any} */ c, /** @type {number} */ n) => `- [${n === q.answer ? "x" : " "}] ${c.text} :: ${c.feedback}`), ":::", "");
    }
    if (step.task) out.push(`@task ${short(step.task)}`, "");
    if (step.tasks) out.push(`@tasks ${step.tasks.map(short).join(" ")}`, "");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/**
 * Read a module from module.json or module.md. Examples always carry `code`.
 * @param {string} path @param {(folder: string, path: string) => Promise<string>} read reads a file relative to a folder
 */
export async function readModule(path, read) {
  const folder = dirname(path);
  if (path.endsWith(".md")) return parseModuleMarkdown(await read(folder, path.split("/").pop() ?? path));
  const module = JSON.parse(await read(folder, path.split("/").pop() ?? path));
  for (const [id, example] of Object.entries(module.examples)) {
    const { source, ...rest } = /** @type {any} */ (example);
    module.examples[id] = { ...rest, code: await read(folder, source.path) };
  }
  return module;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = resolve(process.argv[2] ?? "");
  if (!path.endsWith("module.json")) throw new Error("Usage: course-markdown.mjs <module.json>");
  const module = await readModule(path, (folder, file) => readFile(join(folder, file), "utf8"));
  const language = path.includes("/typescript/") ? "typescript" : path.includes("/sql/") ? "sql" : "csharp";
  const text = moduleToMarkdown({ ...module, codeFence: language });
  const back = parseModuleMarkdown(text);
  if (!isDeepStrictEqual(back, module)) throw new Error("The Markdown does not convert back to the same module. Not written.");
  await writeFile(join(dirname(path), "module.md"), text);
  console.log(`Wrote ${join(dirname(path), "module.md")}`);
}
