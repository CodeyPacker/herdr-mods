---
id: course:databases/module/denormalize
title: When to duplicate data
requires: []
outcomes: []
tasks: []
drills: []
---

Storing each fact once keeps data correct. Sometimes it also makes a frequent read too slow. This module covers when to store a second copy on purpose, the ways to keep it right, and where flexible columns such as JSON fit.

## The cost of the clean design

A normalized design answers every question by joining and totalling at the moment it is asked. Usually that is fast enough. Sometimes it is not.

Take a forum page that lists 50 threads with the number of replies in each. In a normalized design the count comes from the `replies` table, computed for 50 threads on every page view. With millions of replies and a busy page, that is real work repeated thousands of times a minute, to show numbers that seldom change.

**Denormalization** means storing a copy of data, or a value computed from it, so that a read does not have to work it out. A `reply_count` column on the `threads` table is the standard example.

It is a trade. Reads become cheaper. Writes become more expensive, and there are now two places that can disagree.

## Normalize first

Denormalize only after the normalized design has been tried and measured. In order:

1. Is there a missing index? Most "slow joins" are this.
2. Is the query asking for more than it needs?
3. Would a cache in front of the query do?
4. Only then, store a derived value.

The reason for the order is that the first three can be undone at no cost. A duplicated value has to be kept correct for as long as the system lives, by every piece of code that writes to the source.

## Three kinds of duplication

| Kind | Example | Purpose |
| --- | --- | --- |
| A stored total | `threads.reply_count` | Avoid counting on every read |
| A copied column | `orders.customer_name` beside `customer_id` | Avoid a join on a hot path |
| A summary table | `daily_sales (day, product_id, units, revenue)` | Avoid scanning millions of rows for a report |

The third is the most useful and the least risky. A summary table is separate from the source data, it is clearly derived, and it can be thrown away and rebuilt at any time.

```text example summary readonly
   order_lines  (400 million rows)            daily_sales  (300,000 rows)

   order   product   qty   price   day        day          product  units
   9001    12        2     4.00    03-04      2025-03-04   12       1,840
   9001    31        1     9.50    03-04      2025-03-04   31         412
   9002    12        1     4.00    03-04      2025-03-05   12       1,790
   ...                                        ...

   "units per product per day" reads 300,000 rows, not 400 million
```

## Keeping the copy right

A duplicated value is only as good as the mechanism that updates it. There are four, from strictest to loosest.

**In the same transaction.** The code that inserts a reply also runs `UPDATE threads SET reply_count = reply_count + 1`, in one transaction. The count is always exact. Every code path that adds or removes a reply must remember to do it.

**A trigger.** The database runs the update itself whenever a row is inserted or deleted in `replies`. No code path can forget. The logic is now hidden in the database, where people do not expect it, and it adds work to every write.

**A materialized view.** The database stores the result of a query as a table. You refresh it on a schedule. Between refreshes it is out of date.

**A background job.** A scheduled task recomputes the values every few minutes or hours. It is simple, it corrects itself, and it is the least fresh.

| Method | Freshness | Risk |
| --- | --- | --- |
| Same transaction | Exact | A code path forgets |
| Trigger | Exact | Hidden logic, slower writes |
| Materialized view | As of the last refresh | Stale between refreshes |
| Background job | Minutes to hours old | Stale, and the simplest to get right |

## The counter that drifted {prediction}

A `threads.reply_count` column is increased by the application whenever a reply is posted. Months later, a moderation tool is added that deletes spam replies directly from the `replies` table. It does not touch `threads`.

:::question drift
What happens to the counts?
- [ ] They stay correct, since the database links replies to threads :: A foreign key ensures a reply points at a real thread. It knows nothing about a count column.
- [x] They become too high, by the number of replies deleted :: The count is kept right only by code that remembers to update it. The new tool does not, and nothing reports the difference.
- [ ] The delete fails, since the count would be wrong :: Nothing enforces that the count matches the rows.
:::

## Plan for drift

Assume that any duplicated value will be wrong sooner or later: a bug, a manual fix, a failed job, a new tool. Build the repair in from the start.

- **Keep the source of truth.** The `replies` rows are the truth. The count is a convenience. Never keep only the derived value.
- **Be able to rebuild.** Have a query or job that recomputes every derived value from the source. Run it on a schedule, so errors correct themselves.
- **Check.** Compare a sample of stored values with freshly computed ones and alert on a difference.

