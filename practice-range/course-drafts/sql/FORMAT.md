# SQL draft format

Everything in `../typescript/FORMAT.md` applies. This file lists only what differs for SQL. Each rule was read from the code: `languages/sql/runner.mjs`, `languages/sql/check.mjs`, `languages/sql/compare.js`, `courses/loader.mjs` and `scripts/verify-course.mjs`.

## Identity and runner

| Item | SQL rule |
| --- | --- |
| IDs | Course `course:sql-foundations`. Modules `course:sql-foundations/module/<key>`. Tasks `course:sql-foundations/task/<module>-<key>`. |
| Runner | `"languageId": "sql"` and `"runner": {"registeredLanguage": "sql", "compiler": {"name": "PGlite", "range": "=0.5.16"}}`. The range must match the version pinned in `languages/sql/package.json`. |
| Files | Sources are `.sql`. A task folder holds `task.json`, `starter.sql`, `solution.sql`, `alternative.sql`, one `fixture-<id>.sql` per case and one `wrong-<name>.sql` per wrong answer. |
| Mode | Always `"mode": "query"`. |

## How a task is checked

A SQL task has no `checks` list. The checker restores the practice database twice, runs the reference `solution` on one copy and the learner's answer on the other, and compares.

| Field | Meaning |
| --- | --- |
| (default) | The last result each returns must hold the same columns, in the same order, with the same rows. Row order is ignored. |
| `ordered` | Row order must match too. Set it whenever the prompt asks for a sort, and make the sort complete so ties cannot differ. |
| `verify` | A query run after both answers. Its results must match. Use it for tasks that change data or create a table. The answer's own result is then not compared. |
| `rejects` | Statements that must fail after the answer has run, such as an insert a new constraint should block. Each runs in its own rolled-back transaction. |
| `rules` | Token patterns the answer must contain. Not used in this course, because every task accepts any correct query. |

Numbers compare by value, so `12`, `12.0` and `12.00` are equal. Column names must match exactly.

## Cases (fixtures)

A fixture file is SQL that runs after the practice database is restored and before either answer. The learner sees it as a "Case" box. Most tasks have one empty case, named `practice`. A second case changes the data so that an answer that is right only by accident fails: a row placed exactly on a limit, a missing value, a tie, a row that makes a typed-in number stale.

## Examples

An example is a `.sql` file. It declares one of:

- `stdout`: every line the learner would see, exactly. For one statement that is `Your query returned:` followed by the result table. For several statements each is labeled, and a statement that changes data reports how many rows it changed.
- `diagnostics`: one entry with the PostgreSQL error `code` as a string, such as `"42703"`, and the `line` it is reported on. Errors raised by the data, such as a broken constraint, have no position, so their entry has no `line`.

Write the result tables by running the example, never by hand.

## Wrong-answer witnesses

| Witness kind | When it happens | What `detail` should contain |
| --- | --- | --- |
| `result` | The result or the `verify` result differs, or a `rejects` statement succeeded. | Part of the message: `Missing:`, `Not expected:`, `Expected 3 rows`, `not in the requested order`, `Name the columns`, `Return 2 columns`, `different result`, `should be rejected`. |
| `compile` | PostgreSQL reported an error. | The code, as in `error 42703`. |
| `syntax` | The answer is blank, or a rule is not met. | Part of the message. |

## Limits found while writing the course

- L1: A wrong answer can match the reference by coincidence on the practice data. Three first drafts did. Check each wrong answer against the data and add a case when the base data cannot tell it apart.
- L2: Without `ORDER BY`, PostgreSQL returns rows in a stable but unpromised order. Examples that show an unsorted result rely on the pinned engine version.
- L3: The editor has `schema.sql` and, for a task with a case, `setup.sql` beside the answer. It does not run the case for the learner outside a check.
