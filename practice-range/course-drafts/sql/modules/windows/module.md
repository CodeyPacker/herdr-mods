---
id: course:sql-foundations/module/windows
title: Rank and compare rows
requires: ["group","cte","order","aggregate","filter","is-null","alias"]
outcomes: [{"id":"rank","can":"Rank rows overall and inside a group.","assessment":["two-ranks","course:sql-foundations/task/windows-rank-in-department"]},{"id":"keep","can":"Compare each row with a summary of its group, keeping every row.","assessment":["kept-rows","course:sql-foundations/task/windows-above-own-average"]},{"id":"filter","can":"Filter on a window result with a named step.","assessment":["window-where","course:sql-foundations/task/windows-top-per-category"]}]
tasks: [{"id":"course:sql-foundations/task/windows-rank-in-department","path":"tasks/rank-in-department/task.json"},{"id":"course:sql-foundations/task/windows-top-per-category","path":"tasks/top-per-category/task.json"},{"id":"course:sql-foundations/task/windows-above-own-average","path":"tasks/above-own-average/task.json"}]
review: {"task":"course:sql-foundations/task/windows-above-own-average","afterModule":"course:sql-foundations/module/checks","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["windows/row-number","windows/rank","windows/rank-partition","windows/top-per-group","windows/partition-average"]
drillGap: These drills practise one window function each. They do not combine a tie-break with a filter on the result.
---

GROUP BY summarizes rows by collapsing them. Sometimes you need the summary and the rows together: each employee beside their rank, or beside their department's average. A window function computes across related rows and keeps every row. This module covers ranking, partitions and filtering on a window result.

## A function with a window

A **window function** is a function followed by `OVER ( ... )`. The brackets describe the rows it looks at, called its **window**.

- `RANK() OVER (ORDER BY salary DESC)` gives each row its position when all rows are sorted by salary, highest first. Rows that tie share a rank, and the next rank is skipped.
- `ROW_NUMBER()` numbers the rows 1, 2, 3 with no ties.
- Adding `PARTITION BY department_id` splits the rows into one group per department and starts the ranking again inside each.
- The `ORDER BY` inside `OVER` decides only the ranking. The query's own `ORDER BY` still sorts the result.

Unlike `GROUP BY`, nothing is collapsed: every row stays and gains a column.


## Two ranks for one row {prediction}

Tom earns 175000 in department 4. Priya, in department 3, earns 210000. Predict Tom's `overall` and `in_department`.

```sql example ranks
SELECT first_name, department_id, salary,
       RANK() OVER (ORDER BY salary DESC) AS overall,
       RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS in_department
FROM employees
WHERE department_id IN (3, 4)
ORDER BY department_id, salary DESC;

```

```output
Your query returned:
 first_name | department_id | salary    | overall | in_department
------------+---------------+-----------+---------+---------------
 Priya      | 3             | 210000.00 | 1       | 1
 Ravi       | 3             | 101000.00 | 3       | 2
 Hannah     | 3             | 98000.00  | 4       | 3
 Julia      | 3             | 64000.00  | 7       | 4
 Tom        | 4             | 175000.00 | 2       | 1
 Laura      | 4             | 92000.00  | 5       | 2
 Kofi       | 4             | 88000.00  | 6       | 3
(7 rows)
```

:::question two-ranks example=ranks
What are Tom's overall and in_department?
- [ ] 1 and 1 :: Priya earns more than Tom, so across all the rows he is second.
- [x] 2 and 1 :: Across the seven rows shown, only Priya earns more than Tom, so `overall` is 2. Inside department 4 nobody earns more, so `in_department` is 1. The two columns use the same function with different windows.
- [ ] 2 and 2 :: PARTITION BY restarts the ranking for each department, and Tom is the top earner in his.
:::

## Aggregates as windows

The aggregate functions work as window functions too. `avg(salary) OVER (PARTITION BY department_id)` puts the department's average on every row of that department.

That lets you compare a row with its group in one query: the salary minus the department average.


## Rows that stay {prediction}

Department 5 has four employees. Predict how many rows this query returns.

```sql example compare
SELECT first_name, salary,
       ROUND(avg(salary) OVER (PARTITION BY department_id)) AS department_avg,
       salary - ROUND(avg(salary) OVER (PARTITION BY department_id)) AS difference
FROM employees
WHERE department_id = 5
ORDER BY salary DESC;

```

```output
Your query returned:
 first_name | salary   | department_avg | difference
------------+----------+----------------+------------
 Pete       | 86000.00 | 64375          | 21625.00
 Mei        | 58000.00 | 64375          | -6375.00
 Ingrid     | 57000.00 | 64375          | -7375.00
 Carlos     | 56500.00 | 64375          | -7875.00
(4 rows)
```

:::question kept-rows example=compare
How many rows come back?
- [ ] 1 :: A window function does not collapse rows. Only GROUP BY does.
- [ ] 24 :: WHERE keeps the four employees of department 5.
- [x] 4 :: One row per employee comes back, where `GROUP BY` would have returned one row for the department. Each row carries the same `department_avg`, 64375, and its own difference from it.
:::

## Find the error {prediction}

This example does not run. Find the line PostgreSQL stops at, and why.

```sql example bad-where diagnostics=[{"code":"42703","line":3}]
SELECT name, RANK() OVER (ORDER BY price DESC) AS position
FROM products
WHERE position <= 3;

```

:::question window-where example=bad-where
Which error does PostgreSQL report?
- [ ] Line 1: `RANK()` needs a `PARTITION BY`. :: `PARTITION BY` is optional. Without it, all rows form one window.
- [x] Line 3, 42703: column `position` does not exist. :: Window functions are worked out after `WHERE` has run, so `WHERE` cannot see their results, and it cannot use a `SELECT` alias in any case. Put the window function in a `WITH` step. In the main query its result is an ordinary column, and `WHERE position <= 3` works.
- [ ] Line 3: `<=` cannot compare a rank. :: A rank is a number, and `<=` compares numbers. The trouble is the name `position`.
:::

## Rank salaries inside each department {modification}

The starter ranks everybody in one list. Restart the ranking for each department.

@task windows-rank-in-department

## Find the dearest product in each category {independent}

Work from the prompt. Rank in a step, then filter.

@task windows-top-per-category
