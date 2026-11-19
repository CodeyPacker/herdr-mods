import { test } from "node:test";
import assert from "node:assert/strict";
import { checkOperands, checkingSource } from "../mods/syntax/languages/csharp/source.mjs";
import { exceptionDetails } from "../mods/syntax/languages/csharp/runner.mjs";
import csharp from "../mods/syntax/languages/csharp/index.js";

// These run without a .NET SDK. The catalog test compiles the generated source for real.
test("C# failed checks name the values worth showing", () => {
  assert.deepEqual(checkOperands("total == 10"), ["total"]);
  assert.deepEqual(checkOperands("10 == total"), ["total"]);
  assert.deepEqual(checkOperands("x == 4 && y == 7"), ["x", "y"]);
  assert.deepEqual(checkOperands("boxed is int && (int)boxed == 5"), ["boxed", "(int)boxed"]);
  assert.deepEqual(checkOperands("result.SequenceEqual(new[] { 2, 4 })"), ["result"]);
  assert.deepEqual(checkOperands("list.Count(n => n > 2) == 3"), ["list.Count(n => n > 2)"]);
  assert.deepEqual(checkOperands("word == \"a&&b\""), ["word"]);
  assert.deepEqual(checkOperands("!enabled"), []);
  assert.deepEqual(checkOperands("name == null"), ["name"]);
});

test("reporting checks only add to the plain checks", () => {
  for (const exercise of csharp.exercises) {
    const plain = checkingSource(exercise, exercise.solution);
    const report = checkingSource(exercise, exercise.solution, { report: true });
    assert.equal(report.start, plain.start, exercise.id);
    assert.equal(report.source.slice(0, plain.end), plain.source.slice(0, plain.end), `${exercise.id}: the answer region is unchanged`);
    assert.ok(!plain.source.includes("CheckReport"), exercise.id);
  }
  const { source } = checkingSource({ checks: ["total == 10"] }, "int total = 9;", { report: true });
  assert.match(source, /if \(!\(total == 10\)\) throw new Exception\("Check 1 failed: total == 10" \+ CheckReport\.Values\(\("total", \(\) => \(object\)\(total\)\)\)\);/);
});

test(".NET exception output becomes short feedback", () => {
  assert.deepEqual(exceptionDetails("Unhandled exception. System.Exception: Check 1 failed: total == 10\nYour code returned: total = 9\n   at Practice.Run() in Exercise.cs:line 12\n   at EntryPoint.Main()\n"),
    ["Check 1 failed: total == 10", "Your code returned: total = 9"]);
  assert.deepEqual(exceptionDetails("Unhandled exception. System.DivideByZeroException: Attempted to divide by zero.\n   at Practice.Run() in Exercise.cs:line 3\n   at EntryPoint.Main()\n"),
    ["System.DivideByZeroException: Attempted to divide by zero.", "at Practice.Run() in Exercise.cs:line 3"]);
});

test("C# answers sent to scratch become top-level programs", async () => {
  const { scratchFromAnswer } = await import("../mods/syntax/languages/csharp/runner.mjs");
  assert.equal(scratchFromAnswer({}, "int total = 2 + 3;\nConsole.WriteLine(total);\n"), "int total = 2 + 3;\nConsole.WriteLine(total);\n");
  const members = scratchFromAnswer({ mode: "members" }, "public static int Twice(int n) => n * 2;");
  assert.match(members, /^\/\/ Your members[^\n]*\nConsole\.WriteLine\([^\n]*\);\n\npublic static class Practice\n\{\n    public static int Twice\(int n\) => n \* 2;\n\}\n$/);
  const types = scratchFromAnswer({ mode: "types", declarations: "public interface IShape {}" }, "public class Box : IShape {}");
  assert.ok(types.indexOf("Console.WriteLine") < types.indexOf("public class Box"), "Statements come before type declarations");
  assert.match(types, /\/\/ Supplied by the exercise:\npublic interface IShape \{\}\n$/);
});
