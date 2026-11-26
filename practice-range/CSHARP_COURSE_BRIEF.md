# C# course brief

Build a C# foundations course pack for Practice Range. Work in this repository on branch `wip/learning-scope`. The TypeScript course is the model to follow. Copy its format and its quality bar, not its lesson sequence.

## Read first

1. `practice-range/LEARNING_SCOPE.md` for decisions D1–D8, the course pack contract (C1–C7) and the release checks (V1–V8). All courses live inside Practice Range. Tutor is not involved.
2. `practice-range/LEARNING_PROGRESS.md` for what exists and how it was verified.
3. `practice-range/course-drafts/typescript/`: `FORMAT.md`, `OUTLINE.md`, `VALIDATION.md`, `manifest.json`, two modules (`modules/functions/` and `modules/tagged/`), `project/project.json` with one checkpoint task, and `readiness/r1/`.
4. `practice-range/scripts/verify-course.mjs` and `practice-range/scripts/build-course.mjs`. Both take a language argument.
5. `practice-range/mods/practice-range/courses/loader.mjs` (`validatePack`), and the C# runner: `languages/csharp/runner.mjs` and `source.mjs`.
6. `practice-range/mods/practice-range/languages/csharp/content/` for drill IDs (`topic/exercise`) to link from lessons.

Inspect the current code before relying on this brief. If it disagrees with the code, the code wins.

## Learner and audience

Two entry paths, like TypeScript: `beginner` (new to programming) and `experienced` (knows another language). Both must work (D4).

The first tester is the project owner, who knows TypeScript well and will take the experienced path. Make that path strong:
- Readiness checks R1–R4 that let a TypeScript developer skip what they already know.
- Short "Coming from TypeScript" notes in explanation text where C# differs in ways that cause real mistakes. Examples: value versus reference types, structs, nullable reference types and `?`, `int` versus `double` division, `List<T>` and arrays, LINQ versus array methods, `Task` versus `Promise`, records and `with`, properties, `switch` expressions and pattern matching, interfaces versus structural typing, exceptions.
- Keep these notes short and optional. Never assume TypeScript knowledge on the beginner path.

## Format in C#

Everything in `course-drafts/typescript/FORMAT.md` applies. C# differences:

| Item | C# rule |
| --- | --- |
| Course ID | `course:cs-foundations`. Module IDs `course:cs-foundations/module/<key>`, task IDs `course:cs-foundations/task/<key>`. |
| Language and runner | `"languageId": "csharp"`, `"runner": {"registeredLanguage": "csharp", "compiler": {"name": ".NET SDK", "minimumMajor": 8}}`. |
| Task `mode` | `statements` (answer runs inside a method body, checks run after it), `members` (answer declares methods or fields inside `static class Practice`, checks call them), `types` (answer declares top-level types, checks use them). |
| Checks | C# boolean expressions. Add `checkLabels` with plain descriptions, because failures otherwise show the raw expression. |
| Printed output | Set `"captureOutput": true` on a `statements` task, then check `__Output() == "line one\nline two"`. Output is trimmed at the end and uses `\n`. |
| Supplied code | A fixture file's text becomes `declarations`, placed before the answer with the usual `using` lines. |
| Syntax `rules` | Roslyn syntax kinds, as in the C# drills. Use them only when the syntax itself is the learning goal. |
| Examples | Top-level statements in `.cs` files. Give either `stdout` lines or `diagnostics` as `[{"code": 29, "line": 2}]` for CS0029 on line 2. |
| Files | Single-file tasks only. The two-file project workspace is TypeScript-only, so write project steps and the final assessment as single-file `types` or `members` tasks. |
| Not available | `typeChecks` and `rejects` are TypeScript-only. Extra AI practice and the pilot kit are TypeScript-only. |

Keep `runtimeContentVersion` at `0.1.0-preview.1` and `compatibility` empty for the first version.

## Suggested outline

Adjust after drafting, but cover a complete foundation and end with an unfamiliar task:

