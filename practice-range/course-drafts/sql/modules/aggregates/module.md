---
id: course:sql-foundations/module/aggregates
title: Summarize many rows
requires: ["filter","null","coalesce","alias","expression","column-list"]
outcomes: [{"id":"count","can":"Choose between counting rows and counting values that are present.","assessment":["two-counts","course:sql-foundations/task/aggregates-count-emails"]},{"id":"average","can":"Predict how missing values affect an average.","assessment":["two-averages","course:sql-foundations/task/aggregates-average-bonus"]},{"id":"empty","can":"Predict what aggregates return when no row passes the filter.","assessment":["no-rows"]},{"id":"mix","can":"Read the error from mixing a plain column with an aggregate.","assessment":["mix"]},{"id":"summary","can":"Summarize the rows that pass a filter.","assessment":["course:sql-foundations/task/aggregates-stock-summary"]}]
tasks: [{"id":"course:sql-foundations/task/aggregates-count-emails","path":"tasks/count-emails/task.json"},{"id":"course:sql-foundations/task/aggregates-stock-summary","path":"tasks/stock-summary/task.json"},{"id":"course:sql-foundations/task/aggregates-average-bonus","path":"tasks/average-bonus/task.json"}]
review: {"task":"course:sql-foundations/task/aggregates-average-bonus","afterModule":"course:sql-foundations/module/joins","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["aggregates/count-star","aggregates/count-column","aggregates/count-distinct","aggregates/sum","aggregates/avg","aggregates/min-max"]
drillGap: These drills practise one aggregate each. They do not compare counting rows with counting values.
---

So far every result row came from one table row. An aggregate function turns many rows into one value: a count, a total, an average. This module covers the five common ones and the difference between counting rows and counting values.

## Many rows, one value

An **aggregate function** takes a whole column of values and returns one.

| Function | Returns |
| --- | --- |
| `count(*)` | the number of rows |
| `count(column)` | the number of rows where that column is not `NULL` |
| `count(DISTINCT column)` | the number of different values |
| `sum(stock)`, `avg(price)` | the total and the average |
| `min(price)`, `max(price)` | the smallest and the largest |

- A query whose `SELECT` list holds only aggregates returns exactly one row.
- `WHERE` is applied first, so the aggregates see only the rows that passed it.


## Two kinds of count {prediction}

One product, the Gift Card, has no category. Predict the first two numbers.

```sql example counts
SELECT count(*) AS products,
       count(category_id) AS with_category,
       min(price) AS cheapest,
       max(price) AS dearest
FROM products;

```

```output
Your query returned:
 products | with_category | cheapest | dearest
----------+---------------+----------+---------
 24       | 23            | 14.50    | 1649.00
(1 row)
```

:::question two-counts example=counts
What are products and with_category?
- [ ] 24 and 24 :: count(category_id) skips the row whose category_id is NULL.
- [x] 24 and 23 :: There are 24 product rows, so `count(*)` is 24. `count(category_id)` skips the one row where `category_id` is `NULL` and gives 23. `min` and `max` look at every price, and all four answers sit in a single result row.
- [ ] 23 and 23 :: count(*) counts rows whatever they contain, so it is 24.
:::

## Aggregates skip NULL

`sum`, `avg`, `min` and `max` ignore `NULL` values.

- For `avg` that changes the answer, because a skipped row does not count toward the number it divides by. `avg(bonus_pct)` is the average among employees who have a bonus.
- To count the others as 0, give them a value first: `avg(COALESCE(bonus_pct, 0))`.


## Two averages {prediction}

15 of the 24 employees have a `bonus_pct`. Predict which average is larger.

```sql example averages
SELECT count(bonus_pct) AS with_bonus,
       ROUND(avg(bonus_pct), 2) AS avg_bonus,
       ROUND(avg(COALESCE(bonus_pct, 0)), 2) AS avg_all
FROM employees;

```

```output
Your query returned:
 with_bonus | avg_bonus | avg_all
------------+-----------+---------
 15         | 12.33     | 7.71
(1 row)
```

:::question two-averages example=averages
Which is larger, avg_bonus or avg_all?
- [x] avg_bonus :: `avg_bonus` is 12.33: the 15 known percentages added up and divided by 15. `avg_all` is 7.71: the same total divided by 24, because `COALESCE` turned the nine missing values into 0. Neither is wrong. They answer different questions, so decide which one the request means.
- [ ] avg_all :: Counting the missing values as 0 adds nothing to the total but raises the number it is divided by.
- [ ] They are equal :: avg skips NULL, so the two versions divide by different numbers.
:::

## No rows at all {prediction}

No product has category 99. Predict the two values.

```sql example empty
SELECT count(*) AS products, sum(stock) AS units
FROM products
WHERE category_id = 99;

```

```output
Your query returned:
 products | units
----------+-------
 0        | NULL
(1 row)
```

:::question no-rows example=empty
What are products and units?
- [ ] 0 and 0 :: sum over no rows is NULL. Only count returns 0.
- [ ] The result has no rows :: A query with only aggregates always returns one row.
- [x] 0 and NULL :: A query with only aggregates still returns one row. `count(*)` of nothing is 0. `sum` of nothing is `NULL`, not 0, because there were no values to add, and the same holds for `avg`, `min` and `max`. Wrap the sum in `COALESCE` when a report needs 0.
:::

## Find the error {prediction}

This example does not run. Find the line PostgreSQL stops at, and why.

```sql example mix diagnostics=[{"code":"42803","line":1}]
SELECT name, max(price)
FROM products;

```

:::question mix example=mix
Which error does PostgreSQL report?
- [x] Line 1, 42803: `name` must be grouped or used in an aggregate. :: `max(price)` produces one value for the whole table, but `name` has 24 values, and SQL will not guess which one you want. The next module introduces `GROUP BY`, and a later one shows how to get the row that holds the maximum.
- [ ] Line 1: `max` works only on whole numbers. :: `max` works on any values that can be compared, including prices with a fraction.
- [ ] Line 2: `products` must be grouped before `max` can read it. :: An aggregate can read a whole table without `GROUP BY`. The problem is the plain column beside it.
:::

## Count the customers with an email {modification}

The starter counts rows twice. Change one count so it counts emails.

@task aggregates-count-emails

## Summarize what is on sale {independent}

Work from the prompt. Three aggregates, one filter.

@task aggregates-stock-summary
