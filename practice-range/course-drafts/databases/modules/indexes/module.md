---
id: course:databases/module/indexes
title: Indexes
requires: []
outcomes: []
tasks: []
drills: []
---

An index lets the database go straight to the rows it needs without reading the whole table. This module covers how the usual kind of index is built, which questions it can answer, and what every index costs.

## What an index is

An **index** is a separate structure, stored beside the table, that holds the values of one or more columns in sorted order. Next to each value it holds the location of the row: the page and the position in it.

It works like the index at the back of a book. The index is sorted, so a word is found quickly, and next to it is the page number to turn to.

The table itself is unchanged. An index is a second copy of some columns, arranged for searching.

```sql
CREATE INDEX orders_customer_id_idx ON orders (customer_id);
```

## The B-tree

The standard index is a **B-tree**. It is a tree of pages.

- The **leaf pages** at the bottom hold every indexed value in sorted order, each with the location of its row. The leaves are linked to each other, left to right.
- The pages above them hold signposts: "values below 5000 are down this branch".
- The **root** is the single page at the top.

To find a value, the database starts at the root and follows one signpost per level down to a leaf. The tree is wide and shallow. Each page holds hundreds of entries, so three or four levels are enough for hundreds of millions of rows.

That is the whole point. A lookup reads three or four index pages and then one table page, however large the table is.

```text example btree readonly
                        +------------------+
   root                 |   5000  |  9000  |
                        +------------------+
                       /          |         \
            +-----------+   +-----------+   +-----------+
   branch   | 1200 3100 |   | 6400 7800 |   | 9500 9900 |
            +-----------+   +-----------+   +-----------+
              /    |    \
   leaves  [1..1199] [1200..3099] [3100..4999] ...   sorted, and linked
              |          |             |             left to right
              v          v             v
           row locations in the table
```

## What a B-tree can answer

Since the leaves are sorted and linked, a B-tree serves more than exact matches.

| Query | Uses the index? | How |
| --- | --- | --- |
| `WHERE id = 42` | Yes | Walk down to one leaf entry |
| `WHERE created_at >= '2025-01-01'` | Yes | Walk down to the start, then read along the leaves |
| `WHERE price BETWEEN 10 AND 20` | Yes | The same, with an end point |
| `ORDER BY created_at LIMIT 10` | Yes | Read the first 10 leaf entries, already sorted |
| `WHERE name LIKE 'Sam%'` | Yes | A prefix is a range in sorted order |
| `WHERE name LIKE '%son'` | No | The matches are scattered through the order |

The last two rows are worth remembering. An index on text is sorted from the first character, so it helps with "starts with" and not with "ends with" or "contains". One PostgreSQL detail: for a prefix search the index must be sorted in plain character order, which is requested with `text_pattern_ops` when the database uses a language-specific ordering.

## When the database ignores an index

Having an index does not mean it is used. The database estimates the cost of each way of running a query and picks the cheapest.

An index lookup costs a few index pages plus one table page per matching row, and those table pages are scattered. For a handful of rows that is very cheap. For a large share of the table it is worse than a sequential scan, which reads every page once, in order.

The share of rows a condition keeps is called its **selectivity**. A condition that keeps few rows is selective, and an index on it helps. A condition that keeps most rows is not, and the index will be ignored.

- `WHERE id = 42` keeps one row in millions. The index is used.
- `WHERE status = 'active'` when 95% of rows are active keeps nearly everything. A sequential scan is cheaper, and the database is right to choose it.

## Low selectivity {prediction}

A `users` table has 10 million rows. The column `country` has 40 distinct values, and 60% of the users have `country = 'US'`. There is an index on `country`.

:::question selectivity
How does the database run `SELECT * FROM users WHERE country = 'US'`?
- [ ] With the index, since the column is indexed :: It would follow 6 million pointers to scattered table pages, which costs more than reading the table once.
- [x] With a sequential scan :: The condition keeps 60% of the rows. Reading every page in order is cheaper than 6 million separate visits.
- [ ] It cannot run it without an index on `country` :: An index is never required for a query to run. It only changes the cost.
:::

## Conditions that hide the column

An index on a column is sorted by that column's values. If the query wraps the column in a function or a calculation, the result is no longer something the index is sorted by, and the index cannot be used.

```sql
-- cannot use an index on created_at
SELECT * FROM orders WHERE date(created_at) = '2025-03-04';

-- can use it: the column is left bare, and the range is on the other side
SELECT * FROM orders
WHERE created_at >= '2025-03-04' AND created_at < '2025-03-05';
```

