---
id: course:sql-foundations/module/joins
title: Combine two tables
requires: ["filter","order","column-list","alias","sql-error"]
outcomes: [{"id":"join","can":"Join two tables on the columns that link them.","assessment":["chicago","course:sql-foundations/task/joins-project-departments"]},{"id":"unmatched","can":"Predict what an inner join does with a row that has no match.","assessment":["matched"]},{"id":"qualify","can":"Read the error from a column name that two tables share.","assessment":["ambiguous"]},{"id":"three","can":"Join three tables and filter the result.","assessment":["course:sql-foundations/task/joins-long-assignments"]},{"id":"transfer","can":"Join two tables from a description of the question.","assessment":["course:sql-foundations/task/joins-cancelled"]}]
tasks: [{"id":"course:sql-foundations/task/joins-project-departments","path":"tasks/project-departments/task.json"},{"id":"course:sql-foundations/task/joins-long-assignments","path":"tasks/long-assignments/task.json"},{"id":"course:sql-foundations/task/joins-cancelled","path":"tasks/cancelled/task.json"}]
review: {"task":"course:sql-foundations/task/joins-cancelled","afterModule":"course:sql-foundations/module/subqueries","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["joins/inner","joins/join-where","joins/three-tables","joins/product-lines"]
drillGap: These drills practise one join each. They do not show what a wrong ON condition returns.
---

A database spreads its facts over several tables. An employee row holds the id of a department, not its name. A join puts rows from two tables side by side so one query can read both. This module covers the inner join and the keys that make it work.

## Keys link tables

Every department has an `id`, its **primary key**. An employee row stores the id of its department in `department_id`, a **foreign key**.

```sql
JOIN departments ON departments.id = employees.department_id
```

- This pairs each employee row with the department row whose `id` matches. The result has the columns of both tables, and `WHERE` can test a column from either.
- Both tables have a column called `id` and one called `name`, so write the table in front: `departments.name`.
- An alias keeps that short: `employees AS e` lets you write `e.first_name`.


## Join and filter {prediction}

Sales and Marketing are in Chicago, with 4 and 3 employees. Predict how many rows come back.

```sql example chicago
SELECT e.first_name, d.name AS department
FROM employees AS e
JOIN departments AS d ON d.id = e.department_id
WHERE d.location = 'Chicago'
ORDER BY e.first_name;

```

```output
Your query returned:
 first_name | department
------------+------------
 Hannah     | Sales
 Julia      | Sales
 Kofi       | Marketing
 Laura      | Marketing
 Priya      | Sales
 Ravi       | Sales
 Tom        | Marketing
(7 rows)
```

:::question chicago example=chicago
How many rows come back?
- [ ] 2 :: The result has one row per employee, not one per department.
- [ ] 23 :: WHERE keeps only the employees whose department is in Chicago.
- [x] 7 :: Hannah's row has `department_id` 3, so the join pairs it with Sales, the department with id 3. `WHERE` then tests the department's location. Seven employees work in a Chicago department, and each row takes its first name from one table and the department name from the other.
:::

## A row with no match {prediction}

There are 24 employees. One of them, Alex, has no `department_id`. Predict the count.

```sql example matched
SELECT count(*) AS matched
FROM employees AS e
JOIN departments AS d ON d.id = e.department_id;

```

```output
Your query returned:
 matched
---------
 23
(1 row)
```

:::question matched example=matched
What count comes back?
- [x] 23 :: A plain `JOIN` is an **inner join**: a row appears only when the `ON` condition is true for some row of the other table. Alex's `department_id` is `NULL`, which matches nothing, so Alex is left out without any warning. The next module shows how to keep such rows.
- [ ] 24 :: An inner join keeps a row only when it has a match. Alex has none.
- [ ] 6 :: The result has one row per matching pair, which is one per employee who has a department.
:::

## Find the error {prediction}

This example does not run. Find the line PostgreSQL stops at, and why.

```sql example ambiguous diagnostics=[{"code":"42702","line":1}]
SELECT id, name
FROM employees
JOIN departments ON departments.id = employees.department_id;

```

:::question ambiguous example=ambiguous
Which error does PostgreSQL report?
- [x] Line 1, 42702: the column reference `id` is ambiguous. :: After the join there are two columns called `id`, and PostgreSQL will not pick one for you. Put the table name or its alias in front: `employees.id`.
- [ ] Line 2: `employees` needs an alias before it can be joined. :: An alias is a convenience, never required. Line 2 is fine.
- [ ] Line 3: the `ON` condition compares two different tables. :: That is exactly what `ON` is for. The condition is right.
:::

## More than two tables

Joins chain. Each `JOIN` adds one table and has its own `ON` condition linking it to a table that is already there.

An assignment row holds an `employee_id` and a `project_id`, so joining `assignments` to `employees` and then to `projects` turns two ids into a name and a project title.

## Show each project's department {modification}

The starter joins on the wrong column, so the pairs are wrong.

@task joins-project-departments

## List the long assignments {independent}

Work from the prompt. Three tables are needed.

@task joins-long-assignments
