// Learners edit only their answer. Checks build the surrounding files separately.

// The pack targets Node.js 20 without Node or DOM type packages. These globals cover the
// small runtime surface the exercises use, for both the checker and the editor workspace.
export const globals = `declare var console: {
  log(...values: unknown[]): void;
  error(...values: unknown[]): void;
  warn(...values: unknown[]): void;
  info(...values: unknown[]): void;
};
declare function setTimeout(callback: () => void, milliseconds?: number): unknown;
declare function clearTimeout(handle: unknown): void;
declare function setInterval(callback: () => void, milliseconds?: number): unknown;
declare function clearInterval(handle: unknown): void;
declare function queueMicrotask(callback: () => void): void;
`;

// Trusted helpers. The check file imports them, so they evaluate before any answer code.
export const harness = `const logged: string[] = [];
const write = console.log;
console.log = (...values: unknown[]) => {
  logged.push(values.map(value => typeof value === "string" ? value : JSON.stringify(value) ?? String(value)).join(" "));
  write(...values);
};

export function __logs(): string[] { return logged.slice(); }

export function __same(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;
  if (typeof actual !== "object" || typeof expected !== "object" || actual === null || expected === null) return false;
  if (actual instanceof Map && expected instanceof Map) return __same([...actual], [...expected]);
  if (actual instanceof Set && expected instanceof Set) return __same([...actual], [...expected]);
  if (Array.isArray(actual) !== Array.isArray(expected)) return false;
  const left = actual as Record<string, unknown>, right = expected as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && __same(left[key], right[key]));
}

export function __throws(action: () => unknown): boolean {
  try { action(); return false; } catch { return true; }
}

export async function __rejects(promise: Promise<unknown>): Promise<boolean> {
  try { await promise; return false; } catch { return true; }
}

/** A value as readable text for check feedback: strings quoted, Maps and Sets expanded. */
export function __show(value: unknown): string {
  const seen = new WeakSet<object>();
  const text = (item: unknown): string => {
    if (typeof item === "string") return JSON.stringify(item);
    if (typeof item === "bigint") return \`\${item}n\`;
    if (typeof item === "function") return \`[Function \${item.name || "anonymous"}]\`;
    if (typeof item === "number") return Object.is(item, -0) ? "-0" : String(item);
    if (item === null || typeof item !== "object") return String(item);
    if (seen.has(item)) return "[Circular]";
    seen.add(item);
    if (item instanceof Promise) return "Promise { pending or settled: use await }";
    if (item instanceof Date) return \`Date(\${Number.isNaN(item.getTime()) ? "Invalid" : item.toISOString()})\`;
    if (item instanceof Error) return \`\${item.name}: \${item.message}\`;
    if (item instanceof Map) return \`Map(\${item.size}) { \${[...item].map(([key, entry]) => \`\${text(key)} => \${text(entry)}\`).join(", ")} }\`;
    if (item instanceof Set) return \`Set(\${item.size}) { \${[...item].map(text).join(", ")} }\`;
    if (Array.isArray(item)) return \`[\${item.map(text).join(", ")}]\`;
    const entries = Object.entries(item).map(([key, entry]) => \`\${/^[A-Za-z_$][\\w$]*$/.test(key) ? key : JSON.stringify(key)}: \${text(entry)}\`);
    const type = (item as { constructor?: { name?: string } }).constructor;
    const name = type && type !== Object && type.name ? \`\${type.name} \` : "";
    return entries.length ? \`\${name}{ \${entries.join(", ")} }\` : \`\${name}{}\`;
  };
  const shown = text(value);
  return shown.length > 300 ? \`\${shown.slice(0, 297)}...\` : shown;
}

export function __fail(index: number, text: string, actual?: string): never {
  throw new Error(\`Check \${index} failed: \${text}\` + (actual === undefined ? "" : \`\\nYour code returned: \${actual}\`));
}

export type __Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
export type __Extends<A, B> = [A] extends [B] ? true : false;
export type __Assert<T extends true> = T;
`;

const helperNames = ["__logs", "__same", "__show", "__throws", "__rejects", "__fail", "type __Equal", "type __Extends", "type __Assert"];
const importHelpers = `import { ${helperNames.join(", ")} } from "./harness.js";`;

/** Check text shown to learners, without the helper prefix. */
export function displayCheck(text) {
  return text.replace(/\b__(?=[A-Za-z])/g, "");
}

