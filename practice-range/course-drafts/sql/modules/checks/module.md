---
id: course:sql-foundations/module/checks
title: Check that a query is right
requires: ["left-join","group","aggregate","count-forms","join","having","cte","filter"]
outcomes: [{"id":"zero","can":"Count related rows so that none gives 0.","assessment":["zero-count","course:sql-foundations/task/checks-orders-per-customer"]},{"id":"fan-out","can":"Explain and repair a join that multiplies rows.","assessment":["fan-out","course:sql-foundations/task/checks-staff-and-projects"]},{"id":"transfer","can":"Test a total against a simpler query.","assessment":["doubled","course:sql-foundations/task/checks-delivered-summary"]}]
tasks: [{"id":"course:sql-foundations/task/checks-staff-and-projects","path":"tasks/staff-and-projects/task.json"},{"id":"course:sql-foundations/task/checks-orders-per-customer","path":"tasks/orders-per-customer/task.json"},{"id":"course:sql-foundations/task/checks-delivered-summary","path":"tasks/delivered-summary/task.json"}]
review: {"task":"course:sql-foundations/task/checks-delivered-summary","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted.","afterCompletion":true}
drills: ["joins/left-count","joins/join-group","aggregates/count-distinct"]
drillGap: These drills practise counting through a join. They do not show a result that is wrong without any error.
---

A query can run without any error and still give a wrong answer. Nothing in the database will tell you. This module covers how to test a result: know what one row stands for, compare with a simpler query you trust, and watch for joins that count rows twice.

## Know what one row stands for

Before trusting a number, say what each row of the joined result stands for.

After `customers LEFT JOIN orders`, a row is one order of one customer, or one customer with no order at all.

- `count(*)` counts those rows, so a customer with no orders counts as 1.
- `count(o.id)` counts order ids and skips the `NULL` of the unmatched row, so that customer correctly gets 0.


## Count orders for a customer with none {prediction}

Felix has never ordered. Predict what his `orders` and `joined_rows` columns show.

```sql example zero
SELECT c.first_name, count(o.id) AS orders, count(*) AS joined_rows
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.id
WHERE c.id >= 16
GROUP BY c.first_name
ORDER BY c.first_name;

```

```output
Your query returned:
 first_name | orders | joined_rows
------------+--------+-------------
 Felix      | 0      | 1
 Jack       | 4      | 4
 Mason      | 0      | 1
 Ruby       | 0      | 1
 Sofia      | 6      | 6
(5 rows)
```

:::question zero-count example=zero
What do orders and joined_rows show for Felix?
- [x] 0 and 1 :: The join keeps Felix as one row with no order. count(o.id) skips its NULL, and count(*) counts the row.
- [ ] 0 and 0 :: A LEFT JOIN keeps Felix as one row, and count(*) counts it.
- [ ] 1 and 1 :: count(o.id) counts order ids, and Felix's row has none.
:::

## Joins can multiply rows

Joining one department to its eleven employees gives eleven rows. Joining those to the department's four projects gives 44 rows, one for every pair of an employee and a project. This is called **fan-out**.

- Any count or sum over the joined rows is then too large. A count far above what you expect is the sign of fan-out.
- `count(DISTINCT e.id)` repairs a count by counting each employee once.
- A sum cannot be repaired that way, so add things up in separate steps first and join the totals.


## Count through two joins {prediction}

Engineering has 11 employees and 4 projects. Predict its `joined_rows`.

```sql example fan-out
SELECT d.name,
       count(DISTINCT e.id) AS staff,
       count(DISTINCT p.id) AS projects,
       count(*) AS joined_rows
FROM departments AS d
LEFT JOIN employees AS e ON e.department_id = d.id
LEFT JOIN projects AS p ON p.department_id = d.id
GROUP BY d.name
ORDER BY d.name;

```

```output
Your query returned:
 name        | staff | projects | joined_rows
-------------+-------+----------+-------------
 Engineering | 11    | 4        | 44
 Executive   | 1     | 0        | 1
 Legal       | 0     | 0        | 1
 Marketing   | 3     | 2        | 6
 Sales       | 4     | 1        | 4
 Support     | 4     | 1        | 4
(6 rows)
```

:::question fan-out example=fan-out
What is joined_rows for Engineering?
- [ ] 11 :: Each employee is paired with every project, so there are more rows than employees.
- [ ] 15 :: The joins pair employees with projects. They multiply, not add.
- [x] 44 :: Each employee is paired with every project: 11 times 4. The `staff` and `projects` columns are right because each uses `DISTINCT`. Legal has no employees and no projects and still shows 1 joined row: the department itself, with nothing matched.
:::

## Test against something simpler

The surest test is a second query that answers part of the question in the plainest way, such as a count of one table with one filter. If the two disagree, the complicated query is the suspect.

Totals are the easiest thing to check this way: a total over more joins should never be larger than the same total over fewer.


## Two totals for the same thing {prediction}

Both statements claim to give the revenue of delivered orders. The second also joins the customers' reviews. Predict which total is right.

```sql example doubled
SELECT sum(i.quantity * i.unit_price) AS revenue
FROM order_items AS i
JOIN orders AS o ON o.id = i.order_id
WHERE o.status = 'delivered';

SELECT sum(i.quantity * i.unit_price) AS revenue
FROM order_items AS i
JOIN orders AS o ON o.id = i.order_id
JOIN reviews AS r ON r.customer_id = o.customer_id
WHERE o.status = 'delivered';

```

```output
Statement 1 returned:
 revenue
----------
 52608.83
(1 row)
Statement 2 returned:
 revenue
-----------
 110169.60
(1 row)
```

:::question doubled example=doubled
Which total is the revenue of delivered orders?
- [ ] The second, 110169.60 :: Joining the reviews repeats items, so that total counts the same sales several times.
- [x] The first, 52608.83 :: The first statement joins each item to its order and adds it once. The second also joins the reviews of the order's customer, so a customer with three reviews has every item three times, and customers with no reviews vanish. The total more than doubles. The reviews had no part in the question and should not have been joined.
- [ ] Neither :: The first statement joins only what the question needs, and each item appears once.
:::

## Count staff and projects {modification}

The starter counts joined rows, so both numbers are too large. Count each thing once.

@task checks-staff-and-projects

## Count orders for every customer {independent}

Work from the prompt. Customers with no orders must show 0.

@task checks-orders-per-customer
