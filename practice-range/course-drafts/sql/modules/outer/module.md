---
id: course:sql-foundations/module/outer
title: Keep rows without a match
requires: ["join","key","table-alias","null","is-null","coalesce","order","filter"]
outcomes: [{"id":"keep","can":"Keep rows that have no match and read their NULL columns.","assessment":["left-null","course:sql-foundations/task/outer-all-employees"]},{"id":"find","can":"Find the rows that have no match.","assessment":["unmatched","course:sql-foundations/task/outer-never-ordered"]},{"id":"transfer","can":"Place a filter so that unmatched rows survive.","assessment":["on-or-where","course:sql-foundations/task/outer-high-earners"]}]
tasks: [{"id":"course:sql-foundations/task/outer-all-employees","path":"tasks/all-employees/task.json"},{"id":"course:sql-foundations/task/outer-never-ordered","path":"tasks/never-ordered/task.json"},{"id":"course:sql-foundations/task/outer-high-earners","path":"tasks/high-earners/task.json"}]
review: {"task":"course:sql-foundations/task/outer-high-earners","afterModule":"course:sql-foundations/module/checks","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["joins/left","joins/anti-join","joins/left-count","joins/self-left"]
drillGap: These drills practise one outer join each. They do not compare a test in ON with the same test in WHERE.
---

An inner join drops every row that has no match. Often those rows are the ones you want: the employee with no department, the customer who has never ordered. A LEFT JOIN keeps them. This module covers it, and the question of where a filter belongs.

## Keep every row of the left table

FROM employees AS e LEFT JOIN departments AS d keeps every employee. The table written before LEFT JOIN is the left table, and all its rows survive. When an employee has a matching department, the row looks like an inner join's row. When there is no match, the row still appears, and every column from the right table is NULL.

```sql example left
SELECT e.first_name, d.name AS department
FROM employees AS e
LEFT JOIN departments AS d ON d.id = e.department_id
WHERE e.id >= 22
ORDER BY e.id;

```

```output
Your query returned:
 first_name | department
------------+-------------
 Yusuf      | Engineering
 Alex       | NULL
 Mila       | Engineering
(3 rows)
```

## A row with no match {prediction}

Alex has no department_id. Predict what the department column shows for Alex.

@example left

:::question left-null example=left
What does the department column show for Alex?
- [x] NULL :: No department matched, so the columns from departments are NULL.
- [ ] Alex does not appear :: A LEFT JOIN keeps every row of the left table, matched or not.
- [ ] An empty text :: A missing match is marked with NULL, not with empty text.
:::

## Read the NULL {walkthrough}

Yusuf and Mila are paired with Engineering. Alex has no match, so the row is kept and d.name is NULL. That NULL does not come from a stored value. It is how a LEFT JOIN marks that nothing matched. COALESCE can turn it into readable text.

@example left

## Find the rows with no match

The same NULL lets you search for unmatched rows. Join with LEFT JOIN, then keep the rows where a column from the right table IS NULL. Use a column that is never NULL in a real row, such as the primary key. Customers LEFT JOIN orders, where the order's id IS NULL, gives the customers who have no orders.

```sql example unmatched
SELECT c.first_name
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.id
WHERE o.id IS NULL
ORDER BY c.first_name;

```

```output
Your query returned:
 first_name
------------
 Felix
 Mason
 Ruby
(3 rows)
```

## Customers without orders {prediction}

Twenty customers exist, and seventeen of them have placed orders. Predict how many rows come back.

@example unmatched

:::question unmatched example=unmatched
How many rows come back?
- [ ] 17 :: Those are the customers who have orders. The WHERE keeps the ones without.
- [x] 3 :: Twenty customers minus the seventeen who have ordered.
- [ ] 0 :: A LEFT JOIN keeps the customers with no orders, and their o.id is NULL.
:::

## ON or WHERE?

With a LEFT JOIN it matters where a test on the right table is written. A test in the ON clause decides what counts as a match, and left rows with no match are still kept. A test in WHERE runs after the join, on the finished rows. An unmatched row has NULL in the right table's columns, so the test is not true for it and the row is removed. A WHERE test on the right table quietly turns a LEFT JOIN back into an inner join.

```sql example on
SELECT d.name, e.first_name
FROM departments AS d
LEFT JOIN employees AS e ON e.department_id = d.id AND e.salary > 200000
ORDER BY d.id;

```

```output
Your query returned:
 name        | first_name
-------------+------------
 Executive   | Dana
 Engineering | Marcus
 Sales       | Priya
 Marketing   | NULL
 Support     | NULL
 Legal       | NULL
(6 rows)
```

## The same test in two places {prediction}

The first example puts salary > 200000 in ON and returns 6 rows, one per department. Predict how many rows the second returns, with the test in WHERE.

```sql example where
SELECT d.name, e.first_name
FROM departments AS d
LEFT JOIN employees AS e ON e.department_id = d.id
WHERE e.salary > 200000
ORDER BY d.id;

```

```output
Your query returned:
 name        | first_name
-------------+------------
 Executive   | Dana
 Engineering | Marcus
 Sales       | Priya
(3 rows)
```

:::question on-or-where example=where
How many rows does the WHERE version return?
- [ ] 6 :: The three departments with no such employee have NULL salaries, and the WHERE test is not true for them.
- [ ] 0 :: Three employees earn more than 200000, and their rows pass the test.
- [x] 3 :: Only the rows with a real employee above 200000 pass the WHERE.
:::

## Compare the two results {walkthrough}

With the test in ON, every department appears. Three have an employee above 200000, and the other three show NULL. With the test in WHERE, the three NULL rows fail e.salary > 200000 and disappear, leaving 3 rows. Choose the form that matches the question: all departments with their top earners, or only the top earners.

@example where

## List every employee with a department {modification}

The starter loses one employee. Change the join.

@task outer-all-employees

## Find customers who never ordered {independent}

Work from the prompt. A second case adds a new customer with no orders.

@task outer-never-ordered
