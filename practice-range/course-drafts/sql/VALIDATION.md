# SQL course validation

From the repository root run `node practice-range/scripts/verify-course.mjs sql`. The script loads the repository's SQL runner and sends every example, reference answer, alternative, starter and wrong answer through the same `check` the product uses, on the pinned PGlite engine. Nothing is downloaded. A full run takes about five minutes. Pass module keys to check part of the course.

## Full course run

Recorded on 2026-11-26 with PGlite 0.5.16 (PostgreSQL 18) and Node.js 26.13.0 on Windows 11.

| What | Count |
| --- | ---: |
| Tasks checked | 60 (52 in lessons, 4 project checkpoints, 4 readiness checks) |
| Examples whose shown result matches | 40 |
| Examples with the expected SQL error | 12 |
| Reference answers passing a case | 72 |
| Alternative answers passing a case | 72 |
| Starters run against a case | 72 |
| Wrong answers failing for their named reason | 122 |
| Wrong-answer runs in total | 148 |

Twelve tasks have a second case that changes the data, which is why there are 72 cases for 60 tasks. Every starter fails its suite. Most are an empty file with one comment. The guided starters are real queries with one mistake.

## What a wrong answer has to show

Each task names at least two wrong answers, each a mistake a learner really makes. 120 fail because their result differs from the reference in the named way: rows missing, rows not expected, a wrong row count, a wrong order, a wrong column name, a changed table left in the wrong state, or a bad row accepted by a table. Two fail with a named PostgreSQL error.

Three first drafts of wrong answers matched the reference by coincidence on the practice data and were replaced or given a second case. The verifier caught each one.

## Product checks

`tests/course-sql.test.mjs` loads the built pack and drives a real enrollment through the course service: a prediction question, an example with a result table, an example with an expected error, a two-case query task, a task that changes data, a table design checked by rows it must reject, and the final assessment. It also asserts that no learner-facing text names a programming language. Five native panel fixtures in `tests/check-courses.mjs` render the SQL module list, a lesson, two kinds of task and a readiness check.

## What this does not establish

The verifier proves the queries behave as described. It cannot judge whether an explanation is clear or whether the pacing suits a beginner. Those need a learner.
