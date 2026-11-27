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

WITH order_totals AS ( ... ) runs the query in the brackets and calls its result order_totals. The main query after it reads from order_totals as if it were a table. Such a named query is called a common table expression, or CTE. It does nothing a subquery could not do, but it lets you write the steps in the order you think of them: first work out a total for each order, then pick the large ones. The value of an order is the sum of quantity * unit_price over its items.

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

## Filter a computed total {prediction}

The step adds up each order's items. The main query keeps totals above 5000. Predict the first row.

@example totals

:::question totals example=totals
What is the first row?
- [x] Order 42 with 5929.10 :: It has the largest total, and the result is sorted from the largest down.
- [ ] Order 1 with 37.98 :: Order 1's total is far below 5000, so it is filtered out.
- [ ] Order 40 with 5044.50 :: That order passes the filter, but three orders have larger totals.
:::

## Two steps, top to bottom {walkthrough}

The first step groups the 152 item rows into 60 orders and gives each a total. The main query filters and sorts that small result. The test total > 5000 is an ordinary WHERE here, because inside the main query total is just a column. Without the step, the same test would have to be a HAVING.

@example totals

## Steps can build on steps

A WITH clause can define several steps, separated by commas. A later step can read from an earlier one. The main query can use any of them and can join them to real tables. Give each step a name that says what one of its rows is.

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

## Follow a chain {prediction}

The second step adds up each customer's order totals, leaving out cancelled orders. Predict what one row of customer_totals stands for.

@example spenders

:::question spenders example=spenders
What does one row of customer_totals stand for?
- [ ] One order :: That is order_totals. customer_totals groups by customer_id.
- [x] One customer :: The step groups by customer_id, so each customer has one row with the total they spent.
- [ ] One order item :: The item rows were already added up in the first step.
:::

## What each step holds {walkthrough}

order_totals has one row per order. customer_totals joins those to orders to find each order's customer, drops the cancelled ones, and groups by customer, so it has one row per customer. The main query joins that to customers for the name and keeps the top three.

@example spenders

## Use a step in a second statement {prediction}

The file holds two statements. Both read from big. Read it before checking.

```sql example scope diagnostics=[{"code":"42P01","line":6}]
WITH big AS (
    SELECT id FROM products WHERE price > 500
)
SELECT count(*) FROM big;

SELECT count(*) FROM big;

```

:::question scope example=scope
What happens when you check this example?
- [ ] Both statements return the same count. :: The second statement cannot see a step defined in the first.
- [ ] The first statement fails. :: The first statement defines big and uses it correctly.
- [x] PostgreSQL reports an error on line 6. :: A WITH step lasts for one statement. The second statement has no big (42P01).
:::

## Read the error {walkthrough}

Check the example. Error 42P01 says relation "big" does not exist, on line 6. A WITH step belongs to the one statement it is written in and is gone when that statement ends. The first statement ran. The second has no WITH of its own, so big means nothing there.

@example scope

## Find the large orders {modification}

The starter filters single items inside the step. The test is about whole orders.

@task ctes-big-orders

## Compare payroll with budget {independent}

Work from the prompt. Add up first, then compare.

@task ctes-payroll-share
