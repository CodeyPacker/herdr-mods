---
id: course:databases/module/review
title: Review a schema and its queries
requires: []
outcomes: []
tasks: []
drills: []
---

This module has no new ideas. You review a schema and the code that uses it, read a plan, and then design a schema of your own. Do each exercise on paper before you read its answer.

## How to use this module

Each exercise has a step where you work alone and a step with one possible answer. The answers are not the only good ones. Compare your reasoning with them, and pay most attention to anything you did not think of at all.

When you review a database design, ask the same questions each time.

1. Is each fact stored once, with a constraint that keeps it valid?
2. Does each frequent query have an index that fits it, and is any index unused?
3. Which code reads a value and then writes based on it?
4. How long is each transaction open, and what does it hold?
5. What happens to this table when it is a hundred times larger?

## Review 1: a booking system {independent}

A small gym built this. Read the schema and the description of the code, and list every problem you find. Rank them.

```sql
CREATE TABLE bookings (
  id           serial,
  member_name  text,
  member_email text,
  class_name   text,
  class_time   text,          -- for example '2025-03-04 18:00'
  price        float,
  paid         text,          -- 'yes' or 'no'
  tags         text           -- for example 'yoga,beginner'
);
CREATE INDEX ON bookings (member_name);
CREATE INDEX ON bookings (class_name);
CREATE INDEX ON bookings (tags);
CREATE INDEX ON bookings (paid);
```

The code works like this:

- To book: it counts the bookings for the class with a `SELECT`. If the count is below 20, it inserts a new row.
- The "my bookings" page runs `SELECT * FROM bookings WHERE lower(member_email) = ?`, then loops over the rows and runs one query per row to fetch the class description from another table.
- Paying opens a transaction, sets `paid = 'yes'`, calls the payment provider and commits when the provider answers.
- The SQL for the class search is built by joining the search text into the query string.

## The most urgent one {prediction}

Before you read the full list, choose from three of the faults.

:::question gym-urgent
Which fault would you fix first?
- [ ] The four single-column indexes :: They cost writes and help little. Nobody is harmed by them today.
- [x] The search that joins user text into the SQL string :: It is SQL injection. Anyone who can use the search box can read or change the whole database. The fix is to send the text as a parameter.
- [ ] The price stored as a floating-point number :: It causes small rounding errors in totals. That needs fixing, and it is not an open door.
:::

## Review 1: what is wrong {walkthrough}

**Security**

1. **SQL injection** in the class search. Send the search text as a parameter. This is general guidance, not a statement of any organization's policy.

**Correctness**

2. **Overbooking.** Count-then-insert is write skew. Two bookings can both see 19 and both insert. Lock the class row with `SELECT ... FOR UPDATE` before counting, or keep a `spots_taken` column and use `UPDATE ... SET spots_taken = spots_taken + 1 WHERE spots_taken < 20`.
3. **No primary key and no constraints.** `serial` does not make a column a key. Nothing is `NOT NULL`. Nothing stops the same member from booking the same class twice.
4. **`price` as `float`.** Money needs an exact decimal type.
5. **`class_time` as text.** It cannot be compared, sorted or checked properly. Use a timestamp with time zone.
6. **`paid` as text.** Use a boolean, or a `paid_at` timestamp that is empty until payment.

**Design**

7. **Members and classes are repeated in every booking.** A member's email is stored once per booking, so it cannot be changed safely. A class with no bookings cannot exist. Split the table into `members`, `classes` and `bookings`.
8. **`tags` is a list in one column.** It belongs in its own table, one row per tag.

**Performance**

9. **`lower(member_email)` cannot use an index**, and there is none on the email anyway. With a `members` table, the page looks up bookings by `member_id`.
10. **N+1** on the "my bookings" page. Join the classes in one query.
11. **Four weak indexes.** `paid` has two values. `tags` holds a list as text. Replace them with indexes that match real queries: `bookings (member_id)`, `bookings (class_id)`.
12. **`SELECT *`** where four columns are shown.

**Transactions**

13. **A network call inside the transaction.** The row is locked, and a connection is held, for as long as the payment provider takes. Mark the booking as pending, commit, call the provider, and record the result in a second transaction.

## Review 2: a plan {independent}

The gym's weekly report takes 40 seconds. It lists each class in the past 7 days with its number of bookings. Here is the query and its plan, after the schema was split into three tables.

```sql
SELECT c.name, count(b.id)
FROM classes c
JOIN bookings b ON b.class_id = c.id
WHERE c.starts_at >= now() - interval '7 days'
GROUP BY c.name;
```

```text example gym-plan readonly
HashAggregate  (actual time=40210.5..40210.6 rows=85 loops=1)
  ->  Nested Loop  (actual time=0.9..40180.2 rows=1700 loops=1)
        ->  Seq Scan on classes c
              (cost=... rows=90 ...)
              (actual time=0.02..1.10 rows=85 loops=1)
              Filter: (starts_at >= (now() - '7 days'::interval))
              Rows Removed by Filter: 4300
        ->  Seq Scan on bookings b
              (actual time=210.4..472.6 rows=20 loops=85)
              Filter: (class_id = c.id)
              Rows Removed by Filter: 2599980
```

Find the step that takes the time, explain why, and say what to change. Say whether the sequential scan on `classes` needs fixing.

## Review 2: what the plan says {walkthrough}

**Where the time goes.** The inner `Seq Scan on bookings` takes about 470 ms and runs 85 times: 85 times 472 ms is 40 seconds. That is the whole query.

