---
id: course:databases/module/maintenance
title: Keep a database healthy
requires: []
outcomes: []
tasks: []
drills: []
---

A database that is left alone gets slower. Dead rows pile up, statistics go out of date, and tables grow past what was planned. This module covers the routine work that prevents that: cleanup, statistics, watching queries, backups and old data.

## Dead rows and vacuum

An update writes a new version of a row and leaves the old one behind, and a delete only marks a row. Those leftover versions are **dead rows**. They take up space in table pages and index pages, and every scan has to step over them.

**Vacuum** is the process that reclaims them. It marks the space of dead rows as free, so new rows can reuse it. PostgreSQL runs it automatically in the background, table by table, when enough rows have changed. That is **autovacuum**.

Two points are often misunderstood.

- Vacuum makes space reusable inside the table. It does not usually shrink the file on disk. A table that bloated to 100 GB stays 100 GB, with free space inside it.
- Vacuum can only remove a dead row when no open transaction could still need to see it. One transaction left open for hours stops cleanup for the whole database.

```text example vacuum readonly
   a page before vacuum                 after vacuum

   | live | dead | dead | live |        | live | free | free | live |
   | dead | live | dead | dead |        | free | live | free | free |

   The space can be reused for new rows.
   The file on disk stays the same size.
```

## Bloat

**Bloat** is the gap between the size of a table and the size of its live data. Some is normal. Trouble starts when cleanup cannot keep up.

Common causes:

- **A long-running or idle transaction** that holds back cleanup, as described above.
- **Very heavy updates** on one table, faster than autovacuum's default settings handle. Busy tables often need autovacuum set to run more eagerly.
- **A mass delete or update**, which creates millions of dead rows at once.

The effects are slower scans, since more pages are read for the same rows, a larger memory footprint and more disk. An index can bloat too.

Shrinking a badly bloated table means rewriting it. `VACUUM FULL` does that, and it locks the table completely for the duration, so it is rarely acceptable on a live system. Tools exist that rebuild a table in the background and swap it in. Preventing bloat is much cheaper than removing it.

## The table that kept growing {prediction}

A `jobs` table holds about 50,000 live rows at any time. Rows are inserted, updated several times and deleted within minutes. After a month the table is 60 GB. A connection from an analytics tool has been "idle in transaction" for three weeks.

:::question bloat
Why is the table so large?
- [ ] Autovacuum is switched off :: It may be running constantly and finding nothing it is allowed to remove.
- [x] The three-week-old transaction prevents every dead row created since then from being removed :: Vacuum may not remove a version that an open transaction might still read. Everything since that transaction began has to be kept.
- [ ] 50,000 rows take 60 GB :: Live data of that size would be a few megabytes. The rest is dead versions.
:::

## Statistics

The planner chooses plans from statistics about each table: row counts, distinct values, common values. They are gathered by `ANALYZE`, which samples the table. Autovacuum runs it automatically after enough changes.

Statistics go stale in predictable situations.

- After a bulk load or a mass delete. The table has changed completely, and the planner still believes the old numbers.
- On a table that grows by appending. The newest rows, such as today's date, lie beyond the range the statistics know about, so the planner expects no rows for today.
- On a newly created or restored table before the first analyse has run.

The symptom is a query that was fast and suddenly has a bad plan, with estimated rows far from the actual rows. Running `ANALYZE` on the table by hand after any large data change is cheap and avoids this.

## Find the queries that matter

You cannot tune what you cannot see. Two tools show where a database spends its time.

A **slow query log** records every statement that takes longer than a threshold, such as 500 ms. It finds the single slow queries.

**Query statistics** add up every execution by statement shape. In PostgreSQL this is the `pg_stat_statements` extension. It shows, for each kind of query, how many times it ran and the total time it took.

The second is the more important. The query that costs the most is often not the slowest one. A 2 ms query that runs 5,000 times a second uses far more of the database than a 30-second report that runs once a night.

```text example statements readonly
   query shape                          calls       mean     total
   -----------------------------------  ---------   ------   ---------
   SELECT ... FROM sessions WHERE ...   41,000,000    2 ms    82,000 s
   SELECT ... FROM orders WHERE ...      3,100,000   11 ms    34,100 s
   UPDATE products SET stock ...           900,000    4 ms     3,600 s
   SELECT ... monthly report ...                30   28 s        840 s

   Sorted by total time. The first row is where the database
   spends its effort, although each call is fast.
```

Sort by total time and work from the top.

## What to watch

A short list of measurements covers most database trouble.

