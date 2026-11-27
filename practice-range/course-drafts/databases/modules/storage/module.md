---
id: course:databases/module/storage
title: How a database stores and finds rows
requires: []
outcomes: []
tasks: []
drills: []
---

A query describes the rows you want. The database has to go and find them on disk. This module shows what is on the disk, what reading it costs, and why that cost decides whether a query is fast.

The course uses PostgreSQL for its examples, because the SQL course in this app runs on it. Other relational databases use different names and details for the same ideas.

## Tables are files of pages

A table is stored as a file. The file is divided into fixed-size blocks called **pages**, 8 KB each in PostgreSQL. Each page holds as many rows as fit, often between 50 and 200.

The database never reads one row from disk. It reads the whole page that contains it. So the cost of a query is counted in pages read, not in rows returned.

Rows in a table are in no particular order. A new row goes wherever there is free space. A table stored this way is called a **heap**.

```text example pages readonly
   table "orders"  =  one file, cut into 8 KB pages

   +-----------+ +-----------+ +-----------+ +-----------+
   | page 0    | | page 1    | | page 2    | | page 3    |  ...
   | row  row  | | row  row  | | row  row  | | row  row  |
   | row  row  | | row  row  | | row       | | row  row  |
   | row  row  | | row  row  | | (free)    | | row  row  |
   +-----------+ +-----------+ +-----------+ +-----------+

   Rows are in no order. To read one row, its whole page is read.
```

## Reading every page

Suppose you ask for one order by its ID and the table has no index. The database has no way to know which page holds it. It reads every page from the first to the last and checks every row. This is a **sequential scan**, also called a full table scan.

Its cost grows with the size of the table. A table of 1,000 rows fits in about 10 pages, and scanning it is instant. A table of 100 million rows is about a million pages, or 8 GB. Reading all of it to return one row takes seconds.

That is the usual story behind "it was fast in testing and slow in production". The query did not change. The table grew.

A sequential scan is not always wrong. When a query needs a large share of the table, reading every page in order is the cheapest way to get it.

## Memory and disk

Reading a page from disk is slow compared with reading it from memory. So the database keeps recently used pages in memory, in an area called the **buffer cache** (in PostgreSQL, shared buffers).

- A page found in the cache costs almost nothing.
- A page that must be read from disk costs far more: around 0.1 ms on a fast disk, and much longer on a slow or busy one.

This explains a pattern you will see often. A query is slow the first time and fast the second, because the first run brought its pages into memory. It also explains why a database slows sharply when its commonly used data stops fitting in memory.

```text example cache readonly
   query needs page 412

   in the buffer cache?  --- yes --->  use it            (very fast)
            |
            no
            v
   read it from disk     ------------> put it in the     (slow)
                                       cache, then use it
```

## Twice in a row {prediction}

A report query runs for 14 seconds. Someone runs the same query again a moment later, and it takes 0.9 seconds. Nothing was changed in between.

:::question second-run
What is the most likely reason?
- [ ] The database stored the result of the first run :: PostgreSQL does not keep query results. It ran the whole query again.
- [x] The pages the query reads were on disk the first time and in memory the second :: The first run paid for the disk reads and left the pages in the buffer cache. The work is the same. Only the cost per page changed.
- [ ] The second run used a better plan :: Nothing changed that would produce a different plan.
:::

## What a row looks like

Each row is stored with a small header and then its column values. Two details matter for design.

- **Row width.** Narrow rows mean more rows per page, so fewer pages to read. A table with 30 wide columns is slower to scan than one with 6, even when a query uses only two of them, because whole rows are stored together.
- **Large values are moved out.** A long text or JSON value does not fit in a page with other rows. PostgreSQL stores such values in a separate area and keeps a pointer in the row. Reading the row is cheap. Reading the large value costs extra page reads.

This is why `SELECT *` is a poor habit in application code. It fetches every column, including large ones the code never looks at.

## Changing a row

PostgreSQL does not overwrite a row when you update it. It writes a new version of the row and marks the old version as no longer current. A delete only marks the row. The space is reclaimed later by a background process.

Two consequences follow, and both come back in later modules.

- Readers are not blocked by writers. A query that started earlier can keep reading the old version while a new one is written.
- Old versions take up space until they are cleaned up. A table that is updated heavily can grow far larger than its live data. This is called **bloat**.

```text example versions readonly
   UPDATE orders SET status = 'shipped' WHERE id = 7;

   before:   | id 7 | status 'paid'    |   current

   after:    | id 7 | status 'paid'    |   old version, kept for now
             | id 7 | status 'shipped' |   current

   The old version is removed later, once no query can still need it.
```

## The log that makes changes safe

Writing changed pages straight to the table files would be slow, and a crash in the middle would leave them half written. So the database first appends a short record of each change to a file called the **write-ahead log** (WAL). A change counts as saved once its log record is on disk.

Appending to one file is fast, since it is a single sequential write. The changed pages are written to the table files later, in the background. After a crash, the database replays the log to rebuild whatever had not reached the table files.

The same log does two more jobs. It is what replicas read to stay in step, and it is what makes it possible to restore a backup to an exact moment.

## Count the pages {prediction}

A table has 20 million rows, about 100 rows per page. A query asks for the 3 rows with `customer_id = 5521`. There is no index on that column.

:::question page-count
About how many pages does the database read?
- [ ] 3, one for each matching row :: Without an index it cannot know which pages hold those rows.
- [ ] About 100 :: That is the number of rows in one page, not the number of pages.
- [x] About 200,000, the whole table :: 20 million rows at 100 per page is 200,000 pages. Every one is read to find 3 rows.
:::

## Exercise: explain the slowdown {independent}

A team reports three things about an `events` table that has grown from 50,000 to 80 million rows over two years.

1. "Finding one event by its ID used to take 2 ms and now takes 9 seconds."
2. "The nightly report is slow on Monday morning and fast for the rest of the day."
3. "The table holds 80 million rows and takes up 140 GB, though a row is only about 300 bytes."

Explain each one using the ideas in this module. For the third, estimate what size you would expect.

## One possible answer {walkthrough}

1. **A sequential scan on a table that grew.** There is no usable index on the ID, so the database reads every page. At 50,000 rows that was a few hundred pages. At 80 million it is millions. The fix is an index, which is the next module.
2. **A cold cache.** Over the weekend the pages this report needs were pushed out of memory by other work, or the server was restarted. The first run reads them from disk. Later runs find them in the buffer cache.
3. **Bloat.** 80 million rows at 300 bytes is about 24 GB, and with page overhead perhaps 30 GB. The table is more than four times that. Rows in it are updated or deleted often, and the old versions are not being cleaned up fast enough. Indexes add size as well, though the question was about the table alone.

All three have the same root. The cost of a query is the number of pages it must read, and how many of those are already in memory.
