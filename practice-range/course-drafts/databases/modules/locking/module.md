---
id: course:databases/module/locking
title: Locks and deadlocks
requires: []
outcomes: []
tasks: []
drills: []
---

When two transactions want to change the same thing, one has to wait. Locks are how the database arranges that. This module covers which locks are taken, how waiting turns into an outage, and how deadlocks arise and are avoided.

## What a lock is

A **lock** is a claim on a row or a table that lasts until the transaction ends. A transaction that needs a conflicting claim waits until the first one commits or rolls back.

You rarely ask for locks. Ordinary statements take them automatically.

- An `UPDATE` or `DELETE` locks each row it changes.
- A `SELECT` takes no row locks, thanks to row versions. Reads do not block writes, and writes do not block reads.
- Changing a table's structure takes a lock on the whole table.

The rule to remember is that locks are held until the end of the transaction, not until the end of the statement. A transaction that updates one row and then stays open for a minute holds that row for a minute.

## Row locks

Two transactions that update different rows do not affect each other. Two that update the same row run one after the other.

```text example row-lock readonly
   T1: BEGIN
   T1: UPDATE accounts SET balance = 150 WHERE id = 1    locks row 1
   T2: BEGIN
   T2: UPDATE accounts SET balance = 90  WHERE id = 1    waits ...
   T1: COMMIT                                            releases row 1
   T2: (continues, now applied to T1's result)
   T2: COMMIT
```

T2 does not fail. It waits. To the application, a wait looks like a slow query. That is why a lock problem is often reported as "the database is slow" when the processor and the disks are idle.

## Asking for a lock

Sometimes a transaction reads a row and will change it based on what it finds. To stop anyone else changing it in between, it locks the row while reading.

```sql
BEGIN;
SELECT * FROM seats WHERE id = 88 FOR UPDATE;   -- locks the row
-- decide in application code
UPDATE seats SET holder = 17 WHERE id = 88;
COMMIT;
```

Two options change what happens when the row is already locked.

- `FOR UPDATE NOWAIT` fails at once and does not wait.
- `FOR UPDATE SKIP LOCKED` passes over locked rows and returns the next free ones.

`SKIP LOCKED` is the standard way to build a job queue in a database table. Each worker selects the next unlocked job, so no two workers take the same one and none of them waits.

```sql
SELECT id FROM jobs
WHERE status = 'queued'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

## The queue behind a lock

Lock waits form queues. If T1 holds a row and T2 is waiting for it, T3 waits behind T2, and so on. One slow or forgotten transaction can leave hundreds of requests stuck behind it.

Table locks make this worse. A statement that needs to lock a whole table has to wait for every transaction that is using the table. While it waits, every new query on that table waits behind it. A change that would itself take 5 ms can stop all traffic to a table for as long as one old transaction stays open.

```text example lock-queue readonly
   09:00:00   T1  long report on "orders", still running
   09:00:05   T2  ALTER TABLE orders ...       waits for T1
   09:00:06   T3  SELECT ... FROM orders       waits behind T2
   09:00:06   T4  INSERT INTO orders ...       waits behind T2
   09:00:07   ...every query on "orders" is now waiting

   The ALTER needed 5 ms. The table was unusable for as long as
   the report ran.
```

## Why did it stop {prediction}

At 14:00 every request that touches the `users` table starts to hang. Processor use on the database drops close to zero. At 14:00 a deploy ran a migration with `ALTER TABLE users ADD COLUMN ...`. A reporting query on `users` had been running since 13:40.

:::question lock-queue
What is happening?
- [ ] The migration is rewriting the whole table, which takes time :: Processor use would be high. The server is idle.
- [x] The migration is waiting for the report to finish, and every other query is queued behind the migration :: The `ALTER` needs a lock on the whole table and cannot get it while the report runs. New queries wait behind it. Nothing is working, so the processor is idle.
- [ ] The table has been corrupted :: Nothing is damaged. Everything is waiting.
:::

## Time limits on waiting

A wait with no limit is the dangerous part. Two settings bound it.

- A **lock timeout** makes a statement give up if it cannot get its lock within a set time. Set it before a schema change, so that a blocked migration fails after a few seconds and can be retried, and does not hold up the table.
- A **statement timeout** ends any statement that runs longer than a limit. It protects against runaway queries of every kind.

```sql
SET lock_timeout = '3s';
ALTER TABLE users ADD COLUMN locale text;
```

With that setting, the migration in the previous example would have failed after 3 seconds. Traffic would have paused for 3 seconds, not for 20 minutes.

## Deadlocks

A **deadlock** is two transactions that each hold a lock the other needs. Neither can continue, and waiting will never help.

```text example deadlock readonly
   T1: UPDATE accounts ... WHERE id = 1     T1 holds row 1
   T2: UPDATE accounts ... WHERE id = 2     T2 holds row 2
   T1: UPDATE accounts ... WHERE id = 2     T1 waits for T2
   T2: UPDATE accounts ... WHERE id = 1     T2 waits for T1

        T1 ---- waits for ----> T2
         ^                       |
         +----- waits for -------+

   Neither can move. The database detects the cycle and ends one.
