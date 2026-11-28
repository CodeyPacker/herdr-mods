---
id: course:sql-foundations/module/tables
title: Design a table
requires: ["insert","update","filter","null"]
outcomes: [{"id":"create","can":"Create a table with types, a key and a default.","assessment":["default","course:sql-foundations/task/tables-suppliers"]},{"id":"constraint","can":"Predict which rows a constraint rejects.","assessment":["check","course:sql-foundations/task/tables-coupons"]},{"id":"foreign","can":"Link a table to another with a foreign key.","assessment":["foreign","course:sql-foundations/task/tables-shipments"]}]
tasks: [{"id":"course:sql-foundations/task/tables-suppliers","path":"tasks/suppliers/task.json"},{"id":"course:sql-foundations/task/tables-shipments","path":"tasks/shipments/task.json"},{"id":"course:sql-foundations/task/tables-coupons","path":"tasks/coupons/task.json"}]
review: {"task":"course:sql-foundations/task/tables-coupons","afterModule":"course:sql-foundations/module/checks","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["ddl/create-table","ddl/default","ddl/foreign-key","ddl/unique","ddl/check"]
drillGap: These drills practise one constraint each. They do not test a table against rows that should be rejected.
---

A table's definition decides what data it will accept. Types, keys and constraints written into the definition reject bad rows before they are stored, so no query has to work around them later. This module covers CREATE TABLE and the constraints that protect a table.

## Columns, types and a key

`CREATE TABLE` names a table and lists its columns. Each column has a name and a type:

| Type | Holds |
| --- | --- |
| `integer` | whole numbers |
| `numeric(8, 2)` | exact decimals with two places |
| `text`, `boolean`, `date` | text, true or false, a date |

After the type come the column's rules:

- `PRIMARY KEY` marks the column that identifies a row. Its values must be unique and cannot be `NULL`.
- `NOT NULL` means the column must always have a value.
- `DEFAULT` gives the value to use when an `INSERT` leaves the column out.
- `UNIQUE` forbids two rows with the same value.


## Leave a column out {prediction}

The INSERT gives no country. Predict what the row holds for it.

```sql example create
CREATE TABLE suppliers (
    id      integer PRIMARY KEY,
    name    text NOT NULL,
    country text NOT NULL DEFAULT 'USA',
    rating  integer CHECK (rating BETWEEN 1 AND 5)
);

INSERT INTO suppliers (id, name, rating)
VALUES (1, 'Acme', 4);

SELECT * FROM suppliers;

```

```output
Statement 2 changed 1 row.
Statement 3 returned:
 id | name | country | rating
----+------+---------+--------
 1  | Acme | USA     | 4
(1 row)
```

:::question default example=create
What does the stored row hold for country?
- [x] USA :: The `INSERT` left `country` out, so the row was stored with its default, USA. A column with no default and no value would hold `NULL`, which is allowed only when the column is not `NOT NULL`.
- [ ] NULL :: The column has a default, so a missing value becomes USA.
- [ ] The INSERT fails :: A NOT NULL column with a default accepts an INSERT that leaves it out.
:::

## Rules about values

`CHECK` attaches a test to the table. A row is accepted only when the test is not false.

- `CHECK (rating BETWEEN 1 AND 5)` rejects a rating of 9.
- A check that involves a `NULL` value is unknown, not false, so the row is accepted. Add `NOT NULL` when the column must be filled in.


## Break a CHECK {prediction}

The table allows ratings from 1 to 5. Predict what happens when you check this example.

```sql example check diagnostics=[{"code":"23514"}]
CREATE TABLE suppliers (
    id      integer PRIMARY KEY,
    name    text NOT NULL,
    country text NOT NULL DEFAULT 'USA',
    rating  integer CHECK (rating BETWEEN 1 AND 5)
);

INSERT INTO suppliers (id, name, rating)
VALUES (2, 'Bolt', 9);

```

:::question check example=check
What happens when you check this example?
- [ ] The row is stored with a rating of 5. :: A constraint never changes a value. It accepts the row or rejects it.
- [ ] The row is stored with a rating of 9. :: 9 is outside 1 to 5, so the CHECK rejects the row.
- [x] PostgreSQL reports an error and stores nothing. :: Error 23514 says the new row violates a check constraint, so the row is not stored. A constraint is a guarantee: every row in the table has passed it.
:::

## Rules about other tables

`REFERENCES` links a column to the key of another table. `order_id integer REFERENCES orders (id)` is a **foreign key**.

- It accepts only values that exist as an `id` in `orders`.
- It also protects the other side: an order cannot be deleted while a row still points at it.


## Point at a missing row {prediction}

No product has id 999. Predict what happens when you check this example.

```sql example foreign diagnostics=[{"code":"23503"}]
INSERT INTO order_items (order_id, product_id, quantity, unit_price)
VALUES (1, 999, 1, 5.00);

```

:::question foreign example=foreign
What happens when you check this example?
- [ ] The item is added with product 999. :: A foreign key accepts only ids that exist in the other table.
- [x] PostgreSQL reports an error and stores nothing. :: product_id must match an existing product, and none has id 999 (23503).
- [ ] A product with id 999 is created. :: A foreign key checks the other table. It never adds rows to it.
:::

## Create a suppliers table {modification}

The starter creates the table with no rules at all. Add them.

@task tables-suppliers

## Create a shipments table {independent}

Work from the prompt. One column points at another table and one has a limit.

@task tables-shipments
