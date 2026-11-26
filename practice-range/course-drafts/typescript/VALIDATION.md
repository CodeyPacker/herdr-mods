# TypeScript course validation

From the repository root run `node practice-range/course-drafts/typescript/verify.mjs`. This authoring script loads the repository's TypeScript runner, obtains the installed compiler from its pack-local loader, and calls `checkAnswer` in a new temporary directory. Each call compiles with the pack's strict options. Runnable code and trusted checks execute through the pack's bounded child process. The verifier removes the temporary directory when finished. No dependency install is part of verification.

## Full course checks

All 18 modules are authored. The full verifier passed with TypeScript 6.0.3 on Node 25.2.1. It checked 19 runnable examples and two intentional diagnostics, accepted 74 reference runs and 74 alternative runs, rejected the complete starter suites, and confirmed all 113 named wrong-answer failures across 149 wrong-answer case runs. There are 56 distinct tasks. Fixture counts exceed task counts because early tasks use several input environments.

The final Report task contains two editable files. Its reference passes the eight import reports, exactly-once reader check, and checks that the learner's regression accepts a correct candidate and rejects a duplicate-counting candidate. The standalone project reference also passes all eight reports, its reader-count check, and the learner-authored regression.

Product tests separately cover enrollment and restart, predictions, fixture aggregation, assistance, duplicate saves, two-file snapshots, trusted fixture isolation, project backups, damaged progress, and filename restrictions. Nine native course panel fixtures passed, including the project. These results establish execution and integration behavior. Pacing, independent transfer, and delayed recall still require learner observation.

## Original sample checks

The validation run used Node 25.2.1 and the pack-local TypeScript 6.0.3. The declared and installed compiler versions matched. The task key in each row resolves to its module's `tasks/<key>/task.json`, which names every starter, reference, alternative, wrong answer, fixture and expected failure. Each reference and alternative passed every fixture. Each starter failed the complete suite. For this course, a suite fails if any fixture fails.

| Task | Fixtures | Wrong answer 1 and observed failure | Wrong answer 2 and observed failure |
| --- | ---: | --- | --- |
| arrival-log | 3 | Replacing the total with arrivals failed output check 1 on morning. | Updating before both prints failed output check 1 on morning. |
| remaining | 3 | A fixed 4 failed value check 1 on busy. | An explicit number annotation failed the requested inference syntax rule on morning. |
| shelf-label | 3 | A copied label failed check 1 on empty. | Reversing owner and area failed check 1 on desk. |
| repair-count | 3 | A text initializer followed by a numeric assignment produced TS2322 on morning. | Dropping the opening count failed check 1 on busy. |
| seat-snapshot | 3 | Taking both snapshots after booking failed check 1 on workshop. | Reporting bookings as free seats failed check 2 on sold. |
| describe-update | 1 | A fixed duration failed check 3 on a nonzero duration. | Reading title on every shape produced TS2339. |
| model-delivery | 1 | Optional payload fields failed type check 3 for valid shapes. | A success-only type failed type check 2 for a failed delivery. |
| apply-edit | 1 | Discarding a zero replacement failed check 3. | Replacing the count with an addition amount failed check 2. |
| repair-caption | 1 | Reading reason before checking the tag produced TS2339. | Treating an empty reason as ready failed check 3. |
| sensor-display | 1 | Treating zero degrees as absent failed check 1. | Returning a fixed failure message failed check 4. |

The ten exercises produced 20 passing reference runs, 20 passing alternative runs, 20 starter runs and 40 wrong-answer runs. All 20 named wrong-answer failure reasons matched on their declared fixtures. The reference for model-delivery also passed three assignability checks and all four forbidden assignments were rejected. Runtime-only assertions would provide no evidence for that task.

