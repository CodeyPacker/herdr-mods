---
id: course:sql-foundations/module/ctes
title: Build a query in steps
requires: ["subquery","group","having","join","aggregate","order","filter","table-alias"]
outcomes: [{"id":"step","can":"Name a step with WITH and query its result.","assessment":["totals","course:sql-foundations/task/ctes-big-orders"]},{"id":"chain","can":"Build one named step on another.","assessment":["spenders","course:sql-foundations/task/ctes-payroll-share"]},{"id":"scope","can":"Say how long a named step lasts.","assessment":["scope"]},{"id":"transfer","can":"Count in one step and filter in the next.","assessment":["course:sql-foundations/task/ctes-repeat-buyers"]}]
tasks: [{"id":"course:sql-foundations/task/ctes-big-orders","path":"tasks/big-orders/task.json"},{"id":"course:sql-foundations/task/ctes-payroll-share","path":"tasks/payroll-share/task.json"},{"id":"course:sql-foundations/task/ctes-repeat-buyers","path":"tasks/repeat-buyers/task.json"}]
review: {"task":"course:sql-foundations/task/ctes-repeat-buyers","afterModule":"course:sql-foundations/module/windows","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["ctes/basic","ctes/join-cte","ctes/two-ctes","ctes/filter-cte"]
drillGap: These drills practise one WITH form each. They do not ask where a filter belongs: inside the step or after it.
---

Long queries are easier to write and to read as a series of small steps. WITH gives a query a name, and the rest of the statement can use that name like a table. This module covers building a result one named step at a time.

## Give a query a name

`WITH order_totals AS ( ... )` runs the query in the brackets and calls its result `order_totals`. The main query after it reads from `order_totals` as if it were a table.

- Such a named query is called a **common table expression**, or CTE.
- It does nothing a subquery could not do, but it lets you write the steps in the order you think of them: first work out a total for each order, then pick the large ones.
- Inside the main query, a step's column is an ordinary column, so a test on a total is a plain `WHERE`, not a `HAVING`.

The value of an order is the sum of `quantity * unit_price` over its items.


## Filter a computed total {prediction}

The step adds up each order's items. The main query keeps totals above 5000. Predict the first row.

```sql example totals
WITH order_totals AS (
    SELECT order_id, sum(quantity * unit_price) AS total
    FROM order_items
    GROUP BY order_id
)
SELECT order_id, total
FROM order_totals
WHERE total > 5000
ORDER BY total DESC;

```

```output
Your query returned:
 order_id | total
----------+---------
 42       | 5929.10
 29       | 5644.00
 58       | 5107.97
 40       | 5044.50
(4 rows)
```

:::question totals example=totals
What is the first row?
- [x] Order 42 with 5929.10 :: The step groups the 152 item rows into 60 orders and gives each a total. The main query keeps the totals above 5000 and sorts them from the largest down, so order 42 comes first.
- [ ] Order 1 with 37.98 :: Order 1's total is far below 5000, so it is filtered out.
- [ ] Order 40 with 5044.50 :: That order passes the filter, but three orders have larger totals.
:::

## Steps can build on steps

A `WITH` clause can define several steps, separated by commas.

- A later step can read from an earlier one.
- The main query can use any of them and can join them to real tables.
- Give each step a name that says what one of its rows is.


## Follow a chain {prediction}

The second step adds up each customer's order totals, leaving out cancelled orders. Predict what one row of `customer_totals` stands for.

```sql example spenders
WITH order_totals AS (
    SELECT order_id, sum(quantity * unit_price) AS total
    FROM order_items
    GROUP BY order_id
),
customer_totals AS (
    SELECT o.customer_id, sum(t.total) AS spent
    FROM orders AS o
    JOIN order_totals AS t ON t.order_id = o.id
    WHERE o.status <> 'cancelled'
    GROUP BY o.customer_id
)
SELECT c.first_name, ct.spent
FROM customer_totals AS ct
JOIN customers AS c ON c.id = ct.customer_id
ORDER BY ct.spent DESC
LIMIT 3;

```

```output
Your query returned:
 first_name | spent
------------+---------
 Lily       | 9750.97
 Sofia      | 8857.27
 Henry      | 6872.90
(3 rows)
```

:::question spenders example=spenders
What does one row of customer_totals stand for?
- [ ] One order :: That is order_totals. customer_totals groups by customer_id.
- [x] One customer :: `order_totals` has one row per order. `customer_totals` joins those to `orders` to find each order's customer, drops the cancelled ones and groups by customer, so it has one row per customer with what they spent. The main query joins that to `customers` for the name and keeps the top three.
- [ ] One order item :: The item rows were already added up in the first step.
:::

## Find the error {prediction}

This example does not run. Find the line PostgreSQL stops at, and why.

```sql example scope diagnostics=[{"code":"42P01","line":6}]
WITH big AS (
    SELECT id FROM products WHERE price > 500
)
SELECT count(*) FROM big;

SELECT count(*) FROM big;

```

:::question scope example=scope
Which error does PostgreSQL report?
- [ ] Line 2: a `WITH` step cannot hold a `WHERE`. :: A step is an ordinary query, so it can filter. The first statement runs.
- [ ] Line 4: `count(*)` cannot read from a step. :: The first statement counts from `big` without trouble.
- [x] Line 6, 42P01: relation `big` does not exist. :: A `WITH` step belongs to the one statement it is written in, and it is gone when that statement ends. The second statement has no `WITH` of its own, so `big` means nothing there.
:::

## Find the large orders {modification}

The starter filters single items inside the step. The test is about whole orders.

@task ctes-big-orders

## Compare payroll with budget {independent}

Work from the prompt. Add up first, then compare.

@task ctes-payroll-share
