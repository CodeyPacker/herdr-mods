---
id: course:databases/module/plans
title: Read a query plan
requires: []
outcomes: []
tasks: []
drills: []
---

The database decides how to run each query, and it will show you its decision. This module covers how to ask for a plan, how to read one, and how to spot the difference between what the database expected and what happened.

## The planner

SQL says what you want, not how to get it. A part of the database called the **planner** (or optimizer) works out how. For one query there may be many ways: scan the table or use an index, join in one order or another. The planner estimates the cost of each and picks the cheapest.

The result is a **query plan**: a tree of steps. Each step takes rows from the steps below it and passes rows up.

To estimate costs, the planner needs to know roughly how many rows each step will produce. It gets that from **statistics** that the database keeps about every table: how many rows it has, how many distinct values each column has, which values are most common, and how values are spread.

## Ask for the plan

Put `EXPLAIN` in front of a query to see the plan without running it.

```sql
EXPLAIN SELECT * FROM orders WHERE customer_id = 17;
```

`EXPLAIN ANALYZE` runs the query and shows the plan together with what really happened: the true row counts and the time each step took.

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE customer_id = 17;
```

`BUFFERS` adds the number of pages each step touched, which is the cost measure from the first module.

One warning. `EXPLAIN ANALYZE` really executes the statement. On an `UPDATE` or `DELETE` it changes the data. Wrap such a statement in a transaction and roll it back.

## Read one step

Each line of a plan is one step with the same parts.

```text example one-step readonly
Index Scan using orders_customer_id_idx on orders
  (cost=0.43..12.50 rows=4 width=96)
  (actual time=0.021..0.034 rows=3 loops=1)
  Index Cond: (customer_id = 17)
  Buffers: shared hit=5

  cost=0.43..12.50    the planner's estimate, in its own units
  rows=4              rows it expected this step to produce
  actual ... rows=3   rows it really produced
  loops=1             how many times the step ran
  shared hit=5        pages touched, all found in memory
```

Three things deserve attention first.

- The **type of step**: how the rows were found.
- **Estimated rows against actual rows**: whether the planner's picture of the data was right.
- **Where the time is**: which step accounts for most of it.

The cost numbers have no unit you can convert to milliseconds. They are for comparing one plan with another.

## The common steps

| Step | What it does | Good when |
| --- | --- | --- |
| Seq Scan | Reads every page of the table | The query needs a large share of the rows |
| Index Scan | Finds entries in an index, then visits the table for each | Few rows match |
| Index Only Scan | Answers from the index alone | The index covers the query |
| Bitmap Heap Scan | Collects row locations from an index, sorts them by page, then visits each page once | A middling number of rows match |
| Sort | Sorts its input | No index gives the order |
| Hash Join, Nested Loop, Merge Join | Three ways to join, covered in the next module | |
| Aggregate | Computes `count`, `sum`, `GROUP BY` | |
| Limit | Stops after N rows | |

A `Seq Scan` is not a fault in itself. On a small table, or for a query that needs most of the rows, it is the right choice. It is a fault when it reads millions of rows to return a few.

## Read a tree

A plan with several steps is indented. Each step's inputs are the more deeply indented steps beneath it. Read it from the innermost steps outward: those run first and feed the steps above.

```text example tree readonly
Limit  (actual time=0.05..0.31 rows=20 loops=1)
  ->  Sort  (actual time=0.05..0.30 rows=20 loops=1)
        Sort Key: created_at DESC
        ->  Index Scan using orders_customer_id_idx on orders
              (actual time=0.02..0.21 rows=180 loops=1)
              Index Cond: (customer_id = 17)

   1. Index Scan   finds this customer's 180 orders
   2. Sort         sorts all 180 by date
   3. Limit        keeps the first 20
```

This plan works, and it shows something to improve. The database fetched and sorted 180 rows to return 20. An index on `(customer_id, created_at)` would return them in order, and the `Sort` step would disappear.

## Rows removed by a filter

A line that reads `Rows Removed by Filter` tells you how much work was wasted. The step read those rows and threw them away.

```text example filter readonly
Seq Scan on orders  (actual time=0.02..840.11 rows=3 loops=1)
  Filter: (customer_id = 17)
  Rows Removed by Filter: 19999997
  Buffers: shared read=200000

   read 20,000,000 rows, kept 3
   200,000 pages read from disk
```

This is the clearest sign that an index is missing. The ratio of rows removed to rows kept is the size of the waste.

The difference between `Index Cond` and `Filter` under an index scan carries the same meaning. A condition listed as `Index Cond` was used to find the entries. A condition listed as `Filter` was checked afterwards, row by row.

## What the plan says {prediction}

A query for one user's notifications shows this step:

```text
Seq Scan on notifications  (actual time=0.03..1210.50 rows=12 loops=1)
  Filter: (user_id = 5521)
  Rows Removed by Filter: 31999988
