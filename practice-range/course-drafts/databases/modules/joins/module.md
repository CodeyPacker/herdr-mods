---
id: course:databases/module/joins
title: How joins are run
requires: []
outcomes: []
tasks: []
drills: []
---

A join combines rows from two tables. The database has three ways to do it, and each suits a different amount of data. This module covers the three methods, how to recognise them in a plan, and the join mistakes that make queries slow.

## The problem a join solves

A join asks: for each row in one table, which rows in the other table match it? With 10,000 customers and 1 million orders, comparing every pair would mean 10 billion comparisons. The three join methods are three ways of avoiding that.

Which one the planner picks depends on how many rows come from each side and on which indexes exist. So a join can be fast with one set of values and slow with another, although the SQL is the same.

```sql
SELECT c.name, o.total
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE c.country = 'NZ';
```

## Nested loop

A **nested loop** takes each row from the first table (the outer side) and looks up its matches in the second table (the inner side).

If the inner side has an index on the join column, each lookup is a quick index scan. The total cost is the number of outer rows multiplied by the cost of one lookup.

That makes a nested loop the best method when the outer side is small: a few rows or a few hundred. It is also the only method that can return its first rows at once, which matters for queries with a small `LIMIT`.

It becomes very slow when the outer side is large, because the lookup is repeated for every row. And without an index on the inner side, each "lookup" is a scan of the whole inner table.

```text example nested readonly
   for each customer in NZ          (outer side: 30 rows)
       look up that customer's      (inner side: an index scan
       orders by customer_id         on orders, 30 times)

   30 lookups of about 4 pages each  =  about 120 page reads

   with 300,000 outer rows it would be 300,000 lookups
```

## Hash join

A **hash join** reads the smaller table once and builds a lookup table from it in memory, keyed by the join column. This lookup table is a hash table. It then reads the larger table once and, for each row, checks the hash table for a match.

Each table is read exactly once, and each check is a single memory operation. No index is needed. That makes a hash join the usual choice when both sides are large and most of their rows take part.

Its costs are memory and a slow start. The hash table must fit in the memory allowed for one operation. If it does not, the database splits the work into batches written to temporary files on disk, which is much slower. And no row can be returned until the hash table is complete.

A hash join works only for equality conditions (`a.x = b.x`).

```text example hash readonly
   step 1: read customers once, build a hash table in memory

           id 17 -> "Ana"
           id 18 -> "Bilal"
           id 19 -> "Chen"

   step 2: read orders once, and look up each order's customer_id

           order 501, customer 18  ->  found "Bilal"
           order 502, customer 17  ->  found "Ana"
           order 503, customer 44  ->  not found, skipped
```

## Merge join

A **merge join** needs both inputs sorted by the join column. It then walks down both at the same time, like closing a zip, and matches rows as it goes.

If both sides are already sorted, because an index provides that order, a merge join is very cheap and needs almost no memory. If they are not, the database has to sort them first, and the sort is the expensive part.

It is the method for joining two very large inputs that are already in order.

| Method | Best when | Needs | Weak when |
| --- | --- | --- | --- |
| Nested loop | One side is small | An index on the inner side | The outer side is large |
| Hash join | Both sides are large | Memory for the smaller side | The smaller side does not fit in memory |
| Merge join | Both sides are already sorted | Sorted inputs | The inputs must be sorted first |

## The wrong method {prediction}

A plan shows a nested loop. The planner expected 5 rows from the outer side. In `EXPLAIN ANALYZE` the outer side produced 400,000 rows, and the inner index scan shows `loops=400000`.

:::question wrong-join
What went wrong?
- [ ] Nested loops are always slow and should never be used :: For 5 outer rows, a nested loop is the best method there is.
- [x] The planner chose a method suited to 5 rows, and it was run on 400,000 :: The estimate was wrong. With a correct estimate, the planner would have chosen a hash join, which reads each table once.
- [ ] The inner table has no index :: It is doing index scans. Each is fast. There are 400,000 of them.
:::

## Index the join columns

For a nested loop to be cheap, the inner side needs an index on the column being matched. Primary keys always have one. Foreign key columns do not get one automatically in PostgreSQL.

So this is one of the most common causes of a slow join: a query finds a few customers and then needs their orders, and `orders.customer_id` has no index. Each "lookup" scans the whole `orders` table.

The rule of thumb is to index every foreign key column that you join on or filter by. It also speeds up deleting a parent row, since the database must check for children.

