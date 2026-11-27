# SQL foundations

The beginner follows all 18 modules in order. The experienced path starts with the same run-and-read check and offers the readiness checks below. A learner can open any module or practice drill directly. The manifest expands each module key below with `course:sql-foundations/module/`.

Status: all 16 modules and four readiness checks are written and pass the verifier. The project and the Assemble and Report modules were removed on 2026-11-27 (D11: no project, no capstone). `VALIDATION.md` records the run. The course teaches SQL on its own terms, using PostgreSQL, and never compares it with a programming language.

## Data

Every example and task runs on the practice database the SQL drills already use: a store (customers, orders, order_items, products, categories, reviews) and a company (departments, employees, projects, assignments). `schema.sql` beside each answer lists every table and row. Each check starts from a fresh copy, so answers can change data freely.

## Outcome-to-assessment map

Task keys expand to `course:sql-foundations/task/<module>-<key>`. The last task listed for each module is its delayed review task.

| Module | Prior modules | What the learner can do | Tasks | Experienced entry |
| --- | --- | --- | --- | --- |
| 1. **save** · Run a query, read the result | None | Run a query, read its result table, and find the line a SQL error names. | fix-query, list-projects, categories | Setup for both |
| 2. **select** · Choose and name columns | save | Return chosen columns, computed columns with clear names, and distinct values. | stock-value, full-name, countries | R1 |
| 3. **where** · Keep the rows you want | select | Filter with comparisons, AND, OR, IN, BETWEEN and LIKE, including edge values. | in-stock, small-items, engineers | R1 |
| 4. **nulls** · Handle missing values | where | Find missing values, predict what NULL does, and supply a fallback. | no-email, contact, total-pay | R1 |
| 5. **sorting** · Sort and limit | where, nulls | Sort by several columns, take the first rows, and place missing values on purpose. | cheapest, signups, top-bonus | R1 |
| 6. **aggregates** · Summarize many rows | where, nulls | Count, total and average, and choose the right kind of COUNT. | count-emails, stock-summary, average-bonus | R2 |
| 7. **grouping** · Summarize by group | aggregates, sorting | One summary row per group, and filter groups with HAVING. | per-country, busy-categories, status-counts | R2 |
| 8. **joins** · Combine two tables | where, sorting | Join tables on their keys and read columns from both. | project-departments, long-assignments, cancelled | R2 |
| 9. **outer** · Keep rows without a match | joins, nulls | Keep unmatched rows, find them, and place a filter in ON or WHERE. | all-employees, never-ordered, high-earners | R2 |
| 10. **subqueries** · Use a query inside a query | joins, aggregates | Compare with a computed value, test existence, and avoid NOT IN with NULL. | above-average, cancelled-customers, referred-nobody | R3 |
| 11. **ctes** · Build a query in steps | subqueries, grouping | Name the steps of a longer query with WITH. | big-orders, payroll-share, repeat-buyers | R3 |
| 12. **expressions** · Compute new values | where, nulls, sorting | Label rows with CASE, convert types, and work with dates. | stock-level, march-shipping, half-stock | R3 |
| 13. **modify** · Change data | where, subqueries | Insert, update and delete exactly the intended rows. | restock, add-product, clear-cancelled | R3 |
| 14. **tables** · Design a table | modify | Create a table whose keys and constraints reject bad data. | suppliers, shipments, coupons | R4 |
| 15. **windows** · Rank and compare rows | grouping, ctes | Rank rows and compare each with its group without collapsing them. | rank-in-department, top-per-category, above-own-average | R4 |
| 16. **checks** · Check that a query is right | outer, grouping, ctes | Test a result against a simpler query and repair a join that counts twice. | staff-and-projects, orders-per-customer, delivered-summary | R4 |

That is 48 lesson tasks. The four readiness checks sit outside the lessons.

## Experienced entry

| Group | Task | What it shows |
| --- | --- | --- |
| R1 · select through sorting | Customers in two countries who signed up in one year, with a fallback for a missing email, newest first. | A filter that mixes a list with a range, COALESCE and ordering. |
| R2 · aggregates through outer | Every department with its staff count and payroll, including the one with no employees. | LEFT JOIN, counting values against rows, and a total that may be missing. |
| R3 · subqueries through modify | Products that cost more than the average of their own category, with a CASE label. | A correlated subquery or a step, and CASE with ELSE. |
| R4 · tables through checks | Each customer's largest order that is not cancelled. | Totals in a step, a numbered window per customer, and a filter on it. |

## Scope

The core ends at writing a multi-step query and checking that it is right. Outside this course: indexes and query plans, views, transactions and locking, JSON and array columns, set operations, recursive queries, user and permission management, and database administration. The practice drills cover several of these.
