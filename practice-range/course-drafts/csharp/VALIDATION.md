# C# course validation

From the repository root run `node practice-range/scripts/verify-course.mjs csharp`. The script loads the repository's C# runner, builds the checker once in a temporary folder, and sends every example, answer and wrong answer through the same `check` the product uses. Nothing is downloaded. A full run takes roughly 20 minutes, because each check starts two .NET processes. Pass module keys to check part of the course, for example `verify-course.mjs csharp values patterns`.

## Full course run

Recorded on 2026-11-26 with .NET SDK 10.0.404 and Node.js 26.13.0 on Windows 11.

| What | Count |
| --- | ---: |
| Tasks checked | 65 (57 in lessons, 4 project checkpoints, 4 readiness checks) |
| Runnable examples with matching output | 24 |
| Examples with the expected compiler error | 11 |
| Reference answers passing a case | 85 |
| Alternative answers passing a case | 85 |
| Starters run against a case | 85 |
| Wrong answers failing for their named reason | 134 |
| Wrong-answer runs in total | 176 |

Case counts are higher than task counts because the early `statements` tasks run against three to five supplied cases each. Every starter fails its suite. Three starters do not compile on purpose, because reading the compiler error is the task: `save-fix-message`, `values-repair-count` and `patterns-repair-caption`.

## What a wrong answer has to show

Each task names at least two wrong answers, and each one is a mistake a learner really makes. The verifier requires the named failure, not just any failure.

| Kind of witness | Count | Example |
| --- | ---: | --- |
| A named check is false | 115 | `collections-average`: dividing two ints fails check 1, the average of 1 and 2. |
| The answer throws while a check runs | 14 | `nulls-text-length`: reading `note.Text.Length` throws `NullReferenceException` for a note with no text. |
| The answer does not compile | 4 | `async-total`: using a task as its result gives CS0029. |
| A syntax rule is not met | 1 | `values-seat-snapshot`: `int free` where the task asks for `var`. |

## Product checks

`tests/course-csharp.test.mjs` loads the built pack and drives a real enrollment through the course service: a prediction question, a runnable example, an expected compiler error, a `statements` task with three cases, a `members` task with supplied records, and the final assessment. It also asserts that no learner-facing text names another programming language. Six native panel fixtures in `tests/check-courses.mjs` render the C# module list, a lesson, three kinds of task and a readiness check.

## What this does not establish

The verifier proves the code behaves as described. It cannot judge whether an explanation is clear, whether the pacing suits a beginner, or whether passing a task means the skill will last. Those need a learner. The owner is the first tester, on the experienced path.
