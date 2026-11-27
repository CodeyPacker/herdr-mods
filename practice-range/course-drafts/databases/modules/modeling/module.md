---
id: course:databases/module/modeling
title: Model the data
requires: []
outcomes: []
tasks: []
drills: []
---

The shape of the tables decides which mistakes the database can prevent and which queries are easy. This module covers keys, relationships, the rule of storing each fact once, and the constraints that keep bad data out.

## Each table is one kind of thing

A good table describes one kind of thing, and each row is one of them: one customer, one order, one product. Each column is one fact about that thing.

A quick test for a design is to say what a row means in one sentence. "Each row is one order" is clear. "Each row is an order, or sometimes a refund, and the last three columns apply only to subscriptions" describes a table that is doing several jobs.

## Keys

Every table needs a **primary key**: a column, or a set of columns, whose value identifies exactly one row and never changes.

There are two kinds.

- A **natural key** is a value from the real world: an email address, a tax number, a product code.
- A **surrogate key** is a value made up for the purpose, with no meaning: a number from a sequence, or a UUID (a long random identifier).

Natural keys look attractive and cause trouble, because real-world values change. People change email addresses. Product codes are reissued. When a key changes, every row in every other table that refers to it has to change too.

The usual advice is a surrogate primary key, plus a unique constraint on the natural value. The row keeps a stable identity, and duplicates are still refused.

```sql
CREATE TABLE customers (
  id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email  text NOT NULL UNIQUE,
  name   text NOT NULL
);
```

## Relationships

Tables refer to each other with a **foreign key**: a column that holds the primary key of a row in another table.

There are three shapes of relationship.

- **One to many.** One customer has many orders. The "many" side holds the foreign key: `orders.customer_id`.
- **Many to many.** A student takes many courses, and a course has many students. Neither table can hold the key. A third table, with one row per pair, connects them.
- **One to one.** A user has one profile. It is rare. It is used to split off columns that are optional, large or need different access.

```text example relationships readonly
   ONE TO MANY                     MANY TO MANY

   customers        orders         students    enrolments     courses
   +----+           +----+-----+   +----+      +-----+-----+  +----+
   | id |<----------| id | cust|   | id |<-----| stud| crs |->| id |
   +----+           +----+-----+   +----+      +-----+-----+  +----+
   | 17 |           | 1  | 17  |   | 1  |      | 1   | 10  |  | 10 |
   | 18 |           | 2  | 17  |   | 2  |      | 1   | 11  |  | 11 |
   +----+           | 3  | 18  |   +----+      | 2   | 10  |  +----+
                    +----+-----+               +-----+-----+

   the many side holds the key     a third table holds one row per pair
```

## Store each fact once

The central rule of relational design is that each fact is stored in exactly one place. A design that follows it is called **normalized**.

Look at an `orders` table that also stores the customer's name and email in every row. The customer's email is now recorded once per order. Three problems follow.

- **Update.** When the email changes, every order row has to be changed. If one is missed, the database holds two different emails for one customer.
- **Insert.** A customer with no orders cannot be recorded at all.
- **Delete.** Deleting a customer's only order also deletes the only record of their email.

The fix is to move the customer's facts to a `customers` table and leave only `customer_id` in `orders`. The email is stored once, and a change is one update.

```text example normalize readonly
   BEFORE: the email is repeated in every order

   orders
   id   customer_name   customer_email       total
   1    Ana Ruiz        ana@example.com      40.00
   2    Ana Ruiz        ana@example.com      12.50
   3    Ana Ruiz        ana@old.example.com  25.00   <- which is right?

   AFTER: each fact is in one place

   customers                          orders
   id   name       email              id   customer_id   total
   17   Ana Ruiz   ana@example.com    1    17            40.00
                                      2    17            12.50
                                      3    17            25.00
```

## A practical test

The formal rules of normalization are called normal forms. In practice, three questions catch nearly every problem.

1. **Is any column a list?** A column `tags` that holds `"red,large,sale"` cannot be indexed, searched or constrained properly. Lists belong in their own table, one row per item.
2. **Are there numbered columns?** `phone1`, `phone2`, `phone3` is a list in disguise. What happens with a fourth phone?
3. **Does any column describe something other than this row's thing?** In an `orders` table, `customer_email` describes the customer, not the order. It belongs with the customer.

## Not everything that repeats is a duplicate

One case looks like a violation and is not. An order line stores the price that was charged, although the product also has a price.

These are two different facts. `products.price` is what the product costs now. `order_lines.unit_price` is what this customer paid on that day. If the order line only pointed at the product, last year's invoices would change whenever a price was updated.

Ask whether the value should change when the source changes. If yes, store it once and join. If it must be frozen at a moment in time, copy it, and name the column to make that clear.

## Frozen or live {prediction}

An invoicing system stores a customer's billing address in the `customers` table only. An invoice row holds `customer_id` and the amounts. A customer moves and updates their address.

:::question frozen
What happens to the invoices issued before the move?
- [ ] Nothing. They keep the old address :: The invoices do not hold an address. They are joined to the customer row, which now has the new one.
- [x] They all show the new address, including ones issued years ago :: The address on an issued invoice is a historical fact. It should have been copied onto the invoice when it was issued.
- [ ] The update is refused, since invoices refer to the address :: Nothing links the invoices to the address value, so nothing stops the change.
:::

