---
id: course:sql-foundations/module/select
title: Choose and name columns
requires: ["run-query","read-result","sql-error"]
outcomes: [{"id":"name","can":"Compute a column and give it a name.","assessment":["header","course:sql-foundations/task/select-stock-value"]},{"id":"text","can":"Build a text column from other columns.","assessment":["course:sql-foundations/task/select-full-name"]},{"id":"alias-scope","can":"Say where a column's new name can and cannot be used.","assessment":["bad-alias"]},{"id":"transfer","can":"Return each distinct value once.","assessment":["distinct-count","course:sql-foundations/task/select-countries"]}]
tasks: [{"id":"course:sql-foundations/task/select-stock-value","path":"tasks/stock-value/task.json"},{"id":"course:sql-foundations/task/select-full-name","path":"tasks/full-name/task.json"},{"id":"course:sql-foundations/task/select-countries","path":"tasks/countries/task.json"}]
review: {"task":"course:sql-foundations/task/select-countries","afterModule":"course:sql-foundations/module/nulls","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["select/column-alias","select/expression","select/concat","select/distinct","select/round"]
drillGap: These drills practise one SELECT feature each. They do not combine a computed column with a required name.
---

The SELECT list decides what each result row contains. It can hold columns, calculations and joined text, and every one of them can be given a clear name. This module also covers returning each distinct value once.

## Columns can be computed

Each item in the SELECT list produces one column of the result, worked out separately for every row. An item can be a column, or an expression such as budget / 12. +, -, * and / work on numbers. ROUND(value, 2) rounds to two decimal places. The || operator joins pieces of text, and text you type yourself goes in single quotes, as in first_name || ' ' || last_name. AS gives a result column a name: budget / 12 AS monthly_budget. A computed column without a name is shown as ?column?, which tells a reader nothing, so always name them. AS changes only the result. The table is not changed.

```sql example monthly
SELECT name AS department, ROUND(budget / 12, 2) AS monthly_budget
FROM departments;

```

```output
Your query returned:
 department  | monthly_budget
-------------+----------------
 Executive   | 75000.00
 Engineering | 200000.00
 Sales       | 91666.67
 Marketing   | 54166.67
 Support     | 40000.00
 Legal       | 25000.00
(6 rows)
```

## Predict the header {prediction}

Read the SELECT list and predict the first line of the result.

@example monthly

:::question header example=monthly
What is the first line of the result?
- [x] department | monthly_budget :: AS gave both columns new names, and the header shows them.
- [ ] name | budget :: Both columns were renamed with AS, so the original names are not shown.
- [ ] department | ?column? :: The computed column was given the name monthly_budget.
:::

## Follow one row {walkthrough}

The header shows the new names: department and monthly_budget. For the Sales row, budget is 1100000.00. Divided by 12 and rounded to two places that is 91666.67. Every row is worked out the same way, from its own budget.

@example monthly

## Use a new name too early {prediction}

The second item uses the name the first item was just given. Read the example before checking.

```sql example bad-alias diagnostics=[{"code":"42703","line":1}]
SELECT budget / 12 AS monthly, monthly * 2
FROM departments;

```

:::question bad-alias example=bad-alias
What happens when you check this example?
- [ ] It returns monthly and a second column twice as large. :: The second item cannot see the name monthly, so the statement fails.
- [x] PostgreSQL reports an error on line 1. :: monthly is a name for a result column. Items in the same SELECT list cannot use it (42703).
- [ ] It returns one column, because the second is ignored. :: A bad name is an error. Nothing is ignored, and nothing is returned.
:::

## Read the error {walkthrough}

Check the example. Error 42703 says column "monthly" does not exist. A name given with AS belongs to the result, and the other items in the same SELECT list cannot see it. Repeat the expression instead: budget / 12 * 2.

@example bad-alias

## Each value once

SELECT DISTINCT removes duplicate rows from the result. With one column, each value appears once. With several columns, DISTINCT looks at the whole row, so a row is dropped only when every column matches another row.

```sql example locations
SELECT DISTINCT location
FROM departments;

```

```output
Your query returned:
 location
----------
 Austin
 Chicago
 Denver
(3 rows)
```

## Count the distinct values {prediction}

Six departments share a few locations. Predict how many rows come back.

@example locations

:::question distinct-count example=locations
How many rows come back?
- [ ] 6 :: DISTINCT removes the repeats, and several departments share a location.
- [ ] 1 :: DISTINCT keeps one row for each different value, not one row in total.
- [x] 3 :: The departments are in Denver, Chicago and Austin, and each appears once.
:::

## Name a computed column {modification}

The starter computes the right values but leaves the column without a name.

@task select-stock-value

## Build a full name {independent}

Work from the prompt. Mind the space between the two names.

@task select-full-name
