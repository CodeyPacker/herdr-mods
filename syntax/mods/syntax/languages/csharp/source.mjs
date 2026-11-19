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

/** Scratch code compiles as top-level statements, which may be followed by type declarations. */
export function scratchSource(code) {
  const prefix = `${imports}#line 1 "Scratch.cs"\n`;
  return { source: `${prefix}${code}\n`, start: prefix.length, end: prefix.length + code.length };
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

// Trusted helper for failed checks: formats the values the answer produced. Each value is read
// through a lambda inside a try, so a value that throws is reported instead of hiding the failure.
const reporter = `
internal static class CheckReport
{
    public static string Values(params (string Name, Func<object> Value)[] values)
    {
        if (values.Length == 0) return "";
        return "\\nYour code returned: " + string.Join(", ", values.Select(item => item.Name + " = " + Read(item.Value)));
    }

    private static string Read(Func<object> value)
    {
        try { return Show(value(), 0); }
        catch (Exception error) { return "(threw " + error.GetType().Name + ")"; }
    }

    private static string Show(object value, int depth) => value switch
    {
        null => "null",
        string text => "\\"" + text + "\\"",
        char letter => "'" + letter + "'",
        bool flag => flag ? "true" : "false",
        IFormattable formattable => formattable.ToString(null, CultureInfo.InvariantCulture),
        System.Collections.IDictionary map when depth < 3 => "{ " + string.Join(", ", map.Keys.Cast<object>().Take(20).Select(key => Show(key, depth + 1) + ": " + Show(map[key], depth + 1))) + " }",
        System.Collections.IEnumerable items when depth < 3 => "[" + string.Join(", ", items.Cast<object>().Take(20).Select(item => Show(item, depth + 1))) + "]",
        _ => value.ToString() ?? ""
    };
}
`;

const escape = text => text.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

/**
 * The parts of a check whose values are worth showing on failure: comparison operands that
 * aren't literals, the subject of an `is` test, and the receiver of SequenceEqual or SetEquals.
 * A text scan, not a parser: anything it can't place is simply not shown.
 */
export function checkOperands(check) {
  const split = (text, separators) => {
    const parts = [];
    let depth = 0, quote = "", last = 0;
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (quote) { if (char === "\\") index++; else if (char === quote) quote = ""; continue; }
      if (char === '"' || char === "'") { quote = char; continue; }
      if ("([{".includes(char)) depth++;
      else if (")]}".includes(char)) depth--;
      else if (depth === 0) {
        const separator = separators.find(item => text.startsWith(item, index) && !(item === "=" && /[=!<>]/.test(text[index - 1] ?? "")));
        if (separator) { parts.push(text.slice(last, index), separator); index += separator.length - 1; last = index + 1; }
      }
    }
    parts.push(text.slice(last));
    return parts.map(part => part.trim());
  };
  const unwrap = text => {
    let value = text.trim();
    while (value.startsWith("!")) value = value.slice(1).trim();
    while (value.startsWith("(") && value.endsWith(")") && split(value.slice(1, -1), []).length === 1 && balanced(value.slice(1, -1))) value = value.slice(1, -1).trim();
    return value;
  };
  const balanced = text => { let depth = 0; for (const char of text) { if (char === "(") depth++; if (char === ")" && --depth < 0) return false; } return depth === 0; };
  const literal = text => /^(-?[\d.]+[a-zA-Z]?|".*"|'.*'|true|false|null|new\b.*|default)$/.test(text);
  const operands = [];
  const conditions = split(check, ["&&", "||"]).filter((_, index) => index % 2 === 0);
  for (const condition of conditions) {
    const part = unwrap(condition);
    const typeTest = split(part, [" is "]);
    if (typeTest.length > 1) { operands.push(typeTest[0]); continue; }
    const compared = split(part, ["==", "!=", "<=", ">=", " < ", " > "]);
    if (compared.length === 3) { operands.push(...[compared[0], compared[2]].filter(side => !literal(side))); continue; }
    const call = /^(.+)\.(SequenceEqual|SetEquals)\((.*)\)$/s.exec(part);
    if (call && balanced(call[1]) && balanced(call[3])) operands.push(call[1].trim());
  }
  return [...new Set(operands.filter(operand => operand && balanced(operand)))].slice(0, 4);
}

function assertion(check, index, report) {
  const message = `"Check ${index} failed: ${escape(check)}"`;
  const values = report ? checkOperands(check).map(operand => `("${escape(operand)}", () => (object)(${operand}))`) : [];
  return `if (!(${check})) throw new Exception(${message}${values.length ? ` + CheckReport.Values(${values.join(", ")})` : ""});`;
}

/** With `report`, failed checks also show the values the answer produced. */
export function checkingSource(exercise, answer, { report = false } = {}) {
  const { before, after } = scaffold(exercise);
  const prefix = `${before}#line 1 "Exercise.cs"\n`;
  const start = prefix.length;
  const end = start + answer.length;
  let source = `${prefix}${answer}\n#line default\n`;
  const assertions = exercise.checks.map((check, index) => assertion(check, index + 1, report)).join("\n");
  if (exercise.mode !== "members" && exercise.mode !== "types") {
    source += `${assertions}${after}`;
    source += "\ninternal static class EntryPoint { public static void Main() { Practice.Run(); } }\n";
  } else {
    source += `${after}\ninternal static class EntryPoint { public static void Main() {\n${assertions}\n}\n${exercise.support ?? ""}\n} \n`;
  }
  if (report) source += reporter;
  return { source, start, end };
}
