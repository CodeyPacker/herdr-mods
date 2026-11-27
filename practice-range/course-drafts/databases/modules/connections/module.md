---
id: course:databases/module/connections
title: Connections and pools
requires: []
outcomes: []
tasks: []
drills: []
---

An application talks to its database over connections, and there are never as many of them as people assume. This module covers what a connection costs, how a pool shares a few among many requests, and how the way an application asks its questions matters as much as the questions.

## What a connection costs

Opening a connection is expensive. There is a TCP handshake, usually a TLS handshake, authentication, and in PostgreSQL the start of a whole operating-system process on the server to serve it. That takes several milliseconds at best, which is often longer than the query that follows.

Each open connection also uses memory on the database server, whether it is busy or not. For that reason a database has a hard limit on connections. PostgreSQL's default is 100, and raising it far does not help, because hundreds of processes competing for a few processors make everything slower.

So connections are a scarce resource. A system with 40 application servers cannot let each one open 50.

## The pool

A **connection pool** keeps a small set of connections open and lends them out. Code that needs the database borrows a connection, uses it and gives it back.

- No handshake per request. The connection is already open.
- The total is capped, so the database is never asked for more than it can serve.
- When every connection is lent out, the next request waits in line.

Nearly every database library has a pool built in. It may be on by default with a size you never chose.

```text example pool readonly
   application (handling 200 requests at once)

   request --+
   request --+        +---------------+         +----------+
   request --+------> | pool: 10      | ------> | database |
   request --+  wait  | connections   |         +----------+
   request --+        +---------------+

   10 queries run at a time. The other requests wait their turn.
```

## How big should a pool be

The instinct is to make the pool large so that nothing waits. That is usually wrong.

A database server can do only as much work at once as it has processor cores and disk capacity. Give it 16 queries on 8 cores, and each runs at half speed. Give it 200, and it spends its effort switching between them. Total throughput goes down.

A small pool that keeps the database busy and not overloaded finishes more work per second than a large one. A common starting point is a total, across all application servers, of a few times the number of processor cores on the database. Then measure and adjust.

The arithmetic matters when there are many servers. The total is the pool size multiplied by the number of application copies, plus background workers, scheduled jobs and people with consoles open.

```text example pool-math readonly
   database limit: 100 connections

   12 web copies   x pool of 10   = 120      over the limit already
    4 workers      x pool of 5    =  20
    reserved for admin and tools  =  10
                                    ----
                                    150      50 too many

   Autoscaling to 20 web copies makes it 230.
   New copies fail at start with "too many connections".
```

## A proxy pool in front of the database

When many application copies each keep a pool, the totals add up quickly. A **connection proxy**, such as PgBouncer, sits between the applications and the database. Applications open as many connections as they like to the proxy, and the proxy shares a small number of real database connections among them.

It is most effective when it hands a database connection to a client for the length of one transaction and then takes it back. The cost is that anything tied to one connection across transactions no longer works as before, such as session settings.

Managed database services often offer such a proxy as a feature.

## Running out {prediction}

A service has a pool of 10 connections. A new endpoint opens a transaction, calls an external API that takes 5 seconds, and then commits. It receives 4 requests a second.

:::question exhaustion
What happens to the rest of the service?
- [ ] Nothing. Only the new endpoint is slow :: The new endpoint holds connections that every other endpoint needs.
- [x] Within a few seconds all 10 connections are held by requests waiting on the API, and every other endpoint waits for a connection :: Each request keeps a connection for 5 seconds, and 4 arrive per second, so 20 are wanted at any time. The pool has 10. Endpoints that never call the API time out waiting.
- [ ] The pool grows to meet the demand :: A pool has a fixed maximum. That limit is the reason it exists.
:::

## Hold a connection briefly

A borrowed connection is unavailable to everyone else until it is returned. The rules are the same as for transactions.

- Borrow as late as possible and return as early as possible.
- Never hold a connection across a network call, a file upload or any slow work.
- Always return it, on the error paths too. A connection that is borrowed and never returned is a **leak**. After enough leaks the pool is empty, and the application hangs with no error.

Set a timeout for borrowing. A request that cannot get a connection within a second or two should fail with a clear error, and not wait until the user's request has long since timed out.

**Pool exhaustion** often looks like a slow database when the database is nearly idle. If queries are fast on the server and requests are slow in the application, measure the time spent waiting for a connection.

## One query per item

The most common performance fault in application code is the **N+1 problem**. The code fetches a list with one query, and then runs one more query for each item in the list.

```text example n-plus-one readonly
   1 query:    SELECT * FROM orders WHERE customer_id = 17    (50 rows)

   then, in a loop:
   50 queries: SELECT * FROM products WHERE id = ?            (1 row each)

   51 round trips at 1 ms each  =  51 ms of waiting

   better:
   2 queries:  the orders, then
               SELECT * FROM products WHERE id IN (...)       (50 rows)

   2 round trips  =  2 ms
```

