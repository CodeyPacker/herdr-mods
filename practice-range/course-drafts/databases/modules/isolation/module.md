---
id: course:databases/module/isolation
title: Isolation levels
requires: []
outcomes: []
tasks: []
drills: []
---

Many transactions run at the same time, and they read and change the same rows. Isolation decides how much they see of each other. This module covers what can go wrong, the levels that prevent it, and how to choose one.

## Why isolation is a choice

The simplest way to keep transactions from interfering would be to run them one at a time. The result would always be correct, and the database would be very slow.

So databases run transactions side by side and offer several **isolation levels**. A stricter level prevents more kinds of interference and costs more: more waiting, or more transactions that fail and must be tried again. A looser level is faster and allows specific odd results, called **anomalies**.

To choose a level, you need to know the anomalies.

## Row versions and snapshots

PostgreSQL keeps old versions of rows, as the first module described. It uses them to give each query or transaction a **snapshot**: a consistent view of the data as it was at one moment.

A reader looks at the versions that were committed when its snapshot was taken, and ignores newer ones. This design is called **MVCC** (multi-version concurrency control). Its main benefit is that readers never block writers and writers never block readers. A long report does not stop orders from being placed.

What differs between isolation levels is when the snapshot is taken.

```text example snapshot readonly
   time ---->

   T1:  BEGIN .... reads balance (sees 100) ............. reads again
   T2:        BEGIN ... sets balance to 60 ... COMMIT

   What does T1's second read return?

   Read Committed:   60    each statement gets a fresh snapshot
   Repeatable Read:  100   one snapshot for the whole transaction
```

## The anomalies

| Anomaly | What happens |
| --- | --- |
| Dirty read | You read a change that another transaction has not committed, and it is then rolled back |
| Non-repeatable read | You read a row twice in one transaction and get different values, because someone committed a change in between |
| Phantom read | You run the same search twice and get different rows, because someone inserted or deleted matching rows |
| Lost update | Two transactions read a value, both change it and write it back, and one change overwrites the other |
| Write skew | Two transactions each check a rule, each make a change that is fine alone, and together they break the rule |

The last two are the ones that cause real bugs in applications. They do not look like errors. Each transaction succeeds, and the data ends up wrong.

## Lost update

Two people buy the last items of a product at the same moment. The application reads the stock, subtracts in code and writes the result back.

```text example lost-update readonly
   stock = 10

   T1: SELECT stock            -> 10
   T2: SELECT stock            -> 10
   T1: UPDATE ... SET stock = 9      (10 - 1)
   T1: COMMIT
   T2: UPDATE ... SET stock = 9      (10 - 1, from its old read)
   T2: COMMIT

   two items sold, stock went down by one
```

Both transactions did what they were written to do. The fault is the pattern "read, compute in the application, write back", which leaves a gap between the read and the write.

## The levels

The SQL standard defines four levels. PostgreSQL implements three distinct behaviours, since its Read Uncommitted behaves as Read Committed.

| Level | Snapshot taken | Prevents | Still allows |
| --- | --- | --- | --- |
| Read Committed (the default) | At the start of each statement | Dirty reads | Non-repeatable reads, phantoms, lost updates in read-then-write code, write skew |
| Repeatable Read | At the start of the transaction | The above, plus non-repeatable reads and phantoms. A lost update is detected and one transaction fails | Write skew |
| Serializable | At the start of the transaction, with extra checking | Everything. The result equals some one-at-a-time order | Nothing, and transactions may fail and need a retry |

Other databases differ in the details and in their defaults. Check the documentation of the one you use before relying on a level's name.

## Read Committed in practice

Read Committed is the default, and most applications run on it without knowing. Each statement sees everything committed before that statement began.

Two consequences are worth knowing.

- Two statements in the same transaction can see different data. A report that runs a count and then a sum may get results that do not agree with each other.
- "Read, then decide, then write" is unsafe, as the lost update showed. The value may have changed after it was read.

For a transaction of several statements that must agree with each other, such as a multi-part report, Repeatable Read gives one consistent snapshot for all of them.

## The report that did not add up {prediction}

A transaction at Read Committed runs two statements a moment apart: first `SELECT count(*) FROM orders WHERE day = today`, then `SELECT sum(total) FROM orders WHERE day = today`. Between them, another transaction commits three new orders.

:::question read-committed
What does the report show?
- [ ] A count and a sum for the same set of orders :: Each statement takes its own snapshot at this level.
- [x] A count without the three new orders and a sum that includes them :: The second statement sees everything committed before it started. The two figures describe different sets of rows.
- [ ] An error, because the data changed during the transaction :: Read Committed reports nothing. It simply returns the newer data.
:::

## Fixing a lost update

There are three good ways, and none needs a stricter isolation level.

**Let the database do the arithmetic.** An update that computes from the current value is safe, because the database applies it to the latest committed row and makes a second writer wait for the first.