**Why.** For each of the 85 classes, the database scans all 2.6 million bookings to find about 20. The join column `bookings.class_id` is a foreign key, and PostgreSQL did not create an index for it.

**The fix.**

```sql
CREATE INDEX CONCURRENTLY bookings_class_id_idx
  ON bookings (class_id);
```

Each inner step becomes an index scan that reads a few pages. The query should drop from 40 seconds to a few milliseconds. The same index speeds up every other query that finds bookings by class, including the capacity check.

**The scan on `classes`.** It reads 4,385 rows in about 1 ms. It is not worth fixing today. An index on `starts_at` becomes worthwhile when the table is far larger. The estimate there was accurate, 90 against 85, so the statistics are fine.

The method is the one from the tuning module: multiply by `loops`, find the step with the time, and look for rows removed by a filter.

## Design: a library of shared documents {independent}

Design the schema for a document-sharing product. Users belong to one or more workspaces. A workspace has folders, and a folder can contain other folders and documents. A document has a title, a body that can be very large, and a history of versions. A document can be shared with individual users, with "view" or "edit" permission. The product must show a workspace's 50 most recently edited documents quickly, and must never lose an edit when two people save at once.

Write the tables with keys, types and constraints. List the indexes with the query each one serves. Say how concurrent saves are handled, and name one thing you would denormalize and one you would not.

## Design: one possible answer {walkthrough}

**Tables**

```sql
CREATE TABLE users (
  id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email  text NOT NULL UNIQUE,
  name   text NOT NULL
);

CREATE TABLE workspaces (
  id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name  text NOT NULL
);

CREATE TABLE memberships (
  workspace_id  bigint NOT NULL REFERENCES workspaces (id),
  user_id       bigint NOT NULL REFERENCES users (id),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE folders (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id  bigint NOT NULL REFERENCES workspaces (id),
  parent_id     bigint REFERENCES folders (id),
  name          text NOT NULL
);

CREATE TABLE documents (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id  bigint NOT NULL REFERENCES workspaces (id),
  folder_id     bigint NOT NULL REFERENCES folders (id),
  title         text NOT NULL,
  version       integer NOT NULL DEFAULT 1,
  edited_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE document_versions (
  document_id  bigint  NOT NULL REFERENCES documents (id),
  version      integer NOT NULL,
  body         text    NOT NULL,
  author_id    bigint  NOT NULL REFERENCES users (id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, version)
);

CREATE TABLE shares (
  document_id  bigint NOT NULL REFERENCES documents (id),
  user_id      bigint NOT NULL REFERENCES users (id),
  permission   text   NOT NULL CHECK (permission IN ('view', 'edit')),
  PRIMARY KEY (document_id, user_id)
);
```

Choices worth noting: the many-to-many relationships (`memberships`, `shares`) are tables with a composite primary key, which also prevents duplicates. A folder's `parent_id` is empty for a top-level folder. The large `body` lives in `document_versions`, so listing documents never reads it.

**Indexes**

| Index | Serves |
| --- | --- |
| `documents (workspace_id, edited_at DESC)` | The 50 most recently edited documents of a workspace, in order, with no sort |
| `documents (folder_id)` | Listing a folder |
| `folders (workspace_id, parent_id)` | Listing a folder's subfolders |
| `memberships (user_id)` | A user's workspaces. The primary key starts with `workspace_id`, so it does not serve this |
| `shares (user_id)` | "Shared with me" |

The primary keys already serve "members of a workspace", "shares of a document" and "one version of a document".

**Concurrent saves.** Optimistic locking with the `version` column. A person may edit for minutes, so holding a lock is wrong. A save runs in one transaction:

```sql
UPDATE documents
SET version = version + 1, edited_at = now()
WHERE id = ? AND version = ?;   -- the version the editor started from
```

If one row was updated, insert the new `document_versions` row and commit. If none was, someone else saved first. Roll back and show the editor the newer version. No edit is overwritten silently, and the primary key on `(document_id, version)` refuses a duplicate version as a second line of defence.

**Denormalized.** `documents.workspace_id` repeats what the folder already says, and `documents.edited_at` repeats the newest version's timestamp. Both exist so that the "recent documents" query is one index scan on one table. Both are written in the same transaction as the change they mirror.

**Not denormalized.** The author's name on each version. Joining `users` by primary key for 50 rows costs almost nothing, and a copied name would have to be updated across every version when a user renames themselves.

## What to check before a release {prediction}

A team is about to ship a feature that adds a column, a new query on a 300-million-row table, and a function that reads a balance and then updates it.

:::question release-check
Which check is most likely to prevent an incident?
- [ ] Confirm that the tests pass on the development database :: They will pass. A development database has a few hundred rows, so every plan is fast and no two transactions overlap.
- [x] Read the plan of the new query on production-sized data, check what the migration locks, and look for read-then-write code :: These are the three things that behave differently at production size and under real concurrency.
- [ ] Add indexes on every column the new query mentions :: Indexes chosen without a plan cost writes and may not be used.
:::

## Where to go next {explanation}

You can now explain what a query costs, choose indexes for it, read its plan, design tables that protect their own data, and reason about what happens when many transactions run at once.

Four habits are worth keeping.

- **Look at the plan** before and after every change, with real values on real-sized data.
- **Let the database enforce the rules.** A constraint holds when the code does not.
- **Be suspicious of read-then-write.** Make it one statement, lock the row, or check a version.
- **Keep transactions short**, and never wait on anything outside the database while one is open.

The details in this course are PostgreSQL's. When you work with another database, the ideas carry over and the particulars need checking: its default isolation level, which schema changes lock a table, and how it cleans up old rows.
