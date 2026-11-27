---
id: course:databases/module/migrations
title: Change a schema safely
requires: []
outcomes: []
tasks: []
drills: []
---

A schema has to change while the application is running and the tables are full. This module covers which changes are quick and which lock a table, how to make a change in steps that the running code survives, and how to move large amounts of data.

## Why schema changes are risky

On an empty development database, every schema change is instant. On a production table with 200 million rows and constant traffic, the same statement can do three harmful things.

- **Lock the table.** Most structural changes need a lock on the whole table, as the locking module described. While it is held, nothing can read or write.
- **Rewrite the table.** Some changes make the database copy every row into a new file. On a large table that takes minutes or hours, with the lock held throughout.
- **Break the running code.** During a deploy, old and new versions of the application run at the same time. A change that only the new version understands breaks the old one.

A safe change avoids all three. That takes knowing which statements are cheap, and splitting the dangerous ones into steps.

## Migrations as files

A **migration** is a small script that makes one change to the schema. Migrations are kept in version control with the code, numbered in order, and applied by a tool that records which ones have run.

This gives every environment the same schema, built by the same steps, and makes each change reviewable. Review a migration as carefully as code, with one extra question: what does this statement do to a large, busy table?

## Cheap and expensive changes

In current PostgreSQL versions, these are quick, because they change only the table's description:

- Adding a nullable column.
- Adding a column with a constant default.
- Dropping a column. The data is left in place and ignored.
- Renaming a column or table. Quick for the database, and dangerous for the application.

These are slow or blocking on a large table:

- Changing a column's type, in most cases. Every row is rewritten.
- Adding a `NOT NULL` constraint the plain way. The whole table is scanned under a lock.
- Adding a foreign key or a `CHECK` constraint the plain way. Every row is checked under a lock.
- Creating an index the plain way. Writes to the table are blocked for the whole build.

Even a quick change needs its table lock for a moment. If it has to wait for a long-running query, everything queues behind it. So set a lock timeout before every schema change, and retry on failure.

```sql
SET lock_timeout = '3s';
ALTER TABLE orders ADD COLUMN note text;
```

## Building an index without blocking

A plain `CREATE INDEX` blocks every insert, update and delete on the table until it finishes. On a large table that is minutes of failed writes.

PostgreSQL offers a second form that does not block writes.

```sql
CREATE INDEX CONCURRENTLY orders_customer_id_idx
  ON orders (customer_id);
```

It takes longer and it cannot run inside a transaction. If it fails partway, it leaves behind an index marked invalid, which must be dropped before trying again. On a table with real traffic it is the form to use every time.

Dropping an index has the same pair: `DROP INDEX CONCURRENTLY`.

## Constraints in two steps

A constraint can be added without a long lock by separating "enforce it for new rows" from "check the existing rows".

```sql
-- step 1: quick. New and changed rows must satisfy it from now on.
ALTER TABLE orders
  ADD CONSTRAINT orders_total_positive CHECK (total >= 0) NOT VALID;

-- step 2: scans the table, without blocking normal reads and writes.
ALTER TABLE orders VALIDATE CONSTRAINT orders_total_positive;
```

Foreign keys work the same way. For `NOT NULL`, add a `CHECK (col IS NOT NULL) NOT VALID`, validate it, and then set `NOT NULL`. PostgreSQL uses the validated check and skips its own scan.

## Which statement is dangerous {prediction}

A migration for a table with 300 million rows and constant writes contains these three statements.

```sql
ALTER TABLE events ADD COLUMN source text;
CREATE INDEX events_source_idx ON events (source);
ALTER TABLE events ALTER COLUMN payload TYPE jsonb USING payload::jsonb;
```

:::question dangerous
Which statements will cause an outage?
- [ ] Only the first :: Adding a nullable column changes only the table's description.
- [x] The second and the third :: The plain index build blocks all writes while it reads 300 million rows. The type change rewrites the whole table under a full lock.
- [ ] None. Schema changes are metadata changes :: Some are. Building an index and converting a column both have to process every row.
:::

## Old code and new code run together

During a deploy, some servers run the old code and some run the new, for seconds or minutes. A rollback means the old code runs again after the schema has changed. So at every moment the schema must work for both versions.

That rules out changes that seem natural.

- **Renaming a column** breaks the old code at once. It still uses the old name.
- **Dropping a column** breaks any code that still reads it, including `SELECT *` mapped onto a fixed set of fields.
- **Adding a required column** breaks old code that inserts without it.

## Expand, migrate, contract

The safe pattern splits one breaking change into steps that are each compatible with the code running at that moment.

1. **Expand.** Add the new thing beside the old. Nothing uses it yet.
2. **Migrate.** Deploy code that writes to both and reads from the old. Copy the existing data across. Then deploy code that reads from the new.
3. **Contract.** When nothing uses the old thing, remove it.

