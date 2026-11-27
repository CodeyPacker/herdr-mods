---
id: course:sql-foundations/module/modify
title: Change data
requires: ["filter","logic","subquery","column-list","is-null"]
outcomes: [{"id":"insert","can":"Add a row and read the error from a repeated key.","assessment":["after-insert","bad-key","course:sql-foundations/task/modify-add-product"]},{"id":"update","can":"Change exactly the intended rows.","assessment":["no-where","course:sql-foundations/task/modify-restock"]},{"id":"transfer","can":"Delete rows chosen through another table.","assessment":["course:sql-foundations/task/modify-clear-cancelled"]}]
tasks: [{"id":"course:sql-foundations/task/modify-restock","path":"tasks/restock/task.json"},{"id":"course:sql-foundations/task/modify-add-product","path":"tasks/add-product/task.json"},{"id":"course:sql-foundations/task/modify-clear-cancelled","path":"tasks/clear-cancelled/task.json"}]
review: {"task":"course:sql-foundations/task/modify-clear-cancelled","afterModule":"course:sql-foundations/module/checks","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["modify/insert-one","modify/update-one","modify/update-expression","modify/delete-where","modify/delete-subquery","modify/update-returning"]
drillGap: These drills practise one statement each. They do not show what a missing or too-wide WHERE changes.
---

Queries read data. Three other statements change it: INSERT adds rows, UPDATE changes them and DELETE removes them. The WHERE clause you already know decides which rows are touched, and getting it wrong changes the whole table. Every check here starts from a fresh copy of the database, so you can experiment freely.

## Add a row

INSERT INTO departments (id, name, location, budget) VALUES (7, 'Research', 'Austin', 250000.00); adds one row. The first list names the columns and the second gives a value for each, in the same order. A column you leave out gets its default value, or NULL when it has none. A statement that changes data returns no rows. The result tells you how many rows it changed. Run a SELECT afterwards to see the new state.

```sql example insert
INSERT INTO departments (id, name, location, budget)
VALUES (7, 'Research', 'Austin', 250000.00);

SELECT name, location
FROM departments
WHERE id >= 6;

```

```output
Statement 1 changed 1 row.
Statement 2 returned:
 name     | location
----------+----------
 Legal    | Denver
 Research | Austin
(2 rows)
```

## Look after an insert {prediction}

The file inserts a department, then selects the departments with an id of 6 or more. Predict how many rows the SELECT returns.

@example insert

:::question after-insert example=insert
How many rows does the SELECT return?
- [ ] 1 :: Legal has id 6 and the new department has id 7, so two rows pass.
- [x] 2 :: Legal, with id 6, and the new Research department, with id 7.
- [ ] 7 :: The WHERE keeps only the departments whose id is 6 or more.
:::

## Insert a key that exists {prediction}

A department with id 3 already exists. Read the example before checking.

```sql example bad-key diagnostics=[{"code":"23505"}]
INSERT INTO departments (id, name, location, budget)
VALUES (3, 'Research', 'Austin', 250000.00);

```

:::question bad-key example=bad-key
What happens when you check this example?
- [x] PostgreSQL reports an error, and the table is unchanged. :: id is the primary key, and a row with id 3 exists (23505).
- [ ] The Sales department is replaced by Research. :: INSERT never replaces a row. A repeated key is an error.
- [ ] A second department with id 3 is added. :: A primary key value can appear only once in the table.
:::

## Read the error {walkthrough}

Check the example. Error 23505 says a duplicate key value violates a unique constraint, and the next line names the key: (id)=(3) already exists. The id is the table's primary key, so no two rows may share one. The table is unchanged. This kind of error comes from the data, not from the wording of the statement, so it has no line number.

@example bad-key

## Change and remove rows

UPDATE products SET price = price * 0.9 WHERE category_id = 12; changes the rows that pass the WHERE. SET can use the row's old values, as it does here. DELETE FROM reviews WHERE rating = 1; removes the rows that pass. In both, the WHERE is optional, and leaving it out applies the statement to every row of the table. Before running an UPDATE or DELETE, run a SELECT with the same WHERE and check that it returns exactly the rows you mean. Adding RETURNING and a column list to any of the three statements makes it return the rows it touched.

```sql example no-where
UPDATE products
SET discontinued = true;

SELECT count(*) AS discontinued
FROM products
WHERE discontinued;

```

```output
Statement 1 changed 24 rows.
Statement 2 returned:
 discontinued
--------------
 24
(1 row)
```

## An UPDATE with no WHERE {prediction}

Three of the 24 products are discontinued. This UPDATE has no WHERE. Predict the count afterwards.

@example no-where

:::question no-where example=no-where
What count comes back?
- [ ] 3 :: The UPDATE has no WHERE, so it changed every row, not only the three.
- [ ] 21 :: Every product is now discontinued, including the 21 that were not.
- [x] 24 :: Without a WHERE, UPDATE changes every row in the table.
:::

## Every row was changed {walkthrough}

The UPDATE reports that it changed 24 rows, and the count confirms that every product is now discontinued. Nothing warned about the missing WHERE, because the statement is valid. In this course the next check starts from a fresh copy. In a real database those rows would stay changed.

@example no-where

## Restock what is still sold {modification}

The starter also restocks discontinued products. Narrow its WHERE.

@task modify-restock

## Add a product {independent}

Work from the prompt. Name the columns you fill in.

@task modify-add-product
