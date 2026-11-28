---
id: course:sql-foundations/module/where
title: Keep the rows you want
requires: ["column-list","alias","expression","sql-error"]
outcomes: [{"id":"filter","can":"Keep rows with a comparison.","assessment":["count-sales","course:sql-foundations/task/where-in-stock"]},{"id":"logic","can":"Combine tests and control which one is applied first.","assessment":["precedence","course:sql-foundations/task/where-small-items"]},{"id":"quotes","can":"Tell a text value from a column name.","assessment":["quotes"]},{"id":"transfer","can":"Match a pattern and an inclusive range.","assessment":["course:sql-foundations/task/where-engineers"]}]
tasks: [{"id":"course:sql-foundations/task/where-in-stock","path":"tasks/in-stock/task.json"},{"id":"course:sql-foundations/task/where-small-items","path":"tasks/small-items/task.json"},{"id":"course:sql-foundations/task/where-engineers","path":"tasks/engineers/task.json"}]
review: {"task":"course:sql-foundations/task/where-engineers","afterModule":"course:sql-foundations/module/aggregates","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["where/equals-number","where/equals-text","where/and","where/or","where/in-list","where/between","where/like-prefix","where/like-contains"]
drillGap: These drills practise one kind of test each. They do not mix AND with OR or test a value that sits on a limit.
---

Most questions are about some of the rows, not all of them. WHERE keeps the rows that pass a test. This module covers comparisons, combining tests with AND and OR, and matching lists, ranges and patterns.

## Keep the rows that pass a test

`WHERE` comes after `FROM` and holds a condition. A row is kept only when the condition is true for it.

- The comparison operators are `=` (equal), `<>` (not equal), `<`, `<=`, `>` and `>=`.
- Text values go in single quotes: `country = 'USA'`.
- Double quotes mean something else in SQL. They mark a name, such as a column, so `"USA"` would be read as a column called USA.

## Count the rows kept {prediction}

Department 3 is Sales. Predict how many rows come back.

```sql example sales
SELECT first_name, title, salary
FROM employees
WHERE department_id = 3;

```

```output
Your query returned:
 first_name | title             | salary
------------+-------------------+-----------
 Priya      | VP Sales          | 210000.00
 Hannah     | Account Executive | 98000.00
 Ravi       | Account Executive | 101000.00
 Julia      | Sales Associate   | 64000.00
(4 rows)
```

:::question count-sales example=sales
How many rows come back?
- [ ] 24 :: WHERE keeps only the rows whose department_id is 3.
- [x] 4 :: The condition `department_id = 3` is tested on each of the 24 rows, and four pass: Priya, Hannah, Ravi and Julia. The `SELECT` list then decides which of their columns are shown. A column used in `WHERE` does not have to be in the `SELECT` list.
- [ ] 1 :: The test is applied to every row, and every row that passes is kept.
:::

## Combine tests

`AND` keeps a row only when both sides are true. `OR` keeps it when at least one side is true. `NOT` flips a test.

When a condition mixes them, `AND` is applied before `OR`, the way multiplication comes before addition. Use brackets to say what you mean.

Three shorter forms are common:

| Form | True when |
| --- | --- |
| `department_id IN (4, 5)` | the value is any one in the list |
| `price BETWEEN 50 AND 100` | the value is in the range, both ends included |
| `last_name LIKE 'S%'` | the text matches the pattern. `%` stands for any run of characters, including none, so `title LIKE '%Engineer%'` matches titles that contain Engineer |


## Which test is applied first? {prediction}

The condition mixes OR and AND with no brackets. Predict which Marketing employees (department 4) appear.

```sql example precedence
SELECT first_name, department_id, salary
FROM employees
WHERE department_id = 5 OR department_id = 4 AND salary > 90000;

```

```output
Your query returned:
 first_name | department_id | salary
------------+---------------+-----------
 Tom        | 4             | 175000.00
 Laura      | 4             | 92000.00
 Pete       | 5             | 86000.00
 Mei        | 5             | 58000.00
 Carlos     | 5             | 56500.00
 Ingrid     | 5             | 57000.00
(6 rows)
```

:::question precedence example=precedence
Which employees from department 4 appear?
- [x] Tom and Laura :: `AND` binds first, so the condition reads as: department 5, or (department 4 and salary above 90000). Everyone in department 5 is kept whatever they earn. From department 4, Kofi, on 88000, is left out. With brackets around the `OR`, the salary test would apply to both departments.
- [ ] Tom, Kofi and Laura :: The salary test applies to department 4, and Kofi's 88000 does not pass it.
- [ ] None of them :: The row is kept when either side of the OR is true, and two Marketing employees pass the right side.
:::

## Find the error {prediction}

This example does not run. Find the line PostgreSQL stops at, and why.

```sql example quotes diagnostics=[{"code":"42703","line":3}]
SELECT first_name
FROM customers
WHERE city = "Denver";

```

:::question quotes example=quotes
Which error does PostgreSQL report?
- [ ] Line 1: `first_name` must be in quotes. :: Column names need no quotes. Line 1 is fine.
- [x] Line 3, 42703: column `Denver` does not exist. :: Double quotes mark a name, so PostgreSQL looked for a column called Denver. Write the text value in single quotes: `city = 'Denver'`.
- [ ] Line 3: `=` cannot compare text. :: `=` compares text as well as numbers. The problem is what is on its right.
:::

## List what can be sold {modification}

The starter filters on stock only. Add the second test.

@task where-in-stock

## Find small, cheap items {independent}

Work from the prompt. Think about which test must be applied first.

@task where-small-items
