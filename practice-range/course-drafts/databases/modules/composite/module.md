---
id: course:databases/module/composite
title: Indexes on several columns
requires: []
outcomes: []
tasks: []
drills: []
---

Most real queries filter on more than one column and sort the result. One index on several columns can serve such a query completely, if its columns are in the right order. This module covers that order, and indexes that answer a query without touching the table.

## A composite index

A **composite index** (also called a multi-column index) is sorted by its first column, then by its second within equal values of the first, and so on. A phone book works the same way: sorted by surname, then by first name within each surname.

```sql
CREATE INDEX orders_customer_created_idx
  ON orders (customer_id, created_at);
```

In this index, all of one customer's orders sit next to each other, and within that group they are in date order.

```text example composite readonly
   index on (customer_id, created_at)

   customer_id   created_at     row location
   -----------   ----------     ------------
   17            2025-01-03     page 88
   17            2025-02-11     page 412
   17            2025-03-04     page 9
   18            2025-01-20     page 77
   18            2025-03-01     page 301
   19            2024-12-30     page 55

   sorted by customer first, then by date inside each customer
```

## The leftmost prefix rule

A phone book finds "Okafor" at once, and "Okafor, Bilal" at once. It is useless for finding everyone called "Bilal", since they are scattered through every surname.

A composite index behaves the same way. It can be used for conditions on its first column, or its first two, or its first three. It cannot be used efficiently for a condition that skips the first column. This is the **leftmost prefix rule**.

For an index on `(customer_id, created_at)`:

| Condition | Index usable? |
| --- | --- |
| `customer_id = 17` | Yes |
| `customer_id = 17 AND created_at >= '2025-02-01'` | Yes, fully |
| `created_at >= '2025-02-01'` | No. The dates are scattered across all customers |

One practical result: an index on `(customer_id, created_at)` already serves every query that an index on `(customer_id)` alone would serve. Keeping both wastes a write on every insert.

## Choosing the column order

The order follows from how the query uses each column. A rule that works for most queries:

1. **Columns compared with `=` first.**
2. **Then the column used for a range or for sorting.**

The reason is how the index is read. Equality conditions narrow the search to one continuous stretch of the index. Inside that stretch, the next column is in sorted order, so a range on it is another continuous stretch, and an `ORDER BY` on it needs no sorting at all.

Once a range condition is applied to a column, the columns after it in the index are no longer in useful order, so they cannot narrow the search further.

```text example order readonly
   query:  WHERE status = 'open' AND created_at >= '2025-03-01'

   index (status, created_at)            index (created_at, status)

   closed  2025-01-02                    2025-01-02  closed
   closed  2025-03-03                    2025-03-01  open      <- start
   open    2025-02-10                    2025-03-02  closed       reads
   open    2025-03-01  <- start          2025-03-03  closed       all of
   open    2025-03-04     reads only     2025-03-04  open         these,
   open    2025-03-09  <- end            2025-03-09  open      <- keeps 3
   pending 2025-01-15

   3 entries read, 3 kept                6 entries read, 3 kept
```

## Which order {prediction}

A query runs often:

```sql
SELECT * FROM messages
WHERE chat_id = 9001
ORDER BY sent_at DESC
LIMIT 50;
```

:::question column-order
Which index serves it best?
- [ ] `(sent_at)` :: The database would walk all messages of every chat in date order, skipping those of other chats, until it had found 50.
- [ ] `(sent_at, chat_id)` :: The first column is the sort column, so the entries for one chat are still scattered.
- [x] `(chat_id, sent_at)` :: All messages of chat 9001 are together and already in date order. The database reads the last 50 entries of that group and stops.
:::

## Sorting for free

Sorting a large result is expensive. The database must collect every matching row and sort them, in memory if they fit and on disk if not, before it can return the first one.

An index is already sorted. When the `ORDER BY` matches the index order, the database reads the rows in that order and skips the sort. With a `LIMIT`, it stops as soon as it has enough rows.

This is the difference between a "latest 20 items" query that takes a millisecond and one that takes seconds. With the right index, it reads 20 entries. Without it, it finds all matching rows, sorts them and throws away all but 20.

## Covering indexes

An ordinary index lookup has two steps: find the entry in the index, then visit the table page for the rest of the row. The second step is the expensive one when there are many rows, since each visit is a separate page.