## Constraints

A **constraint** is a rule that the database enforces on every write, whichever application or script does the writing.

| Constraint | Guarantees |
| --- | --- |
| `NOT NULL` | The column always has a value |
| `UNIQUE` | No two rows share the value |
| `PRIMARY KEY` | Unique, required, and identifies the row |
| `FOREIGN KEY` | The value refers to a row that exists |
| `CHECK` | A condition holds, such as `quantity > 0` |

Checks in application code are useful, and they are not enough. Bugs skip them, a second application does not have them, and a manual fix at 03:00 does not go through them. A constraint in the database holds whatever happens above it.

Constraints are also documentation that cannot go out of date. A `NOT NULL` column tells every reader of the schema that the value is always there.

```sql
CREATE TABLE order_lines (
  order_id    bigint  NOT NULL REFERENCES orders (id),
  product_id  bigint  NOT NULL REFERENCES products (id),
  quantity    integer NOT NULL CHECK (quantity > 0),
  unit_price  numeric(10, 2) NOT NULL CHECK (unit_price >= 0),
  PRIMARY KEY (order_id, product_id)
);
```

## Choose types that fit

A column's type is its first constraint.

- **Money** goes in an exact decimal type, never a floating-point one. Floating point cannot represent 0.10 exactly, and totals drift.
- **A moment in time** goes in a timestamp with time zone, stored in UTC. A timestamp without a zone is ambiguous as soon as two servers or two countries are involved.
- **Yes or no** goes in a boolean, not in text holding `'Y'` or `'yes'` or `'1'`.
- **One of a fixed set** goes in a column with a `CHECK`, an enum type, or a foreign key to a small lookup table.
- **Dates and numbers** never go in text columns. As text, `'10'` sorts before `'9'`.

## NULL means unknown

`NULL` marks a missing value. It does not behave like an ordinary value, which surprises people.

- Any comparison with `NULL` gives unknown, not true or false. `WHERE discount <> 10` does not return rows where `discount` is `NULL`.
- `NULL = NULL` is not true. Test with `IS NULL`.
- `count(column)` skips `NULL` values. `count(*)` does not.

Decide for each column whether a missing value can really occur. If it cannot, declare `NOT NULL`. Every nullable column is a case that each query has to think about.

## The missing rows {prediction}

A `tasks` table has a nullable `assignee_id`. A report runs:

```sql
SELECT count(*) FROM tasks WHERE assignee_id <> 42;
```

The table has 100 tasks: 30 assigned to user 42, 50 assigned to others, and 20 unassigned.

:::question null-compare
What does the query return?
- [ ] 70 :: That would include the unassigned tasks. Their `assignee_id` is `NULL`.
- [x] 50 :: For the 20 unassigned tasks, `NULL <> 42` is unknown, and `WHERE` keeps only rows where the condition is true.
- [ ] 100 :: The 30 tasks assigned to user 42 fail the condition.
:::

## Exercise: fix the schema {independent}

A small library keeps everything in one table.

```text example library readonly
   loans
   id | member_name | member_phones        | book_title    | author
   ---+-------------+----------------------+---------------+-----------
   1  | Ana Ruiz    | 555-0101, 555-0102   | Dune          | F. Herbert
   2  | Ana Ruiz    | 555-0101             | Emma          | J. Austen
   3  | Bilal Okafor| 555-0177             | Dune          | F. Herbert

      | due_date   | returned
      +------------+---------
      | 2025-03-10 | yes
      | 03/14/2025 | N
      | 2025-03-12 |
```

List the problems. Then design tables that fix them, with keys, types and constraints. Note that the library owns several copies of some books.

## One possible answer {walkthrough}

**Problems**

- A member's name and phones are repeated per loan, and the two rows for Ana already disagree about her phones.
- `member_phones` is a list in one column.
- Book title and author are repeated per loan.
- A member with no loans, or a book never borrowed, cannot be recorded.
- `due_date` is text in two formats. `returned` is text with three spellings of two values.
- Nothing says which copy of "Dune" was lent.

**Tables**

```sql
CREATE TABLE members (
  id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name  text NOT NULL
);

CREATE TABLE member_phones (
  member_id  bigint NOT NULL REFERENCES members (id),
  phone      text   NOT NULL,
  PRIMARY KEY (member_id, phone)
);

CREATE TABLE books (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title   text NOT NULL,
  author  text NOT NULL
);

CREATE TABLE copies (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_id  bigint NOT NULL REFERENCES books (id)
);

CREATE TABLE loans (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  copy_id      bigint NOT NULL REFERENCES copies (id),
  member_id    bigint NOT NULL REFERENCES members (id),
  due_date     date   NOT NULL,
  returned_at  timestamptz
);
```

`returned_at` replaces the yes/no column. An empty value means the copy is still out, and a value says when it came back, which is more useful than a flag. This is a case where `NULL` has one clear meaning.

One more rule is worth enforcing: a copy can be out on only one loan at a time. A partial unique index does it, on `loans (copy_id) WHERE returned_at IS NULL`.

Indexes on `loans.member_id` and `copies.book_id` are needed as well, since foreign keys do not create them.