```

The database checks for such cycles. When it finds one, it ends one of the transactions with a deadlock error, and the other proceeds. The application should treat that error like a serialization failure and retry the whole transaction.

A deadlock now and then is normal under load. Frequent deadlocks point to a design fault.

## Avoiding deadlocks

Deadlocks come from taking locks in different orders. The cures follow from that.

- **Lock in a fixed order.** If every transaction that touches two accounts locks the one with the lower ID first, a cycle cannot form. In the example, T2 would have asked for row 1 first and waited there, holding nothing.
- **Keep transactions short.** The less time locks are held, the smaller the chance of an overlap.
- **Touch fewer rows.** A statement that updates many rows takes its locks in whatever order it finds the rows. Two such statements can deadlock with each other.
- **Lock early.** Take every lock the transaction will need at its start, with `SELECT ... FOR UPDATE` in a fixed order, and then do the work.

## Optimistic and pessimistic

There are two attitudes to conflict.

**Pessimistic locking** assumes a conflict is likely and locks first: `SELECT ... FOR UPDATE`. Nobody else can change the row until you finish. It is right when conflicts are common and the work is short.

**Optimistic locking** assumes a conflict is unlikely and checks at the end. Read the row with its version number, do the work, and write only if the version is unchanged. No lock is held in between. It is right when conflicts are rare, or when the time between read and write is long.

| | Pessimistic | Optimistic |
| --- | --- | --- |
| When it acts | Before the work | When writing |
| On conflict | The second waits | The second fails and retries |
| Holds a lock meanwhile | Yes | No |
| Good for | Frequent conflicts, short work | Rare conflicts, long gaps |

## Seeing who is blocking whom

When things are stuck, the database can tell you why. PostgreSQL lists every connection, its state, how long its transaction has been open, and which other connection it is waiting for.

```sql
SELECT pid, state, wait_event_type, xact_start, query,
       pg_blocking_pids(pid) AS blocked_by
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY xact_start;
```

Look for the connection at the root: the one that blocks others and is itself not waiting. Very often it is idle in transaction, or it is one long query. Ending that one connection frees everything behind it.

## The transfer {prediction}

A transfer function locks the sender's account row, then the receiver's. Two transfers start together: one from account 5 to account 9, the other from account 9 to account 5.

:::question deadlock-order
What can happen, and what prevents it?
- [ ] Nothing. Each transfer locks two different rows :: They lock the same two rows, in opposite orders.
- [x] A deadlock. Always locking the lower account ID first prevents it :: One holds row 5 and wants 9, and the other holds row 9 and wants 5. With a fixed order, both ask for row 5 first, and one simply waits.
- [ ] One transfer is silently lost :: A deadlock produces an error for one transaction. Nothing is lost silently.
:::

## Exercise: unblock the system {independent}

During a busy afternoon, the checkout starts timing out. You run the query from the section above and see this.

```text example blocked readonly
 pid  | state               | xact_start | blocked_by | query
------+---------------------+------------+------------+-----------------
 4101 | idle in transaction | 13:02:11   | {}         | UPDATE products
      |                     |            |            |  SET stock = ...
      |                     |            |            |  WHERE id = 7
 4188 | active              | 13:40:03   | {4101}     | UPDATE products
      |                     |            |            |  ... WHERE id = 7
 4190 | active              | 13:40:04   | {4188}     | UPDATE products
      |                     |            |            |  ... WHERE id = 7
 4193 | active              | 13:40:04   | {4190}     | UPDATE products
      |                     |            |            |  ... WHERE id = 7
```

The time is now 13:41. Say what is happening, what you would do right now, and what you would change so that it does not happen again.

## One possible answer {walkthrough}

**What is happening.** Connection 4101 began a transaction at 13:02, updated product 7, and has done nothing since. It is idle in transaction, and it has held the lock on that row for 39 minutes. Product 7 is probably popular. Every checkout that includes it waits behind 4101, in a chain.

**Right now.** End connection 4101, with `SELECT pg_terminate_backend(4101)`. Its transaction is rolled back, the row lock is released, and the queue drains within seconds. Its uncommitted update is lost, which is correct, since it was never completed.

**So it does not happen again**

1. **Find the code that left the transaction open.** Something began a transaction, updated stock, and then waited or crashed without committing or rolling back. Likely causes are a network call inside the transaction or an error path with no rollback.
2. **Set `idle_in_transaction_session_timeout`**, for example to 30 seconds. The database then ends such a connection by itself.
3. **Set a lock timeout** for the checkout's statements, such as 2 seconds. A blocked checkout then fails quickly with a clear error and does not hang until the client gives up.
4. **Alert on the age of the oldest open transaction.** A transaction open for more than a minute in a system like this is nearly always a fault, and this one went unnoticed for 38 minutes.

The useful habit is to look for the root of the chain. Three connections were visibly stuck, and the cause was the fourth, which was doing nothing.