If the index contains every column the query needs, the second step can be skipped. This is an **index-only scan**, and the index is said to **cover** the query.

```sql
-- the query needs only these three columns
SELECT created_at, total FROM orders WHERE customer_id = 17;

-- an index that covers it
CREATE INDEX orders_customer_cover_idx
  ON orders (customer_id, created_at) INCLUDE (total);
```

`INCLUDE` adds columns to the leaf entries without making them part of the sort order. They are there only to be returned.

Covering has limits. Each added column makes the index larger and its upkeep costlier, and a query using `SELECT *` can never be covered. Use it for a small number of very frequent queries that return a few columns.

```text example covering readonly
   ordinary index scan                 index-only scan

   index: find customer 17             index: find customer 17
     -> page 88   (table visit)          read created_at and total
     -> page 412  (table visit)          straight from the index
     -> page 9    (table visit)
                                       no table visits
   3 scattered page reads
```

## Several single indexes are not the same

A table has an index on `status` and a separate index on `created_at`. A query filters on both. The database can use one of them and check the other condition row by row, or it can combine the two indexes, which PostgreSQL does with a **bitmap scan**: it collects the matching row locations from each index, intersects the two sets, and then visits the table.

That works, and it is slower than one composite index on both columns, which finds the exact stretch directly. If two columns are nearly always filtered together, give them one composite index.

## Too many indexes

It is tempting to add an index for every query. Each one slows every write. Review a table's indexes as a set.

- **Redundant.** `(a)` is redundant when `(a, b)` exists.
- **Duplicate.** Two indexes on the same columns in the same order, often created by different tools.
- **Unused.** Never chosen by any query.

A handful of well-chosen composite indexes usually serves a table better than a dozen single-column ones.

## Skipping the first column {prediction}

A table has one index, on `(tenant_id, email)`. This query runs during login:

```sql
SELECT * FROM users WHERE email = 'ana@example.com';
```

:::question leftmost
How is it run?
- [ ] With the index, since `email` is in it :: `email` is the second column. The emails are sorted only inside each tenant, so they are scattered across the whole index.
- [x] With a scan of the whole table, or of the whole index :: The condition skips the first column, so the index cannot be used to jump to the answer. Add an index that starts with `email`, or include the tenant in the query.
- [ ] It fails, because the first column is missing :: The query is valid. It is only slow.
:::

## Exercise: design the indexes {independent}

An `invoices` table has 40 million rows with the columns `id`, `account_id`, `status` (`draft`, `sent`, `paid`, `overdue`), `due_date`, `amount` and `created_at`. These queries run often:

```sql
-- A: an account's invoices, newest first, one page at a time
SELECT * FROM invoices WHERE account_id = ?
ORDER BY created_at DESC LIMIT 25;

-- B: an account's overdue invoices
SELECT * FROM invoices WHERE account_id = ? AND status = 'overdue';

-- C: total owed per account, for a dashboard that refreshes often
SELECT sum(amount) FROM invoices
WHERE account_id = ? AND status IN ('sent', 'overdue');

-- D: everything due in the next 7 days, across all accounts
SELECT * FROM invoices
WHERE due_date BETWEEN ? AND ? AND status = 'sent';
```

Propose the smallest set of indexes that serves all four well. Explain the column order of each.

## One possible answer {walkthrough}

**Index 1: `(account_id, created_at)`** serves A. Equality on `account_id` narrows to one account, and `created_at` gives the order, so the database reads 25 entries from the end and stops.

**Index 2: `(account_id, status) INCLUDE (amount)`** serves B and C. Both use equality on `account_id` and a condition on `status`. For C, the included `amount` makes it an index-only scan, so the dashboard never visits the table.

**Index 3: `(status, due_date)`** serves D. Equality on `status` first, then the range on `due_date`. With `(due_date, status)` the database would read every invoice due that week and discard the ones not `sent`. A partial index is a good alternative here: `(due_date) WHERE status = 'sent'`.

**Not added**

- `(account_id)` alone. Index 1 and index 2 both start with it.
- `(status)` alone. It has four values, and index 3 starts with it.
- An index on `amount` or `created_at` alone. No query needs one.

Three indexes for four queries is a reasonable outcome. If writes to this table were very heavy, index 2 could be dropped. Queries B and C would then use index 1 to find the account's invoices and filter them, which is acceptable while one account has only hundreds of invoices.