| Measurement | Warns of |
| --- | --- |
| Connections in use against the limit | Running out, pool sizing errors |
| Age of the oldest open transaction | Stuck transactions, blocked cleanup |
| Queries waiting for locks | Lock queues |
| Replication lag | Stale reads, a failover that would lose data |
| Disk space free | The most final failure of all |
| Cache hit ratio | Data no longer fitting in memory |
| Dead rows per table | Cleanup falling behind |

Disk space deserves its own alert well ahead of time. A database with a full disk stops accepting writes, and recovering takes far longer than adding space would have.

## Backups

Replication protects against a failed machine. It does not protect against a wrong statement, which is copied to every replica within a second. A **backup** is a copy of the data from an earlier time, kept apart from the running system.

There are two kinds.

- A **logical backup** is a dump: the SQL statements or data files needed to recreate the database. It is portable and can restore one table. It is slow for large databases, both to take and to restore.
- A **physical backup** is a copy of the database's files, together with the write-ahead log. It is fast for large databases. With the log kept continuously, it allows **point-in-time recovery**: restoring to any chosen second, such as the moment before a bad `DELETE`.

Decide how much data you can afford to lose and how long a restore may take. Those two numbers choose the method. Then test it: restore a backup into a scratch environment on a schedule and check the data. A backup that has never been restored is not known to work.

## Old data

Many tables only ever grow: events, logs, audit records. Every query, index, backup and restore gets slower as they do. A plan for old data should exist before the table is large.

- **Retention.** Decide how long each kind of data is needed. Delete or archive the rest on a schedule.
- **Delete in batches**, as in the transactions module. One giant delete creates millions of dead rows and a huge transaction.
- **Partition by time.** The table is split into one piece per month or per day. Queries for a date range read only the pieces they need. Removing an old month means dropping its piece, which is instant and leaves no dead rows.

```text example partition-drop readonly
   events, partitioned by month

   [2024-11] [2024-12] [2025-01] [2025-02] [2025-03]

   keep 3 months:  DROP the 2024-11 and 2024-12 pieces

   instant, no dead rows, no vacuum needed

   compare:  DELETE FROM events WHERE created_at < '2025-01-01'
             hours of work, and 200 million dead rows to clean up
```

## Routine checks

A healthy database is the result of small, regular attention.

- Review the top queries by total time, monthly.
- Look for unused and duplicate indexes, and drop them.
- Check table and index sizes against their growth.
- Test a restore.
- Keep the database version supported. Old versions stop receiving security fixes.

## After the import {prediction}

A nightly job loads 30 million rows into a table that held 2 million. The morning dashboard query on that table, which took 200 ms yesterday, takes 90 seconds today. Its plan shows a nested loop with `rows=40` estimated and `rows=2800000` actual.

:::question stale-stats
What should be done first?
- [ ] Add an index :: The indexes are the same as yesterday. The plan changed because the planner's picture of the table is wrong.
- [x] Run `ANALYZE` on the table, and add it as the last step of the import job :: The statistics still describe a table of 2 million rows. With fresh ones the planner sees the real sizes and chooses a suitable join.
- [ ] Increase the server's memory :: The plan is wrong for the data. More memory does not correct an estimate.
:::

## Exercise: write the care plan {independent}

A team runs one PostgreSQL database for a busy scheduling product. They report these problems.

1. The `audit_log` table is 400 GB and grows by 30 GB a month. Rules require that 12 months be kept.
2. The `appointments` table is 5 times larger than its live data.
3. Nobody knows which queries use the most resources.
4. Backups are taken nightly. Nobody has ever restored one.
5. Last month the disk filled up and the product was down for two hours.

Write a plan that addresses each. Put the items in the order you would do them, and say why.

## One possible answer {walkthrough}

**First: the things that can cause an outage or data loss**

- **Disk (5).** Add an alert at 70% and at 85% of disk used, and one on the projected days until full. This takes an hour and prevents a repeat.
- **Backups (4).** Restore last night's backup into a scratch environment now. Measure how long it takes and check recent data. Then schedule that test monthly. Turn on continuous archiving of the write-ahead log, so that a restore can go to a chosen minute and not only to last night.

**Second: visibility**

- **Queries (3).** Enable `pg_stat_statements` and a slow query log at 500 ms. Review the top ten by total time. This will probably explain some of the other problems.

**Third: the tables**

- **Bloat (2).** Find the cause before treating it. Check for long or idle transactions, and set `idle_in_transaction_session_timeout`. Then make autovacuum more eager for this table. Rebuild the table with a background tool in a quiet period, not with `VACUUM FULL`.
- **Audit log (1).** Partition it by month. That is a migration: create the partitioned table, write to it, and move the history across in batches. Afterwards, each month the oldest piece beyond 12 months is exported to cheap storage if required, and dropped. The table levels off at about 360 GB and stops growing.

The order follows risk. A full disk or an unrestorable backup can end the business. A bloated table makes it slower.