| Other executed check | Observed result |
| --- | --- |
| Values examples | The board printed 4 then 5. The label printed `Desk shelf`. The marked assignment produced exactly TS2322 on line 2. |
| Tagged example | The board printed `Place 0` then `Pack`. The marked property read produced exactly TS2339 on line 4. |
| Early tracker checkpoint | The reference and alternative passed all five count checks. The starter failed. Each of the two wrong answers failed check 2 on a nonempty board. |
| Final project starter snapshot | Both editable starters and the supplied module files compiled together as fixed local module fixtures. The local reader returned its input, the rejecting reader rejected, and the test stub returned false. The audit stub matched 1 of 8 expected reports and failed the reader-call-count check. Matching the rejection result alone does not complete the task. |
| Draft links | Parsed all authored module, task and project records. Checked prerequisite order, unique full content IDs, links from steps and outcomes, six real drill references, delayed-review order and declared sample paths. The full course now includes all 18 authored modules. The verifier checks every registered module and its task and outcome links. |

## Editorial review

| Finding | Revision or review evidence |
| --- | --- |
| F1 · Beginner prerequisites | Only saving/running and reading output precede Values. The lesson introduces assignment, quotes, numerical and text expressions, the print call, and the meaning of the supplied `: number` annotation before asking for edits. The tagged module explicitly requires branches, functions, literal unions, object shapes and prior basic narrowing. Its walkthrough introduces numeric-to-text conversion. |
| F2 · Prediction ambiguity | Questions identify either printed lines or the result of running the Practice Range checker. Output order, case, and error lines are checked on the referenced code. Every choice has feedback. In the tagged example, an actual zero demonstrates why the tag matters. |
| F3 · Types versus values | The first diagnostic example shows the checker stopping before execution. The tagged example distinguishes the erased alias from the runtime tag. Delivery accepts two required shapes and rejects malformed inputs at compile time. The supplied fixture contains no aliases that give away the answer. |
| F4 · Equivalent answers | Only explicit declaration-form objectives use syntax rules. The same checker accepted early returns and switch branches, direct or intermediate calculations, and separate interfaces combined in a union. |
| F5 · Shallow checks | Early input pairs vary to catch fixed answers. Tagged cases exercise zero, negative numbers, empty strings, both success/failure paths and mismatched type payloads. The project includes empty and repeated IDs, invalid rows sharing an ID and rejected readers. The sample does not attempt to prove correctness for all programs. |
| F6 · Hints and independence | Hints move from the meaning of the input to an operation or a field. Full answers are separate files. The delayed tasks change the setting, expected output and, for the sensor, the kind of tag. The data contract distinguishes unaided work from hints and solution reveal. |

## Pending checks and open questions

1. **Q1 · Learner observation.** Can a first-time programmer explain why the quoted-number example fails, then fix the count from a fresh starter? Can a learner who knows another language choose a suitable starting module from the readiness checks without guessing TypeScript syntax? Observe actual answers, hint use and the confusing line before deciding pace.
2. **Q2 · Transfer.** After an intervening module, can learners complete seat-snapshot and sensor-display without opening an earlier solution? The code checks ran. Retention and teaching effectiveness require learners and a delayed session.
3. **Q3 · Learning integration.** The bundled loader, course panel, persistent enrollment, and fixture aggregation are implemented. Delayed course review, recommendations, optional repo supplements, and Tutor import remain separate scope phases. Feedback for type-only tasks still needs learner observation.
4. **Q4 · Project delivery.** The final assessment has positive reference checks and a bounded two-file workspace. Source snapshots, trusted checks, stale results and reset backups are covered by product tests. The four intermediate checkpoints are verified tasks inside their modules and are listed with the final assessment on the module page. Readiness checks R1–R4 are verified the same way.

The technical references for inference and literal types, control-flow narrowing, type erasure and compiler behavior are the TypeScript Handbook. The executed results above are specific to this pack's 6.0.3 compiler and flags. [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) · [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) · [The Basics](https://www.typescriptlang.org/docs/handbook/2/basic-types.html)