A derived value that can be rebuilt is a safe optimisation. One that cannot be rebuilt has quietly become the only copy of some facts, with no way to tell whether it is right.

## A hot counter

Stored counters have a second problem under heavy writing. Every reply to a popular thread updates the same row in `threads`. Updates to one row happen one at a time, so the writers queue up behind each other. A post that gets thousands of likes a second turns its counter row into a bottleneck.

Two designs avoid it.

- **Count in the background.** Insert the like rows without touching a counter, and let a job update the total every few seconds. The count is slightly behind, which is usually acceptable.
- **Split the counter.** Keep several counter rows per post, add to one chosen at random, and sum them when reading.

```text example hot-row readonly
   every like does:  UPDATE posts SET likes = likes + 1 WHERE id = 88

   writer 1  holds the row     updates   commits
   writer 2      waits ........ holds    updates   commits
   writer 3      waits ................. waits ..... holds ...
   writer 4      waits ....................................

   one row, one writer at a time: the rest stand in line
```

## JSON columns

PostgreSQL can store a JSON document in a column (the `jsonb` type) and query inside it. This relaxes the fixed table structure for part of a row.

It suits data whose shape really varies or is not yours to define.

- Settings that differ for each kind of integration.
- The raw payload received from an external system.
- Optional attributes that differ per product category.

It suits badly anything you filter by, join on or need to trust. Inside a JSON value there are no column types, no `NOT NULL`, no foreign keys. A misspelt key is accepted without complaint. Queries into JSON are slower and need special indexes.

A good rule is that columns you query by, and columns that must be correct, are real columns. The loosely shaped remainder can be JSON. If a JSON field starts to appear in `WHERE` clauses, promote it to a real column.

## History and audit data

Another reason to store more than the current state is to know what happened. An `orders.status` column tells you the status now. It cannot tell you when the order was paid or who cancelled it.

The usual design is an append-only table of events beside the current-state table: `order_events (order_id, happened_at, kind, actor, details)`. Rows are only ever inserted. The current state can be rebuilt from them, and questions about the past have answers.

This is also duplication, with a clear owner. The event rows are the record, and the status column is a summary of them.

## Which mechanism {prediction}

A finance dashboard shows revenue per product per month for the last three years. It is opened a few dozen times a day. The source is 400 million order lines, and the query takes 90 seconds. Figures from yesterday are acceptable.

:::question mechanism
Which approach fits best?
- [ ] A trigger that updates a running total on every order line :: It gives exact freshness that nobody asked for, and adds work to every sale.
- [x] A summary table or materialized view, rebuilt each night :: The data may be a day old, the result is small, and it can be rebuilt from the source at any time. The dashboard then reads a few thousand rows.
- [ ] More indexes on `order_lines` :: The query needs nearly every row in the range. An index does not make reading 400 million rows cheap.
:::

## Exercise: decide what to duplicate {independent}

A recipe site has `recipes` (200,000 rows), `ratings` (60 million rows, one per user per recipe) and `users`. Three pages are slow.

1. The recipe page shows the average rating and the number of ratings. It gets 800 views a second.
2. The home page lists the 20 highest-rated recipes of the past week.
3. Each rating on a recipe page shows the reviewer's display name, fetched by joining `users`.

For each, say whether you would denormalize, what you would store and how it is kept correct. Say which of the three you would leave normalized.

## One possible answer {walkthrough}

1. **Denormalize.** Store `rating_count` and `rating_sum` on `recipes`, and compute the average as their ratio when reading. Two numbers that can be added to are easier to keep right than a stored average. Update them in the same transaction as each rating. One caution: when a user changes an earlier rating, adjust the sum by the difference. A nightly job recomputes both columns from `ratings` to repair any drift. At 800 views a second this removes 800 aggregate queries a second.

2. **A summary, refreshed on a schedule.** "Top 20 of the past week" need not be exact to the second. A job computes the list every 10 minutes into a small table or a cache entry. The home page reads 20 rows.

3. **Leave it normalized.** A page shows perhaps 20 ratings, and fetching 20 users by primary key is a few milliseconds. Copying the display name onto 60 million rating rows would mean updating all of a user's ratings whenever they rename themselves. The join is cheap and the copy is expensive. If this page is slow, the cause is elsewhere. Look for a missing index on `ratings.recipe_id`, or a query per rating.

The third case is the common trap: denormalizing a join that was never the problem. Measure first.