## Filter before joining

The fewer rows that enter a join, the cheaper it is. The planner tries to apply conditions as early as it can, and it also chooses the order in which tables are joined, starting with whatever produces the fewest rows.

You help it most by giving it conditions it can use.

- Put selective conditions on indexed columns.
- Keep statistics current, so the planner knows which side is small.
- Avoid wrapping join columns in functions or joining columns of different types. Both stop an index from being used.

With many tables, the number of possible join orders grows very quickly, and the planner cannot try them all. Queries that join eight or ten tables are the ones where plans most often go wrong.

## Joins that multiply rows

A join returns one row for every matching pair. When one row on the left matches several on the right, the left row is repeated. Joining to two such tables at once multiplies them together.

```sql
SELECT c.id, sum(o.total), count(t.id)
FROM customers c
JOIN orders o  ON o.customer_id = c.id
JOIN tickets t ON t.customer_id = c.id
GROUP BY c.id;
```

A customer with 10 orders and 5 tickets produces 50 rows before grouping. Each order is counted 5 times, so the sum is 5 times too large, and the ticket count is 10 times too large. The query runs without error and returns wrong numbers.

The fix is to total each table separately, in a subquery, and then join the totals, so that each side has one row per customer.

```text example fanout readonly
   customer 17: 3 orders, 2 tickets

   orders        tickets          joined rows (3 x 2 = 6)
   o1  40        t1               o1 t1     o1 t2
   o2  10        t2               o2 t1     o2 t2
   o3  25                         o3 t1     o3 t2

   sum(total) should be 75        the join gives 150
   count(tickets) should be 2     the join gives 6
```

## One query per row

A join problem often lives in the application, not in SQL. Code fetches a list of 100 orders with one query, then loops over them and runs one more query per order to fetch its customer. That is 101 queries where one join would do.

It is called the **N+1 problem**. Each query is fast, so nothing looks slow in the database's own statistics. The time goes into 100 extra round trips. It appears most with libraries that load related data automatically when a property is first read.

The cure is to fetch the related rows together: a join, or one second query with `WHERE customer_id IN (...)` for the whole list.

## Wrong totals {prediction}

A report joins `products` to `order_lines` and to `reviews`, and computes `sum(order_lines.quantity)` per product. A product has 200 order lines and 12 reviews.

:::question fanout
What does the report show for that product's quantity?
- [ ] The correct total :: Each order line is paired with every review of the product.
- [x] 12 times the correct total :: Each of the 200 order lines appears once for each of the 12 reviews, so every quantity is added 12 times.
- [ ] An error, since the two tables are unrelated :: SQL allows it. Both are joined to the product, and the result is a silent multiplication.
:::

## Exercise: diagnose the join {independent}

An "account overview" page is slow for large accounts and fine for small ones. Its query joins `accounts`, `users`, `projects` and `tasks` to list every task for an account. You are given these facts.

1. The plan uses nested loops throughout.
2. For a small account, the `projects` step returns 3 rows. For the slow account it returns 40,000, and the planner estimated 5.
3. The step on `tasks` is a `Seq Scan` with `Filter: (project_id = ...)` and `loops=40000`.
4. `tasks.project_id` is a foreign key with no index.

Explain why the page is slow for large accounts only. List the changes you would make, with the most important first.

## One possible answer {walkthrough}

**Why only large accounts.** For a small account, the nested loop runs the inner step 3 times. For the large one it runs it 40,000 times. And that inner step is a sequential scan of the entire `tasks` table, since `project_id` has no index. Forty thousand full scans of a large table is the whole problem. For 3 projects, the same flaw is 3 scans and goes unnoticed.

**Changes, in order**

1. **Add an index on `tasks.project_id`.** Each inner lookup becomes an index scan of a few pages. This alone turns the query from unusable to acceptable. It also fixes the same hidden cost for every other query that finds tasks by project.
2. **Refresh the statistics** with `ANALYZE` on `projects`, and find out why the estimate is 5 when the truth is 40,000. This account is an outlier in skewed data. With a correct estimate, the planner would choose a hash join for the large account: read the account's projects once and read the tasks once.
3. **Check the other foreign keys** in the query (`users.account_id`, `projects.account_id`) for the same missing index.
4. **Look at the page itself.** Listing every task of 40,000 projects on one page is rarely what anyone needs. Paging the result, or showing counts with the detail on request, removes most of the work.

The first change is the fix. The fourth is the one that questions whether the query should exist in this form.
