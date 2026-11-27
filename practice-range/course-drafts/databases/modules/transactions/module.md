---
id: course:databases/module/transactions
title: Transactions
requires: []
outcomes: []
tasks: []
drills: []
---

A transaction groups several changes into one unit that either happens completely or does not happen. This module covers what a transaction guarantees, how to use one, and the habits that make transactions cause trouble.

## The problem

Moving 50 from one account to another takes two statements.

```sql
UPDATE accounts SET balance = balance - 50 WHERE id = 1;
UPDATE accounts SET balance = balance + 50 WHERE id = 2;
```

If the program crashes between them, 50 has left the first account and arrived nowhere. The data is now wrong, and nothing in it says so.

A **transaction** prevents this. It wraps the statements so that the database treats them as a single change.

```sql
BEGIN;
UPDATE accounts SET balance = balance - 50 WHERE id = 1;
UPDATE accounts SET balance = balance + 50 WHERE id = 2;
COMMIT;
```

`BEGIN` starts the transaction. `COMMIT` makes all of its changes permanent together. `ROLLBACK` discards all of them. If the connection is lost or the server crashes before `COMMIT`, the database rolls the transaction back by itself.

## Four guarantees

The guarantees are summarised as **ACID**.

| Letter | Name | Meaning |
| --- | --- | --- |
| A | Atomicity | All of the changes happen, or none do |
| C | Consistency | Every constraint holds when the transaction ends |
| I | Isolation | Transactions running at the same time do not see each other's unfinished work |
| D | Durability | Once committed, a change survives a crash |

Atomicity and durability come from the write-ahead log described in the first module. Each change is logged before it is applied, and a commit is confirmed only when its log record is safely on disk. After a crash, the database replays the log, keeps what was committed and undoes what was not.

Isolation has several strengths, and it is the subject of the next module.

```text example atomic readonly
   BEGIN
     take 50 from account 1      balance 1: 200 -> 150
     -- crash here --
     add 50 to account 2         never runs

   after restart: the transaction was never committed,
   so the database undoes it.     balance 1: 200 again

   No state exists in which the 50 is missing.
```

## Every statement is in a transaction

In PostgreSQL, a single statement run by itself is wrapped in its own transaction and committed at once. This is called **autocommit**.

So one `UPDATE` that changes a million rows is atomic too. If it fails on row 900,000, none of the million rows are changed.

You need an explicit `BEGIN` only when several statements must succeed or fail together.

## Errors inside a transaction

When a statement fails inside a PostgreSQL transaction, the transaction is marked as failed. Every later statement is refused until you issue `ROLLBACK`.

This is deliberate. It stops a program from continuing with half of its work done. The correct reaction to an error in a transaction is to roll back and, if it makes sense, try the whole transaction again from the start.

A **savepoint** marks a place inside a transaction to which you can roll back without discarding everything before it. It is used when one optional step may fail.

```sql
BEGIN;
INSERT INTO orders (...) VALUES (...);
SAVEPOINT before_coupon;
UPDATE coupons SET used = true WHERE code = 'SPRING';  -- may fail
ROLLBACK TO before_coupon;   -- if it failed: undo only that step
COMMIT;                      -- the order is still saved
```

## Crash after commit {prediction}

An application runs `COMMIT` and receives the confirmation. One second later the database server loses power, before the changed pages were written to the table files.

:::question durable
Is the change there after the restart?
- [x] Yes :: The commit was confirmed only after its log record was on disk. On restart, the database replays the log and applies the change to the table.
- [ ] No, since the table files were never written :: The table files are written later on purpose. The log is what makes the commit safe.
- [ ] Only part of it :: A committed transaction is replayed completely. Atomicity holds through a crash.
:::

## Keep transactions short

A transaction that is open holds things that other work needs.

- **Locks.** Rows it has changed are locked until it ends. Others who want to change them wait.
- **Old row versions.** While a transaction is open, the database cannot clean up row versions that the transaction might still need to see. A transaction left open for hours makes tables bloat.
- **A connection.** It occupies one for its whole duration.

So a transaction should contain only database work, and be finished as quickly as possible. The classic mistake is doing something slow in the middle.