The same happens with `lower(email) = 'a@example.com'`, with `amount * 1.2 > 100`, and with converting the column to another type before comparing it, as in `account_id::text = '4411'`.

The rule is to keep the indexed column alone on one side of the comparison. When a function really is needed, PostgreSQL can index the expression itself:

```sql
CREATE INDEX users_lower_email_idx ON users (lower(email));
```

## What an index costs

Every index is paid for on every write.

- **Slower writes.** An `INSERT` adds an entry to every index on the table. An `UPDATE` of an indexed column changes its index. A table with eight indexes does nine writes for each row inserted.
- **Space.** An index can be a large fraction of the table's size. Several together can exceed it.
- **Memory.** Index pages compete with table pages for the buffer cache.

So an index is a trade: faster reads for one kind of question, in exchange for slower writes and more space. Add an index for a question the application asks often. Do not add one for every column in case it is useful.

Unused indexes are common in old systems. They cost writes for ever and help nothing. PostgreSQL counts how often each index is used, so they can be found and dropped.

```text example write-cost readonly
   INSERT INTO orders (...)

   table "orders"                1 write
   index on id (primary key)     1 write
   index on customer_id          1 write
   index on created_at           1 write
   index on status               1 write
   ------------------------------------
                                 5 writes for one row
```

## Unique indexes and primary keys

An index can also enforce a rule. A **unique index** refuses a second row with the same value.

```sql
CREATE UNIQUE INDEX users_email_key ON users (email);
```

A **primary key** is a unique, required column that identifies each row, and the database creates a unique index for it automatically. That is why looking a row up by its primary key is always fast, and why you never need to add an index on the primary key yourself.

A foreign key is different. In PostgreSQL, declaring that `orders.customer_id` refers to `customers.id` does not create an index on `orders.customer_id`. If you look up orders by customer, or delete customers, you need to add that index.

## Other kinds of index

A B-tree is the default and fits most columns. A few other kinds exist for data that a sorted order does not serve.

- A **hash index** answers only exact matches.
- A **GIN index** indexes the items inside a value: the words in a document, the keys in a JSON value, the elements of an array.
- A **GiST index** handles ranges and geometric data, such as "which areas contain this point".

You need to know that they exist. Reach for one when a B-tree cannot answer the question, such as searching for a word inside text.

## Which index helps {prediction}

An application runs this query many times a second on a table of 50 million rows:

```sql
SELECT * FROM sessions WHERE lower(token) = 'ab12cd34';
```

There is a B-tree index on `token`.

:::question function-index
Is the index used?
- [ ] Yes, since the query filters on `token` :: The query filters on `lower(token)`. The index is sorted by `token` as stored.
- [x] No. The function hides the column, so every row is read :: The index knows nothing about the lowercased values. Index `lower(token)`, or store tokens in one case and compare without the function.
- [ ] Yes, but only for the first matching row :: An index is either usable for a condition or not. There is no partial use here.
:::

## Exercise: choose the indexes {independent}

A `tickets` table for a support system has 30 million rows and these columns: `id` (primary key), `customer_id`, `status` (one of `open`, `pending`, `closed`, with 97% `closed`), `created_at`, `subject` and `body`.

The application runs these queries often:

1. Fetch one ticket by `id`.
2. List a customer's tickets.
3. List all `open` tickets, oldest first.
4. Find tickets whose `subject` contains a word.

For each, say whether an index exists already, which index you would add, or why a B-tree does not help. Then say which index you would not add, and why.

## One possible answer {walkthrough}

1. **Already indexed.** The primary key has a unique index. Nothing to add.
2. **Add an index on `customer_id`.** One customer has a few tickets out of 30 million, so the condition is very selective.
3. **Add a partial index.** A plain index on `status` is poor: for `closed` it would never be used, and it stores 30 million entries to serve the 1% that are open. PostgreSQL can index only some of the rows:

```sql
CREATE INDEX tickets_open_idx ON tickets (created_at)
WHERE status = 'open';
```

It holds only the open tickets, sorted by date, so it is small and it returns them already in order.

4. **A B-tree does not help.** "Contains a word" is not a prefix, so the matches are not together in sorted order. This needs a full-text index, which is a GIN index over the words in the subject, or a separate search system.

**Not to add:** an index on `body`, and indexes on every column "to be safe". Each would slow down every insert and update of a ticket while serving no query on the list.
