// Learners edit only their answer. The compiler receives the surrounding setup separately.
const imports = `using System;
using System.Collections.Generic;
using System.Linq;
using System.Globalization;
using System.Threading.Tasks;
`;

function scaffold(exercise) {
  const declarations = exercise.declarations ? `\n${exercise.declarations}\n` : "";
  const setup = `${imports}${declarations}\n`;
  if (exercise.mode === "types") return { before: setup, after: "\n" };
  if (exercise.mode === "members") return { before: `${setup}public static class Practice\n{\n`, after: "\n}\n" };
  return { before: `${setup}public static class Practice\n{\n    public static void Run()\n    {\n`, after: "\n    }\n}\n" };
}

export function exerciseSource(exercise, answer = exercise.starter.trimStart()) {
  return answer.endsWith("\n") ? answer : `${answer}\n`;
}

// Recognize only the exact old scaffold, so migration never discards edits to supplied setup.
export function legacyAnswer(exercise, source) {
  const normalized = source.replaceAll("\r\n", "\n");
  const { before, after } = scaffold(exercise);
  const prefix = `${before}// <answer>\n`;
  const suffix = `\n// </answer>${after}`;
  if (!normalized.startsWith(prefix) || !normalized.endsWith(suffix)) return null;
  return normalized.slice(prefix.length, -suffix.length);
}

export function checkingSource(exercise, answer) {
  const { before, after } = scaffold(exercise);
  const prefix = `${before}#line 1 "Exercise.cs"\n`;
  const start = prefix.length;
  const end = start + answer.length;
  let source = `${prefix}${answer}\n#line default\n`;
  const assertions = exercise.checks.map((check, index) =>
    `if (!(${check})) throw new Exception("Check ${index + 1} failed: ${check.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}");`).join("\n");
  if (exercise.mode !== "members" && exercise.mode !== "types") {
    source += `${assertions}${after}`;
    source += "\ninternal static class EntryPoint { public static void Main() { Practice.Run(); } }\n";
  } else {
    source += `${after}\ninternal static class EntryPoint { public static void Main() {\n${assertions}\n}\n${exercise.support ?? ""}\n} \n`;
  }
  return { source, start, end };
}
