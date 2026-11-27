---
id: course:databases/module/tuning
title: Find and fix a slow query
requires: []
outcomes: []
tasks: []
drills: []
---

This module puts the earlier ones together into one method. Given a query that is too slow, it shows what to check, in which order, and how to tell that a fix worked.

## The method

Use the same steps every time.

1. **Measure.** Get the exact query, with real values, and its real time.
2. **Decide whether the time is in the database.** It may be in round trips, in waiting for a connection or in waiting for a lock.
3. **Read the plan.** Find the step that takes the time.
4. **Name the cause.** One of a short list.
5. **Change one thing.**
6. **Measure again**, with the same values.

Skipping step 1 or step 6 is how people "fix" a query that was never the problem, or add an index that changes nothing.

```text example method readonly
   1. measure        which query, which values, how long?
          |
   2. where?         database work / round trips / pool / lock wait
          |
   3. plan           EXPLAIN (ANALYZE, BUFFERS)
          |
   4. cause          missing index? bad estimate? too many rows?
          |
   5. one change
          |
   6. measure again  same values, compare
```

## Step 1: get the real query

A report such as "the orders page is slow" is not a query. Find the SQL that is sent, and the values it is sent with. A query that is fast for an ordinary customer can be slow for the largest one.

Sources for the real query: the slow query log, the query statistics from the maintenance module, or the application's own tracing.

Run it yourself and note the time. Run it twice, since the first run may include reading pages from disk.

## Step 2: is the time in the database

Compare the time the database reports for the query with the time the application measures around it.

| Database says | Application says | The time is in |
| --- | --- | --- |
| 3 ms | 900 ms, across 300 queries | Round trips. An N+1 pattern |
| 3 ms | 2,000 ms, for one query | Waiting for a pooled connection, or the network |
| 4,000 ms, mostly waiting | 4,000 ms | A lock. Find the blocker |
| 4,000 ms, working | 4,000 ms | The query itself. Read the plan |

Only the last row is a query tuning problem. The others are solved in the application, the pool or the transaction that holds the lock, and no index will help them.

## Where is the time {prediction}

A page takes 1.4 seconds. The database's statistics show that the page's queries average 2 ms each. The application's trace shows 480 database calls for one page view.

:::question where-time
What should be changed?
- [ ] Add indexes to make each query faster than 2 ms :: Each query is already fast. Halving it would save little.
- [x] Reduce the number of queries, by fetching related rows together :: 480 calls at roughly 3 ms each, including the round trip, account for the whole 1.4 seconds. This is an N+1 pattern.
- [ ] Increase the connection pool :: The page uses one connection for its calls. Nothing is waiting for a connection.
:::

## Step 3: read the plan

Run `EXPLAIN (ANALYZE, BUFFERS)` with the slow values, and look for these, in order.

1. **The step with the most time**, remembering to multiply by `loops`.
2. **Rows removed by a filter.** A step that reads far more rows than it keeps.
3. **Estimated against actual rows.** A large gap means the planner was misled.
4. **Sorts and hashes that went to disk.** Marked by "external merge" or by several batches.
5. **Pages read.** A large `read` count means the data was not in memory.

One of these nearly always points at the cause.

## Step 4: the usual causes

Most slow queries have one of a small number of causes, each with a matching fix.

| Sign in the plan | Cause | Fix |
| --- | --- | --- |
| Seq Scan, many rows removed by filter | No usable index | Add an index on the filtered column |
| Index exists and is not used | The column is wrapped in a function, the types differ, or a leading column is skipped | Rewrite the condition, or index the expression |
| Sort of many rows before a small LIMIT | The index does not give the order | A composite index: equality columns, then the sort column |
| Nested loop with huge `loops` | A bad row estimate | Run `ANALYZE`. Check for skewed data |
| Inner side of a join is a Seq Scan | The foreign key column has no index | Index it |
| Index Scan with many heap fetches | Too many rows visited | A covering index, or return fewer rows |
| Everything is simply large | The query asks for too much | Page it, summarise it, or precompute it |

The last row is a different kind of answer. Some queries are slow because they do a great deal of legitimate work. No index makes "total every order since 2015" cheap. Those are handled by asking for less, or by keeping a summary.

## Step 5: change one thing

Make one change and test it. If you add two indexes, rewrite the query and raise a memory setting all at once, you will not know which change helped, and you will keep all of them, including the ones that only add cost.

Test an index on a copy of production data when you can. A test database with a thousand rows will choose a different plan from one with a hundred million, so results from small data tell you little.

Build new indexes with `CREATE INDEX CONCURRENTLY` on a live system.

## Step 6: measure again

Run the same query with the same values and compare the plans. Check that:

- the slow step is gone or changed,
- the time dropped by the amount you expected,
- the pages read went down.

Then check what the change cost. A new index slows writes to that table. Look at the insert and update times of the busiest write paths afterwards. Check the other slow value too: a plan that suits the largest customer should not make the ordinary case worse.

## A worked example

A support screen lists a customer's 20 most recent tickets and takes 3 seconds for large customers.