```text example long-tx readonly
   BAD                                   GOOD

   BEGIN                                 call the payment API (2 s)
     update the order                    BEGIN
     call the payment API (2 s)            update the order
     update the stock                      update the stock
   COMMIT                                COMMIT

   locks held for 2 seconds              locks held for a few ms
   while waiting on the network
```

Never wait for a person, a network call or a slow computation while a transaction is open.

## Idle in transaction

A connection that has run `BEGIN`, done some work and then gone silent is **idle in transaction**. The application may have crashed, hit an exception path that skipped the rollback, or simply be waiting for something.

It is one of the most damaging states a database can be in. The transaction still holds its locks and still blocks cleanup, and it does nothing useful. Other queries pile up behind it.

Two protections are worth having.

- In code, always end a transaction in a `finally` block or with the language's equivalent construct, so that every path commits or rolls back.
- In the database, set a time limit after which an idle transaction is ended automatically. In PostgreSQL this is `idle_in_transaction_session_timeout`.

## What a transaction does not cover

A transaction covers changes in one database. It does not cover anything outside it.

- An email that was sent cannot be unsent by `ROLLBACK`.
- A call to a payment provider is not undone.
- A message published to a queue has left.
- A file written to disk stays written.

When one action must change the database and do something external, order the work with care. Do the external step so that it can be repeated safely, or record the intent in the database inside the transaction and let a separate process carry it out afterwards. That second approach is the outbox pattern, which the system design course covers.

## The email that went out {prediction}

A sign-up handler does this inside one transaction: insert the user, send a welcome email, insert a default workspace. The third step fails with an error, and the transaction is rolled back.

:::question external
What is the state afterwards?
- [ ] No user, no email, no workspace :: The database changes are undone. The email is not a database change.
- [x] No user and no workspace, and a welcome email was sent to someone who has no account :: Rollback undoes the two inserts. The email had already left, and nothing can recall it.
- [ ] The user exists without a workspace :: The insert of the user was part of the transaction and was rolled back with it.
:::

## Batches

A very large change in one transaction has costs of its own. Deleting 50 million old rows in one statement holds locks for the whole run, produces a huge amount of log, delays replicas, and loses everything if it fails near the end.

Do such work in **batches**: a few thousand rows per transaction, in a loop, with a short pause between them. Each batch commits quickly. The job can be stopped and resumed, and other work is not blocked for long.

```sql
-- repeat until it deletes no rows
DELETE FROM events
WHERE id IN (
  SELECT id FROM events
  WHERE created_at < '2023-01-01'
  LIMIT 5000
);
```

The trade is atomicity. Halfway through, half of the rows are gone. That is fine for a cleanup. It is wrong for a change that must appear all at once.

## Exercise: find the faults {independent}

A "checkout" function does the following, in one transaction, in this order.

1. `BEGIN`
2. Insert the order row.
3. Call the payment provider's API and wait for the answer, which takes 1 to 8 seconds.
4. If the payment fails, return an error to the caller.
5. Decrease the stock of each product.
6. Send a confirmation email.
7. `COMMIT`

List what is wrong, with the consequence of each. Then rewrite the sequence.

## One possible answer {walkthrough}

**Faults**

- **A network call inside the transaction (step 3).** The transaction is open for up to 8 seconds, and under load there are many of them. Each holds a connection the whole time, so the pool runs dry.
- **A path with no rollback (step 4).** The function returns without ending the transaction. The connection goes back to the pool idle in transaction, still holding the order row and blocking cleanup.
- **Payment taken, then a possible failure (step 5).** If decreasing stock fails, the transaction rolls back and the order disappears. The customer's card was charged, and no record of the order remains.
- **Email before commit (step 6).** If the commit fails, the customer has a confirmation for an order that does not exist.

**Rewritten**

1. In a short transaction: insert the order with the status `pending` and reserve the stock. Commit.
2. Outside any transaction: call the payment provider, with the order ID as the idempotency key.
3. In a second short transaction: on success, set the order to `paid`. On failure, set it to `failed` and release the stock. Commit.
4. After that commit: queue the confirmation email.

Each transaction now lasts milliseconds and contains only database work. The order row exists before the charge, so a crash at any point leaves a `pending` order that a background job can finish or cancel. Every path ends its transaction.