export function exerciseSource(exercise, answer = exercise.starter.trimStart()) {
  return answer.endsWith("\n") ? answer : `${answer}\n`;
}

function lineCount(text) { return text.split("\n").length; }

/**
 * Build the in-memory files for one check. Every segment records its 0-based line range
 * in check.ts, so diagnostics can be reported against the learner's own line numbers.
 * Script exercises place the answer inside check.ts. Module exercises keep the answer in
 * Exercise.ts, and the checks import it as `answer`.
 */
export function checkingFiles(exercise, answer, captures = []) {
  const segments = [];
  let line = 0;
  const add = (kind, text, index) => {
    segments.push({ kind, index, start: line, end: line + lineCount(text) });
    line += lineCount(text);
    return text;
  };
  const parts = [add("setup", importHelpers)];
  if (exercise.mode === "module") parts.push(add("setup", 'import * as answer from "./Exercise.js";'));
  if (exercise.declarations) parts.push(add("supplied", exercise.declarations.trimEnd()));
  // A hoisted function sees declared types. At top level, typeof would see the answer's narrowing.
  if (exercise.typeChecks?.length) {
    parts.push(add("setup", "function __typeChecks() {"));
    exercise.typeChecks.forEach((check, index) => parts.push(add("type", `type __TypeCheck${index + 1} = __Assert<${check}>;`, index + 1)));
    parts.push(add("setup", "}"));
  }
  if (exercise.mode !== "module") parts.push(add("answer", answer.replace(/\n$/, "")));
  (exercise.checks ?? []).forEach((check, index) =>
    parts.push(add("check", checkStatement(check, index + 1, captures[index]), index + 1)));
  (exercise.rejects ?? []).forEach((code, index) =>
    parts.push(add("reject", `function __rejected${index + 1}() {\n// @ts-expect-error\n${code};\n}`, index + 1)));
  parts.push(add("setup", "export {};"));
  const files = { "globals.d.ts": exercise.legacy?.source === "tutor" ? "" : globals, "harness.ts": harness, "check.ts": parts.join("\n") + "\n", ...exercise.modules };
  if (exercise.mode === "module") files["Exercise.ts"] = answer;
  return { files, segments };
}

/**
 * One check as a statement. With a capture, the value the answer produced is computed once,
 * compared, and shown on failure: `{ left, operator, right }` for a comparison where `left`
 * is the answer's side, or `{ actual, expected }` for __same(actual, expected).
 */
function checkStatement(check, index, capture) {
  const text = JSON.stringify(displayCheck(check));
  if (capture?.operator) {
    const test = capture.swapped ? `(${capture.right}) ${capture.operator} __actual` : `__actual ${capture.operator} (${capture.right})`;
    return `{ const __actual = (${capture.left}); if (!(${test})) __fail(${index}, ${text}, __show(__actual)); }`;
  }
  if (capture?.expected) return `{ const __actual = (${capture.actual}); if (!__same(__actual, ${capture.expected})) __fail(${index}, ${text}, __show(__actual)); }`;
  return `if (!(${check})) __fail(${index}, ${text});`;
}

/** Locate a 0-based check.ts line. Answer lines become 1-based Exercise.ts lines. */
export function locateLine(segments, line) {
  const segment = segments.find(item => line >= item.start && line < item.end);
  if (!segment) return { kind: "setup" };
  return segment.kind === "answer" ? { kind: "answer", line: line - segment.start + 1 } : segment;
}

export const workspaceConfig = JSON.stringify({
  compilerOptions: {
    target: "ES2022", module: "ESNext", moduleResolution: "bundler", lib: ["ES2023"],
    strict: true, noEmit: true, types: [], skipLibCheck: true,
  },
  include: ["*.ts"],
}, null, 2) + "\n";

/** Editor files beside Exercise.ts. Supplied code is a global script the answer can use. */
export function workspaceFiles(exercise) {
  const legacy=exercise.legacy?.source === "tutor";
  const config=legacy?JSON.parse(workspaceConfig):null;
  if(config) { config.compilerOptions.target="ES2023"; config.compilerOptions.lib=["ES2023","DOM"]; config.compilerOptions.moduleDetection="force"; }
  const files = { "tsconfig.json": config?JSON.stringify(config,null,2)+"\n":workspaceConfig, "globals.d.ts": legacy?"":globals, ...exercise.modules };
  if (exercise.declarations) files["supplied.ts"] = `// Supplied by the exercise. Checks add this code automatically.\n${exercise.declarations.trimEnd()}\n`;
  return files;
}
