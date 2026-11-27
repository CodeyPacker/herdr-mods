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

Every department has an id, its primary key. An employee row stores the id of its department in department_id, a foreign key. JOIN departments ON departments.id = employees.department_id pairs each employee row with the department row whose id matches. The result has the columns of both tables. Because both tables have a column called id and one called name, write the table in front: departments.name. An alias keeps that short. employees AS e lets you write e.first_name.

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

## Join and filter {prediction}

Sales and Marketing are in Chicago, with 4 and 3 employees. Predict how many rows come back.

@example chicago

:::question chicago example=chicago
How many rows come back?
- [ ] 2 :: The result has one row per employee, not one per department.
- [ ] 23 :: WHERE keeps only the employees whose department is in Chicago.
- [x] 7 :: Four people work in Sales and three in Marketing, and both are in Chicago.
:::

## Follow one pair {walkthrough}

Hannah's row has department_id 3. The join finds the department with id 3, Sales, and puts the two rows together. WHERE can then test a column from either table, here the department's location. Seven employees work in a Chicago department. The department's name came from one table and the first name from the other.

@example chicago

## A row with no match {prediction}

There are 24 employees. One of them, Alex, has no department_id. Predict the count.

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
- [x] 23 :: Alex has no department_id, so no department row matches, and an inner join drops the row.
- [ ] 24 :: An inner join keeps a row only when it has a match. Alex has none.
- [ ] 6 :: The result has one row per matching pair, which is one per employee who has a department.
:::

## An inner join keeps matches only {walkthrough}

The count is 23. A plain JOIN is an inner join: a row appears only when the ON condition is true for some row of the other table. Alex's department_id is NULL, which matches nothing, so Alex is left out without any warning. The next module shows how to keep such rows.

@example matched

## A shared column name {prediction}

Both tables have an id and a name. Read the example before checking.

```sql example ambiguous diagnostics=[{"code":"42702","line":1}]
SELECT id, name
FROM employees
JOIN departments ON departments.id = employees.department_id;

```

:::question ambiguous example=ambiguous
What happens when you check this example?
- [ ] It returns the employee ids and department names. :: PostgreSQL does not guess which table a shared name belongs to.
- [x] PostgreSQL reports an error on line 1. :: Both tables have an id column, so the bare name is ambiguous (42702).
- [ ] It returns both id columns and both name columns. :: A bare name must point at exactly one column. With two candidates it is an error.
:::

## Read the error {walkthrough}

Check the example. Error 42702 says the column reference "id" is ambiguous. After the join there are two columns called id, and PostgreSQL will not pick one for you. Put the table name or its alias in front.

@example ambiguous

## More than two tables

Joins chain. Each JOIN adds one table and has its own ON condition linking it to a table that is already there. An assignment row holds an employee_id and a project_id, so joining assignments to employees and then to projects turns two ids into a name and a project title.

## Show each project's department {modification}

The starter joins on the wrong column, so the pairs are wrong.

@task joins-project-departments

## List the long assignments {independent}

Work from the prompt. Three tables are needed.

@task joins-long-assignments
