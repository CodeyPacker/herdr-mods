// TypeScript: the syllabus a course starts from, how code is highlighted, and how practice runs.
// Practice is type-checked strictly and run with Node by lang/typescript/run.mjs.
// Plain JavaScript with no Herdr imports, so scripts can use it too.
import { compose, parseRun, checkLines, checkName } from "./typescript/compose.js";

// The starting plan for the outline. Claude keeps what the repo shows and adds part 3 from the repo.
const SYLLABUS = `Part "basics", The language:
- How a project is put together: package.json, tsconfig.json and its strict options, ES modules, import and export, type-only imports.
- Types and inference: primitives, literal types, type annotations versus inference, any versus unknown, null and undefined, strictNullChecks, ?. and ??.
- Objects, interfaces and type aliases: optional and readonly properties, index signatures, interface versus type, structural typing.
- Functions: parameter and return types, optional and default parameters, rest parameters, overloads, arrow functions, this.
- Arrays, tuples and collections: T[], readonly arrays, tuples, Map, Set, Record, iteration.
- Classes: fields, constructors and parameter properties, access modifiers, private #fields, implements, abstract.

Part "core", Working code:
- Unions and narrowing: union types, typeof, instanceof, in, discriminated unions, exhaustive switch with never.
- Generics: generic functions and types, constraints with extends, defaults, keyof.
- Utility and mapped types: Partial, Pick, Omit, Record, ReturnType, mapped and conditional types, template literal types.
- async and Promises: async functions, await, Promise.all, typed errors, AbortSignal.
- Errors: throw, try, catch with unknown, custom Error classes, result types.
- Type guards and assertions: user-defined guards, asserts functions, satisfies, as const, non-null !.

Part "repo", How this repo is built: 3 to 6 modules on this repo's own architecture, such as its entry point and startup, configuration, routing or handlers, data access, one feature end to end, and tests. Only what is really there.`;

// What an exercise is, for the prompt that writes them.
const PRACTICE_RULES = `Each exercise is one TypeScript file the learner edits, named exercise.ts. It is type-checked with strict on (target ES2023, ES modules, the DOM lib for console, no Node types and no npm packages), then run with Node. Type errors fail the run.

Two kinds:
- "program": the learner writes statements. Pass means what it prints with console.log equals "expected", ignoring trailing spaces and blank lines at the end. Fields: id, title, kind, prompt, starter, expected, solution, concept, source.
- "checks": the learner writes types, functions or classes. "checks" is TypeScript statements, one per line, each holding exactly one call \`check("name", condition);\` with a name no other check uses. The checks run after the learner's code and can use anything it declares. Pass means every check passes. Fields: id, title, kind, prompt, starter, checks, solution, concept, source.

prompt: markdown, two to four sentences: what to write, naming the types and functions the checks expect.
starter: what the learner starts from, usually a comment saying what to write and any setup code. It must not pass as it is. It may fail to type-check, as long as it fails.
solution: a full exercise.ts that passes.
concept: a short phrase naming the feature, read as "Here is how the repo writes <concept>."`;

/** Problems with one exercise's own fields, as short sentences. Empty when it is fine. */
function checkExercise(ex) {
  const out = [];
  for (const k of ["title", "prompt", "starter", "solution", "concept"]) if (!String(ex[k] ?? "").trim()) out.push(`has no ${k}`);
  if (ex.kind === "program") {
    if (typeof ex.expected !== "string" || !ex.expected.trim()) out.push(`a "program" exercise needs "expected"`);
  } else if (ex.kind === "checks") {
    const lines = checkLines(ex);
    if (lines.length < 2) out.push(`has ${lines.length} checks, wants at least 2`);
    lines.forEach((l, i) => {
      if (!checkName(l)) out.push(`check ${i + 1} does not start with check("name", ...)`);
      if ((l.match(/\bcheck\(/g) ?? []).length !== 1) out.push(`check ${i + 1} must hold exactly one check( call`);
    });
    const names = lines.map(l => checkName(l)?.text);
    if (new Set(names).size !== names.length) out.push("two checks have the same name");
  } else out.push(`kind "${ex.kind}" is not "program" or "checks"`);
  return out;
}

/** run.mjs and the folders it may find a compiler in: its own, then Practice Range's copy. */
const runArgs = ctx => [`${ctx.modDir}/lang/typescript/run.mjs`, ...(ctx.appHome ? [`${ctx.appHome}/mods/practice-range/languages/typescript`] : [])];

export const typescript = {
  id: "typescript",
  name: "TypeScript",
  // git pathspecs for its source files. Declaration files are not code to learn from.
  sources: ["*.ts", "*.tsx", "*.mts", "*.cts", ":(exclude)*.d.ts"],
  // Editor grammar by file extension. TypeScript highlights well enough as JavaScript.
  grammar: { ts: "js", tsx: "js", mts: "js", cts: "js", js: "js", mjs: "js", json: "json" },
  syllabus: SYLLABUS,
  practice: {
    file: "exercise.ts",
    tool: "node",
    needs: "TypeScript practice needs Node.js 20 or newer on PATH, and its compiler: run npm ci in Tutor's lang/typescript folder.",
    rules: PRACTICE_RULES,
    check: checkExercise,
    compose,
    parseRun,
    /** The command that runs a composed file. `ctx` is { modDir, appHome }. */
    command: (path, ctx) => {
      const [script, ...folders] = runArgs(ctx);
      return { exe: "node", args: [script, path, ...folders] };
    },
    /** A command that exits 0 when practice can run. */
    probe: ctx => ({ exe: "node", args: [runArgs(ctx)[0], "--probe", ...runArgs(ctx).slice(1)] }),
    /** run.mjs stops the learner's program itself after 10 s, so there is nothing left to stop. */
    stop: () => null,
  },
};