1. save: save, run, read output and a compiler error
2. values: variables, `int`/`double`/`string`/`bool`, `var`, arithmetic, string interpolation
3. decisions: `if`, comparison and boolean operators
4. methods: parameters, return values, scope, static methods
5. collections: arrays, `List<T>`, loops
6. classes: fields, properties, constructors, methods
7. records and structs: value versus reference, `with`, equality
8. null: nullable reference types, `?`, `??`, null checks
9. dictionaries and sets
10. LINQ: `Where`, `Select`, `Count`, `GroupBy`, deferred execution
11. pattern matching: `switch` expressions, type and property patterns
12. interfaces and inheritance
13. exceptions: `throw`, `try`/`catch`, result types versus exceptions
14. generics
15. async: `Task`, `async`/`await`, failures
16. checks: reading test results and writing a check that catches a bug
17. tracker: combine earlier pieces in a project checkpoint
18. report: an unfamiliar final task, done independently

Use the same tracker theme as the TypeScript course for project checkpoints, rewritten for C#.

## How to work

Work in reviewed batches. Commit after each verified batch with a plain message and no co-author line. Do not push unless asked.

1. **Sample gate.** Write `course-drafts/csharp/OUTLINE.md`, `manifest.json`, `FORMAT.md` (only the C# differences), and two complete modules: an early one a beginner can do, and a later one using pattern matching or async. Verify them. Then stop and report so the owner can review the format before the rest is written.
2. **Remaining modules.** Write them in batches of three or four. Verify each batch before starting the next.
3. **Project and readiness.** Add `project/project.json` with four checkpoint tasks and the final assessment, and `readiness/r1`–`r4`, registered in the manifest as the TypeScript draft does.
4. **Register.** Build the pack, add it to `courses/catalog.js`, and check that the course opens and checks C# answers in the app. Add tests and native course panel fixtures for C#. Update `LEARNING_SCOPE.md`, `LEARNING_PROGRESS.md`, `RELEASE.md` and the README.

## Quality bar for every task

- A specific prompt, three hints that get progressively more specific, and `feedback` for a failed check.
- The starter compiles where possible and fails the checks.
- A reference answer and a genuinely different second correct answer both pass.
- At least two wrong answers, each a real learner mistake, each failing for its named reason (`witness` with fixture, kind and detail).
- Only concepts taught in this module or earlier. The verifier enforces this through `concepts`, `teaches` and `requires`.
- Checks test behavior through several inputs, not one hard-coded value.

Code correctness is checked by the verifier. Explanation quality is not, so reread every explanation and question for accuracy, plain language and pacing.

## Commands

Run from the repository root:

```bash
node practice-range/scripts/verify-course.mjs csharp
```

```bash
node practice-range/scripts/verify-course.mjs csharp save values
```

```bash
node practice-range/scripts/build-course.mjs csharp
```

```bash
env TMPDIR=/private/tmp node --test --test-concurrency=3 practice-range/tests/*.test.mjs
```

```bash
node practice-range/tests/check-courses.mjs
```

```bash
node practice-range/mods/practice-range/languages/typescript/node_modules/typescript/bin/tsc -p practice-range/mods/practice-range/tsconfig.json --pretty false
```

The verifier needs a .NET SDK 8 or newer. The builder writes `courses/packs/csharp-foundations.json`. Once that pack is in a commit, any content change needs a new `runtimeContentVersion`.

## Already done

The course plumbing supports C#: the loader accepts the C# compiler rule and modes, the C# runner runs course examples and checks printed output, and the verifier and builder take a language argument. A one-module throwaway draft passed verification and built. Running a C# course inside the app (enroll, open a task, check on save) has not been tested yet. Test it when registering the pack.

## Do not

- Change the TypeScript course content or Tutor.
- Add network calls, package installs or external services to exercises.
- Count reading, skips, hints or revealed solutions as independent success.
- Leave modules in the pack that fail verification.