```sql
UPDATE products SET stock = stock - 1
WHERE id = 42 AND stock > 0;
```

If this reports that no row was updated, the item was out of stock. The check and the change are one atomic statement.

**Lock the row first.** `SELECT ... FOR UPDATE` reads the row and locks it until the transaction ends. A second transaction that does the same waits, and then reads the new value. Use this when the decision needs logic that cannot be put in one statement.

**Check a version.** Add a `version` column. Read it with the row, and write with `WHERE id = 42 AND version = 7`, increasing the version at the same time. If no row was updated, someone else changed it first, and the application reads again and retries. This is **optimistic locking**. It suits changes that take a long time between read and write, such as a person editing a form.

## Write skew

Write skew is harder to see, because the two transactions change different rows.

A hospital requires at least one doctor on call. Two doctors are on call and both want to leave. Each transaction checks that another doctor is on call, sees one, and marks its own doctor as off. Both commit. Nobody is on call.

```text example write-skew readonly
   rule: at least one doctor on call         on call: Ana, Bilal

   T1 (Ana):    SELECT count(*) on call  -> 2   fine, I can leave
   T2 (Bilal):  SELECT count(*) on call  -> 2   fine, I can leave
   T1:          UPDATE Ana   SET on_call = false     COMMIT
   T2:          UPDATE Bilal SET on_call = false     COMMIT

   on call: nobody.  Each transaction was correct by itself.
```

Neither overwrote the other, so nothing detects a conflict at Read Committed or Repeatable Read. The same shape appears in "a room may not be double-booked", "a username must be unique" and "a team may have at most five members".

The fixes are:

- **A constraint**, where one can express the rule. A unique index prevents duplicate usernames outright, whatever the isolation level.
- **A lock on something both transactions share.** Lock the shift row, or the room row, with `SELECT ... FOR UPDATE` before checking. The second transaction waits and then sees the first one's change.
- **Serializable isolation.** The database detects that the two transactions could not have run one after the other with this result, and makes one of them fail.

## Serializable and retries

At Serializable, the database tracks what each transaction read and wrote. If a combination could not have come from running them one at a time, it aborts one with a serialization failure.

That is safe, and it moves work to the application, which must catch that specific error and run the whole transaction again. Code that uses Serializable without a retry loop will show users errors at random under load.

The same holds for Repeatable Read, which can fail with the same kind of error when two transactions update one row.

Retry the whole transaction from `BEGIN`, with new reads. Retrying only the failed statement reuses the old decisions.

## Which fix {prediction}

A booking system must not let two people reserve the same room for the same hour. Its code checks for an existing booking with a `SELECT`, and inserts a new row if none is found. It runs at Read Committed. Double bookings occur a few times a month.

:::question double-booking
Which change stops them with the least risk?
- [ ] Run the `SELECT` twice to be sure :: The gap between the last check and the insert is still there.
- [x] Add a unique constraint on room and hour :: The database then refuses the second insert whatever the timing, and the application reports "already taken". A constraint cannot be forgotten by a new code path.
- [ ] Switch to Repeatable Read :: Both transactions take a snapshot before either inserts, see no booking, and insert. Repeatable Read does not prevent this.
:::

## Exercise: name the anomaly {independent}

For each situation, name the anomaly and choose a fix. All run at Read Committed.

1. A wallet service reads a user's balance, adds a deposit in application code and writes the new balance. Two deposits arriving together sometimes result in only one being counted.
2. A coupon may be used 100 times in total. The code counts the uses with a `SELECT`, and inserts a new use if the count is below 100. The coupon has been used 103 times.
3. A monthly statement reads the opening balance, then the list of transactions, then the closing balance, in three statements. Sometimes they do not add up.
4. Two administrators edit the same product description in a form for ten minutes each. The one who saves second erases the other's changes.

## One possible answer {walkthrough}

1. **Lost update.** Use `UPDATE wallets SET balance = balance + 25 WHERE id = ?`. The database computes from the current value, and a second update waits for the first.

2. **Write skew.** Each transaction inserts its own new row, so they never touch the same row, and each saw a count under 100. Lock the coupon row with `SELECT ... FOR UPDATE` before counting, so the checks happen one at a time. Or keep a `uses` column on the coupon and run `UPDATE coupons SET uses = uses + 1 WHERE id = ? AND uses < 100`, treating "no row updated" as "coupon exhausted".

3. **Non-repeatable read**, across statements. Run the three statements in one transaction at Repeatable Read, so they share a snapshot. It is a read-only transaction, so it will not fail with a conflict.

4. **Lost update, over a long time.** Locking a row for ten minutes while a person types would be wrong. Use a version column: the save succeeds only if the version is unchanged, and otherwise the second administrator is told that the text changed and shown the difference.

None of the four needed Serializable. The usual tools are an atomic update, a row lock, a constraint and a version check.
