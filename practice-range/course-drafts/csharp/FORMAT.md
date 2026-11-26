# C# draft format

Everything in `../typescript/FORMAT.md` applies. This file lists only what differs for C#. Each rule below was read from the code: `languages/csharp/source.mjs`, `languages/csharp/runner.mjs`, `languages/csharp/checker/Program.cs`, `courses/loader.mjs` and `scripts/verify-course.mjs`.

## Identity and runner

| Item | C# rule |
| --- | --- |
| IDs | Course `course:cs-foundations`. Modules `course:cs-foundations/module/<key>`. Tasks `course:cs-foundations/task/<module>-<key>`. |
| Runner | `"languageId": "csharp"` and `"runner": {"registeredLanguage": "csharp", "compiler": {"name": ".NET SDK", "minimumMajor": 8}}`. The verifier accepts any installed SDK at or above that major version. |
| Files | Sources are `.cs`. A task folder holds `task.json`, `starter.cs`, `solution.cs`, `alternative.cs`, one `fixture-<id>.cs` per case and one `wrong-<name>.cs` per wrong answer. |

## Task modes

The answer is compiled inside generated code. The mode decides where it lands.

| Mode | Where the answer goes | How checks reach it |
| --- | --- | --- |
| `statements` | Inside `Practice.Run()`, a method body. | Checks run in the same method after the answer, so they read its local variables by name. |
| `members` | Inside `public static class Practice`. | Checks run in a separate `Main`, so they call `Practice.Name(...)`. |
| `types` | At the top level of the file. | Checks run in a separate `Main` and create or call the types. |

- Checks are C# boolean expressions. `checkLabels` gives one plain sentence per check, in the same order. A failed check shows its label in place of the raw expression.
- `"captureOutput": true` works in `statements` mode only. Checks then compare `__Output()`, which is the printed text with `\n` line endings and trailing whitespace removed.
- `typeChecks`, `rejects`, `moduleSources` and `workspace` are TypeScript-only. Leave them out.
- Checks in `members` and `types` mode run in a method that is not async. A check on a `Task` must block on it: `Practice.ReadAsync().GetAwaiter().GetResult() == 7`.
- `support` is an optional string of extra static members placed beside the checks in `members` and `types` mode. Use it for a helper that several checks share.

## Supplied code (fixtures)

A fixture file's text is placed after the standard `using` lines and before the answer. That position is the top level of the file, so a fixture can declare types but not variables. The learner sees each fixture as a "Case" box above the editor.

- For `members` and `types` tasks, a fixture declares the records or classes the task uses.
- For `statements` tasks that need different input values per case, a fixture declares a static class and imports its members, so the answer reads them as plain names:

```csharp
// This case supplies two whole numbers.
using static Given;

public static class Given
{
    public static int opening = 6;
    public static int arrivals = 2;
}
```

The standard `using` lines are `System`, `System.Collections.Generic`, `System.Linq`, `System.Globalization` and `System.Threading.Tasks`.

## Syntax rules

A rule names a Roslyn syntax kind and counts matching nodes inside the answer only. Fields: `kind`, `message`, and optionally `name`, `type`, `token`, `modifier` and `min` (default 1). There is no `max`, so a rule can require syntax but cannot forbid it. Example, requiring `var` on one variable:

```json
{ "kind": "VariableDeclarator", "name": "free", "type": "var", "message": "Declare free with var so the compiler infers its type." }
```

Use a rule only when the syntax is the learning goal. A failed rule reports kind `syntax` before the answer runs.

## Examples

An example is a `.cs` file of top-level statements, optionally followed by type declarations. It declares either `stdout` (the exact printed lines) or `diagnostics` such as `[{"code": 8510, "line": 4}]` for CS8510 on line 4. A diagnostics example must produce exactly the listed errors and no others. Warnings are ignored.

## Wrong-answer witnesses

| Witness kind | When it happens | What `detail` should contain |
| --- | --- | --- |
| `result` | A check is false, or the answer throws while a check runs. | `Check N failed`, or the exception type name such as `SwitchExpressionException`. |
| `compile` | The answer does not compile. | The error code, such as `CS8510`. |
| `syntax` | A syntax rule is not met. | Part of the rule's message. |

## Limits found while writing the samples

- L1: The checker compiles with nullable reference types switched off. `string?` compiles, but null-safety warnings never appear and cannot be checked. The editor project switches them on, so the learner's editor and the checker disagree.
- L2: Printed numbers use the machine's culture. A `double` such as 3.5 prints as `3,5` on some systems. Examples and output checks avoid printing fractional numbers.
- L3: Every check starts two .NET processes, so a full verifier run takes many minutes. Pass module keys while writing. A run with no keys also checks the project and readiness tasks, and it needs the manifest's `project` entry to exist.
- L4: In `members` and `types` mode the checks are compiled together with the answer. If an answer leaves out a type or member the checks name, the compiler error points at generated check code the learner cannot see. Where a task asks the learner to implement an interface or extend a class, the checks reach it through a `support` helper that casts through `object`, so a missing declaration fails at run time with a readable `InvalidCastException`.