```

:::question read-plan
What is the problem, and what would fix it?
- [ ] The table is too large and should be split :: The size is not the fault. Finding 12 rows should not require reading all of them.
- [x] The database read 32 million rows to keep 12. An index on `user_id` would fix it :: `Seq Scan` with a huge `Rows Removed by Filter` means no usable index exists for this condition.
- [ ] The statistics are wrong :: Nothing here compares an estimate with an actual count. The plan is slow because it has no better option.
:::

## When the estimate is wrong

The planner chooses a plan from its row estimates. When an estimate is far off, it can choose badly. In `EXPLAIN ANALYZE`, compare `rows=` in the estimate with `rows=` in the actual part, for each step.

A step that expected 10 rows and produced 800,000 is the place to look. The planner chose a method that suits 10 rows, and it was run on 800,000.

Common causes of bad estimates:

- **Stale statistics.** The table changed a lot since statistics were last gathered. Running `ANALYZE tablename` refreshes them. PostgreSQL does this automatically in the background, and a large load of data can get ahead of it.
- **Related columns.** The planner assumes columns are independent. If `city = 'Paris'` and `country = 'France'` are both in the query, it multiplies the two shares and expects far fewer rows than exist.
- **Conditions it cannot see into**, such as a function applied to a column.

```text example estimate readonly
Nested Loop  (cost=... rows=12 ...) (actual ... rows=790000 loops=1)
  ->  Index Scan on customers  (rows=1) (actual rows=1)
  ->  Index Scan on orders     (rows=12) (actual rows=790000)

   expected 12 rows, got 790,000
   the plan was chosen for a customer with a few orders
```

## The same query, two plans

A query can be fast for one value and slow for another. Looking up the orders of a normal customer returns 10 rows, and an index scan is ideal. Looking up the orders of the one enormous customer returns a third of the table, and a different plan would be better.

Data that is unevenly spread like this is called **skewed**. It explains reports such as "the page is slow only for this one account". When you investigate, use `EXPLAIN ANALYZE` with the exact values from the slow case.

## Loops multiply

`loops` is how many times a step ran. The time and rows shown for a step are for one loop. A step with `actual time=0.05 rows=1 loops=40000` did not take 0.05 ms. It took 0.05 ms forty thousand times, which is 2 seconds.

Missing this is the most common mistake in reading a plan. Always multiply by `loops` before deciding which step is slow.

## Which step is slow {prediction}

A plan contains these two steps:

```text
->  Seq Scan on customers   (actual time=0.01..35.00 rows=50000 loops=1)
->  Index Scan on orders    (actual time=0.02..0.06 rows=4 loops=50000)
```

:::question loops
Where does most of the time go?
- [ ] The sequential scan, at 35 ms :: It ran once and took 35 ms in total.
- [x] The index scan, at about 3 seconds in total :: 0.06 ms looks small, and it ran 50,000 times. 50,000 times 0.06 ms is 3,000 ms.
- [ ] Neither. Both steps are fast :: The index scan is fast each time and slow in total.
:::

## Exercise: read a plan {independent}

A dashboard query takes 4 seconds. Here is its plan.

```text example exercise-plan readonly
Sort  (actual time=4102.10..4102.15 rows=40 loops=1)
  Sort Key: (count(*)) DESC
  ->  HashAggregate  (actual time=4101.80..4101.95 rows=40 loops=1)
        Group Key: country
        ->  Seq Scan on signups
              (cost=... rows=900 ...)
              (actual time=0.02..3650.00 rows=2100000 loops=1)
              Filter: (created_at >= '2025-01-01')
              Rows Removed by Filter: 58000000
              Buffers: shared read=750000
```

Answer these: which step takes the time, how many rows it read and kept, whether the estimate was right, and what you would do. Say whether the `Sort` at the top is a problem.

## One possible answer {walkthrough}

**Where the time goes.** The `Seq Scan` finishes at 3,650 ms out of 4,102. The aggregate and the sort add under half a second together.

**Rows.** It read about 60 million rows, kept 2.1 million and threw away 58 million. It read 750,000 pages, all from disk (`read`, not `hit`).

**The estimate.** It expected 900 rows and got 2.1 million. The statistics are badly out of date, probably because a lot of recent data was loaded since they were gathered. Here the plan would be a sequential scan either way, since no index exists. A wrong estimate like this can still mislead the steps above it, so run `ANALYZE signups`.

**The fix.** Add an index on `created_at`. The condition keeps 2.1 million of 60 million rows, about 3.5%, which is selective enough for an index to pay off. Since the query needs only `country` from each row, an index on `(created_at) INCLUDE (country)` allows an index-only scan and avoids the table completely.

**The sort.** It sorts 40 rows, one per country, in a fraction of a millisecond. It is not a problem. A `Sort` matters when its input is large.

For a dashboard that refreshes often, a further step is to keep a small table of daily counts per country and query that. That idea is covered in the module on duplicating data.