Renaming `users.fullname` to `users.display_name` becomes:

```text example expand-contract readonly
   step  schema change                code deployed
   ----  ---------------------------  ------------------------------
   1     add display_name (nullable)  (unchanged)
   2                                  write both columns, read fullname
   3     copy fullname into
         display_name, in batches
   4                                  read display_name, write both
   5                                  write only display_name
   6     drop fullname

   Every step can be rolled back to the one before it.
```

It is six steps where one statement would do on paper. Each of them is safe and can be undone, and there is never a moment when running code refers to something that does not exist.

## Backfills

Step 3 above is a **backfill**: filling a new column for rows that already exist. On a large table, one `UPDATE` of every row is a single huge transaction. It locks every row it touches until it ends, writes an enormous amount of log, makes replicas fall behind and bloats the table.

Do it in batches, as in the transactions module.

- Update a few thousand rows per transaction, selected by a range of primary keys.
- Pause briefly between batches, and watch replica lag and load.
- Make the job safe to stop and start again: `WHERE display_name IS NULL` skips rows already done.
- Keep the new code writing both columns while it runs, so that rows changed in the meantime stay correct.

```sql
UPDATE users SET display_name = fullname
WHERE id BETWEEN 1 AND 5000 AND display_name IS NULL;
-- then 5001 to 10000, and so on
```

## Changing a column's type

A type change that rewrites the table is handled with the same pattern, since a new column is a cheap change and a rewrite is not.

1. Add a new column of the new type.
2. Write to both from the application.
3. Backfill in batches.
4. Switch reads to the new column.
5. Drop the old column, and rename if you wish, in a later release.

## Migrations and deploys

Run schema changes separately from the code that needs them, and in the right order.

- A change that adds something goes out **before** the code that uses it.
- A change that removes something goes out **after** the code that stopped using it.

Avoid running migrations automatically when the application starts. With ten copies starting together, ten of them try to run the same migration. A slow migration then also delays the start of the application and can fail its health checks. Run migrations as their own step in the pipeline, once.

## Going back

Rolling a migration back is harder than rolling code back, because data has changed. A dropped column cannot be restored by a "down" script. Its values are gone.

So the plan for most schema changes is to move forward. Keep each step small and compatible, so the code can be rolled back while the schema stays. Delay the destructive step, the contract, until the new version has run long enough to be trusted. And take a backup or snapshot before any step that destroys data.

## The rename {prediction}

A team renames `orders.state` to `orders.status` with one `ALTER TABLE ... RENAME COLUMN`. The statement takes 4 ms. The new code, which uses `status`, is deployed over the following two minutes.

:::question rename
What happens during those two minutes?
- [ ] Nothing. The rename was instant :: Instant for the database. The application servers running the old code still use the old name.
- [x] Every query from servers still running the old code fails with "column state does not exist" :: Old and new code overlap during a deploy. A rename is safe only as a series of expand, migrate and contract steps.
- [ ] The database keeps both names working for a while :: It does not. After the rename, only the new name exists.
:::

## Exercise: plan the change {independent}

An `accounts` table has 80 million rows and heavy traffic. It has a `plan` column of type text that holds `free`, `pro` or `team`. The team wants three changes.

1. A new required column `region`, which should be `'eu'` for all existing rows.
2. An index on `(region, plan)`.
3. A guarantee that `plan` can only hold one of the three values.

Write the steps in order, with the statement for each, and say what the application needs to do and when.

## One possible answer {walkthrough}

**1. The new column**

```sql
SET lock_timeout = '3s';
ALTER TABLE accounts ADD COLUMN region text NOT NULL DEFAULT 'eu';
```

A constant default is stored in the table's description, so this is quick, and existing rows read as `'eu'` without being rewritten. Old code that inserts without `region` keeps working, because the default fills it in. Deploy this before the code that sets or reads `region`.

**2. The index**

```sql
CREATE INDEX CONCURRENTLY accounts_region_plan_idx
  ON accounts (region, plan);
```

It runs outside a transaction. Afterwards, check that the index is valid. If the build failed, drop the invalid index and run it again.

**3. The constraint**

First check for bad values, since validation will fail if any exist:

```sql
SELECT plan, count(*) FROM accounts GROUP BY plan;
```

Fix whatever turns up, in batches. Then:

```sql
ALTER TABLE accounts ADD CONSTRAINT accounts_plan_valid
  CHECK (plan IN ('free', 'pro', 'team')) NOT VALID;

ALTER TABLE accounts VALIDATE CONSTRAINT accounts_plan_valid;
```

**Order and code.** Each statement is its own migration, with a lock timeout and a retry. None needs a matching code change at the same moment, which is the point. One thing to tell the team: once the constraint exists, adding a fourth plan value means changing the constraint before the code that writes the value.
