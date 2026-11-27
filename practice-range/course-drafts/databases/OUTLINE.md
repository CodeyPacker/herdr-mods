# Databases

A reading course about how a relational database works underneath SQL: what a query costs, how indexes and plans work, how to model data, and how to keep it correct when many transactions run at once. It has no code to run and needs nothing installed.

Status: all 15 modules are written, built and registered as `course:databases`, content version 0.1.0-preview.1. Nobody has worked through it as a learner.

## Who it is for

Someone who can write SQL with joins and grouping, for example after the SQL course, and wants to know why a query is slow, how to design tables, and what goes wrong under concurrency. It sits between the SQL course and the System design course.

## Modules

The manifest expands each key with `course:databases/module/`. Each module is one `module.md` in the Markdown format described at the top of `scripts/course-markdown.mjs`.

| Module | What the reader can do afterwards |
| --- | --- |
| 1. **storage** · How a database stores and finds rows | Explain a query's cost in pages read. |
| 2. **indexes** · Indexes | Say what a B-tree can answer, when it is ignored and what it costs. |
| 3. **composite** · Indexes on several columns | Order the columns of a composite index and avoid a sort or a table visit. |
| 4. **plans** · Read a query plan | Find the slow step and compare estimated rows with actual rows. |
| 5. **joins** · How joins are run | Recognise the three join methods and find joins that multiply rows. |
| 6. **modeling** · Model the data | Design tables with keys, types and constraints. |
| 7. **denormalize** · When to duplicate data | Decide when to store a derived value and keep it correct. |
| 8. **transactions** · Transactions | Keep a transaction short and say what it does not cover. |
| 9. **isolation** · Isolation levels | Name the anomaly in a concurrency bug and choose a fix. |
| 10. **locking** · Locks and deadlocks | Find the transaction that blocks the others. |
| 11. **migrations** · Change a schema safely | Change a large, busy table in safe steps. |
| 12. **connections** · Connections and pools | Size a pool and remove wasted round trips. |
| 13. **maintenance** · Keep a database healthy | Plan cleanup, statistics, backups and old data. |
| 14. **tuning** · Find and fix a slow query | Work through a slow query with one method. |
| 15. **review** · Review a schema and its queries | Review a schema and a plan, and design a schema. |

The course has 185 steps, 30 questions and 41 examples (diagrams and query plans), in about 22,000 words. SQL is shown in fenced blocks inside the step text, so the app colours it.

## How a module is built

Each module explains an idea in short steps with diagrams, SQL and plan output, asks two questions where the reader predicts an outcome, and ends with an exercise on paper followed by one possible answer.

## Decisions

- D1: **A reading course, not a coding one.** The app's SQL checker runs PGlite, which is PostgreSQL in one process with small data. The subjects here need what that cannot show: plans on millions of rows, two transactions at once, lock waits, table locks during a schema change. So the plans and timelines are printed and explained.
- D2: **PostgreSQL for every detail.** The SQL course in the app runs on it, so the syntax matches. The first and last modules say that other databases differ in names and defaults.
- D3: **SQL in the text, plans as examples.** A `sql` fence in step text is coloured by the app. Diagrams and `EXPLAIN` output are `text` examples, which the test keeps to 76 characters.
- D4: **Plans are illustrative.** The `EXPLAIN ANALYZE` output was written by hand to show one point each. The numbers inside each plan are consistent with its explanation. They were not produced by a real database.
- D5: **Overlap with other courses is deliberate and small.** Expand and contract also appears in the CI/CD course, and replication, partitioning and caching belong to System design. This course goes deeper on the single database and refers to those courses for the rest.
- D6: **Security advice is marked as general guidance.** SQL injection and parameters are covered in the connections and review modules.

## Checks

`tests/course-databases.test.mjs` checks the built pack: 15 available modules, no exercises to run, every example read-only and no line over 76 characters, every question shown with feedback on every choice, an exercise and a worked answer in every module, example domains only, and nothing that looks like a live credential. It also drives an enrollment through the course service.

## Not verified

- No SQL statement in the course was run. The statements were written from knowledge of PostgreSQL, and some behaviour differs between versions (for example which `ALTER TABLE` forms rewrite a table).
- The query plans were written by hand, as D4 says.
- Nobody has opened the course in the app, so whether SQL blocks in step text are coloured as expected is unseen.
- The text was reviewed by its author only.

## Scope

Outside this course: replication and partitioning across machines (see System design), full-text search in depth, stored procedures, specific ORMs, non-relational databases, and database administration tasks such as upgrades and access control.