```sql
SELECT id, subject, status, created_at
FROM tickets
WHERE customer_id = 9001
ORDER BY created_at DESC
LIMIT 20;
```

```text example before readonly
Limit  (actual time=3104.2..3104.3 rows=20 loops=1)
  ->  Sort  (actual time=3104.2..3104.2 rows=20 loops=1)
        Sort Key: created_at DESC
        Sort Method: top-N heapsort
        ->  Index Scan using tickets_customer_id_idx on tickets
              (actual time=0.04..3050.1 rows=410000 loops=1)
              Index Cond: (customer_id = 9001)
              Buffers: shared hit=1200 read=388000
```

Reading it: the index on `customer_id` is used, which is good. It finds all 410,000 tickets of this customer, visiting 388,000 pages on disk. Then all of them are sorted to keep 20. The index finds the customer and does not give the order.

The fix is one composite index, with the equality column first and the sort column second.

```sql
CREATE INDEX CONCURRENTLY tickets_customer_created_idx
  ON tickets (customer_id, created_at DESC);
```

```text example after readonly
Limit  (actual time=0.05..0.11 rows=20 loops=1)
  ->  Index Scan using tickets_customer_created_idx on tickets
        (actual time=0.05..0.10 rows=20 loops=1)
        Index Cond: (customer_id = 9001)
        Buffers: shared hit=24
```

The `Sort` is gone. The scan reads 20 entries, already in order, and stops. 388,000 pages became 24. The old index on `customer_id` alone is now redundant and can be dropped, which gives back the write cost that the new one added.

## When the query is not the problem

Some slow queries cannot be fixed by tuning, because they should not run in that form.

- **A report on the live database at peak time.** Move it to a replica, or to a summary table built overnight.
- **A count of everything.** An exact `count(*)` over a huge table reads the whole table. Ask whether an estimate, a stored counter or "more than 10,000" would do.
- **A search with a leading wildcard.** `LIKE '%word%'` reads every row. Use a full-text index.
- **A page that shows everything.** Add paging.

The most effective tuning question is often whether the query needs to do this much work at all.

## Settings come last

Database settings, such as memory per sort or the size of the buffer cache, matter. They are the last thing to change, not the first.

A missing index makes a query a thousand times slower. A setting changes it by a small factor. Raising a memory limit to make a bad plan bearable also raises it for every other query, which can exhaust the server's memory under load. Fix the queries and the indexes first.

## Which cause {prediction}

A library generates the condition `WHERE account_id::text = '4411'`, which converts the column to text before comparing. The column `account_id` is a number, and it has an index. The plan shows a sequential scan of 60 million rows.

:::question type-mismatch
Why is the index not used?
- [ ] The index is damaged :: Nothing suggests that. Other queries use it.
- [x] The column is converted before the comparison, so the index on the stored number does not apply :: A conversion on the column side hides it from the index, like a function does. Compare the column, unconverted, with a number.
- [ ] One value in 60 million is not selective enough :: It is as selective as a condition can be. The index is being bypassed for another reason.
:::

## Exercise: tune it {independent}

An "unread notifications" badge runs this query on every page view, about 2,000 times a second. It averages 180 ms.

```sql
SELECT count(*) FROM notifications
WHERE user_id = ? AND read_at IS NULL;
```

The table has 900 million rows. There is one index, on `user_id`. A typical user has 4,000 notifications, of which 3 are unread. The plan shows an index scan on `user_id` returning about 4,000 rows, a filter on `read_at` that removes nearly all of them, and around 3,800 pages touched.

Work through the method. Say where the time goes, propose a fix, and say how you would check it. Then propose a second change that questions the query itself.

## One possible answer {walkthrough}

**Where the time goes.** The time is in the database, in the query's own work. The index finds all 4,000 of the user's notifications. Each one needs a visit to the table to check `read_at`, and those rows are scattered over about 3,800 pages. All of that work keeps 3 rows. The sign is "rows removed by filter", which is large compared with the rows kept.

**The fix.** A partial index that holds only unread notifications.

```sql
CREATE INDEX CONCURRENTLY notifications_unread_idx
  ON notifications (user_id) WHERE read_at IS NULL;
```

Nearly all 900 million rows are read, so this index is tiny by comparison, perhaps a thousandth of the full one. For a user with 3 unread notifications it holds 3 entries, and counting them touches a few pages. It can also be answered as an index-only scan.

**Checking it.** Run `EXPLAIN (ANALYZE, BUFFERS)` again for the same user. The plan should name the new index, the filter line should be gone, and the pages touched should fall from about 3,800 to under 10. Then watch the query's mean time in the statistics over a day, and check that marking a notification as read has not become slower. It should not, since that update now removes one small index entry.

**Questioning the query.** A badge does not need an exact, fresh count 2,000 times a second. Two options: cache the count per user for 30 seconds, or keep an `unread_count` column on the `users` table that is changed when notifications are created and read, with a periodic repair job. And the badge could show "9+" beyond nine, so that the query can stop early with a `LIMIT`.

Try the index first. It is one statement, it is easy to undo, and it will probably make the rest unnecessary.
