---
id: course:sql-foundations/module/save
title: Run a query, read the result
requires: []
outcomes: [{"id":"read","can":"Read a result table: its columns, its rows and its row count.","assessment":["shape","course:sql-foundations/task/save-list-projects"]},{"id":"error","can":"Find the line and the name a SQL error points at, and repair it.","assessment":["typo","course:sql-foundations/task/save-fix-query"]},{"id":"transfer","can":"Write a first query from a one-line request.","assessment":["course:sql-foundations/task/save-categories"]}]
tasks: [{"id":"course:sql-foundations/task/save-fix-query","path":"tasks/fix-query/task.json"},{"id":"course:sql-foundations/task/save-list-projects","path":"tasks/list-projects/task.json"},{"id":"course:sql-foundations/task/save-categories","path":"tasks/categories/task.json"}]
review: {"task":"course:sql-foundations/task/save-categories","afterModule":"course:sql-foundations/module/where","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["select/star","select/two-columns"]
drillGap: These drills practise the SELECT list. They do not include reading and repairing an error.
---

A database keeps data in tables, and SQL is the language for asking questions about them. Every exercise in this course works the same way: you write a query, save the file, and read what comes back. This module covers that loop.

## Tables, rows and columns

A **table** holds one kind of thing. The `departments` table has one **row** for each department and one **column** for each fact about it: `id`, `name`, `location` and `budget`.

A **query** asks for data:

```sql
SELECT name, location FROM departments;
```

- `SELECT` says which columns you want, and `FROM` says which table they come from. The semicolon ends the statement.
- Keywords such as `SELECT` and `FROM` can be written in any case. This course writes them in capitals so they stand out from table and column names.
- When you save an exercise, your SQL runs on a fresh copy of the practice database, so nothing you do is kept between checks. The file `schema.sql` beside your answer lists every table and every row.

This course uses PostgreSQL.

## Predict the shape of a result {prediction}

Read the query and predict how many columns and rows come back.

```sql example departments
SELECT name, location
FROM departments;

```

```output
Your query returned:
 name        | location
-------------+----------
 Executive   | Denver
 Engineering | Denver
 Sales       | Chicago
 Marketing   | Chicago
 Support     | Austin
 Legal       | Denver
(6 rows)
```

:::question shape example=departments
What shape does the result have?
- [ ] 4 columns and 6 rows :: The query lists two columns, so only those two come back.
- [x] 2 columns and 6 rows :: The first line of a result names the columns, in the order the query listed them. Each line after that is one row, and the last line counts them. Two of the four columns were asked for, and the table has six departments. The rows came back in the order they were stored: a query that does not ask for an order is not promised one.
- [ ] 2 columns and 1 row :: A query without a filter returns every row of the table.
:::

## Predict an error {prediction}

One column name in this query is misspelled. Predict what happens when you check it.

```sql example typo diagnostics=[{"code":"42703","line":1}]
SELECT name, locaton
FROM departments;

```

:::question typo example=typo
What happens when you check this example?
- [ ] It returns the name column only. :: One bad name stops the whole statement. Nothing is returned.
- [ ] It returns both columns, with the second one empty. :: A column that does not exist is an error, not an empty column.
- [x] PostgreSQL reports an error on line 1 and returns nothing. :: One bad name stops the whole statement, so nothing is returned. The error, 42703, names the misspelled column and the line it is on.
:::

## Repair a query {modification}

Save the starter as it is and read the error. An error looks like this:

```text
Exercise.sql:1:14 - error 42703: column "locaton" does not exist
Hint from PostgreSQL: Perhaps you meant to reference the column "departments.location".
```

- `1:14` is the line and the character where PostgreSQL noticed the problem, and `42703` is the error code.
- A hint, when there is one, often names what you meant.

Fix what the error names and save again. There is more than one mistake.

@task save-fix-query

## List the projects {independent}

Work from the prompt. The column names are in schema.sql.

@task save-list-projects