Each query is fast, so the database's slow query log shows nothing. The time is in the round trips. With 500 items, or with a database 20 ms away, a page takes seconds.

The fault hides best behind libraries that load related data when a property is first read. A loop that looks like plain property access is running a query on every pass.

Count the queries a page makes. A number that grows with the size of the list is the sign.

## Ask only for what you need

Three smaller habits reduce work on both sides.

- **Name the columns.** `SELECT *` fetches every column, including large ones that the code ignores, and it prevents index-only scans.
- **Limit the rows.** A list that shows 20 rows should fetch 20, not 10,000 with the rest dropped in code.
- **Let the database do the set work.** Counting, summing and filtering belong in SQL. Fetching every row to count them in application code moves a great deal of data for one number.

## Paging through results

A long list is shown one page at a time. There are two ways to ask for a page.

**By offset.** `LIMIT 20 OFFSET 40000`. It is simple and it allows jumping to any page. The cost is that the database must produce and discard the first 40,000 rows to reach the ones you want. Deep pages get steadily slower.

**By key.** Remember the last row of the previous page and ask for the rows after it.

```sql
SELECT id, created_at, subject FROM tickets
WHERE created_at < '2025-03-04 10:15:00'
ORDER BY created_at DESC
LIMIT 20;
```

With an index on the sort column, this goes straight to the right place, so page 2,000 costs the same as page 1. It cannot jump to an arbitrary page, and the sort column needs a tie-breaker, such as the ID, when values can repeat.

Use paging by key for anything long or frequently scrolled.

## Parameters, not pasted text

Send values to the database as **parameters**, separate from the SQL text.

```sql
-- the statement, with a placeholder
SELECT * FROM users WHERE email = $1;
-- the value is sent separately: 'ana@example.com'
```

There are two reasons. The first is safety. Building SQL by pasting user input into a string lets a user change the meaning of the statement. This is **SQL injection**, one of the oldest and most damaging kinds of attack. A parameter is always treated as a value and never as SQL. The second is speed: the database can reuse its work for a statement it has seen before.

Use parameters every time, without exception. This is general guidance, not a statement of any organization's policy.

## Deep pages {prediction}

An admin screen pages through 5 million log rows with `ORDER BY id LIMIT 50 OFFSET n`. Page 1 loads in 3 ms.

:::question offset
What happens at page 80,000, where the offset is 4 million?
- [ ] The same 3 ms, since only 50 rows are returned :: The rows returned are few. The rows skipped are many.
- [x] It takes far longer, since the database walks past 4 million rows first :: An offset does not jump. The database reads and discards every row before it. Asking for `WHERE id > last_seen_id` goes straight there.
- [ ] It fails, since the offset is too large :: It works. It is only slow.
:::

## Exercise: find the waste {independent}

A "team activity" page is slow. Its code does this for a team of 60 members.

1. Opens a new database connection, with no pool.
2. Runs `SELECT * FROM members WHERE team_id = ?`.
3. For each member, runs `SELECT * FROM events WHERE member_id = ? ORDER BY created_at DESC` and keeps the first 5 rows in code.
4. For each of those events, runs `SELECT name FROM projects WHERE id = ?`.
5. Builds the SQL in step 2 by joining the team ID from the URL into the string.
6. Closes the connection.

List the problems. Estimate the number of queries. Then describe how the page should fetch its data.

## One possible answer {walkthrough}

**Problems**

- **A new connection per page view** (steps 1 and 6). Every view pays for the handshakes and a new server process. Use a pool.
- **N+1, twice** (steps 3 and 4). 60 queries for events, then up to 300 for projects.
- **Fetching everything to keep five** (step 3). A member with 20,000 events has all of them sent to the application, which keeps 5.
- **`SELECT *`** throughout, when a few columns are shown.
- **SQL injection** (step 5). A value from the URL is pasted into the statement. This is the most serious item on the list.

**Query count.** 1 + 60 + 300 = 361 queries, plus a connection setup. At 1 ms of round trip each, that is over a third of a second in waiting alone.

**Better**

1. Borrow a pooled connection.
2. One query for the members, with the team ID as a parameter, naming the columns needed.
3. One query for the latest 5 events of all 60 members. In PostgreSQL, a lateral join does it: for each member, a subquery with `ORDER BY created_at DESC LIMIT 5`. An index on `events (member_id, created_at)` lets each of those read 5 entries.
4. Join `projects` in the same query, or fetch the distinct project IDs with one `IN` query.
5. Return the connection.

That is two or three queries. The page's time no longer depends on the size of the team or on how much history each member has.
