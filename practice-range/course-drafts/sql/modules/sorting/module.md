---
id: course:sql-foundations/module/sorting
title: Sort and limit
requires: ["column-list","filter","null","is-null"]
outcomes: [{"id":"order","can":"Sort by a column and take the first rows.","assessment":["top-row","course:sql-foundations/task/sorting-cheapest"]},{"id":"keys","can":"Sort by two columns with different directions.","assessment":["two-keys","course:sql-foundations/task/sorting-signups"]},{"id":"transfer","can":"Place missing values on purpose and break ties.","assessment":["nulls-first","course:sql-foundations/task/sorting-top-bonus"]}]
tasks: [{"id":"course:sql-foundations/task/sorting-cheapest","path":"tasks/cheapest/task.json"},{"id":"course:sql-foundations/task/sorting-signups","path":"tasks/signups/task.json"},{"id":"course:sql-foundations/task/sorting-top-bonus","path":"tasks/top-bonus/task.json"}]
review: {"task":"course:sql-foundations/task/sorting-top-bonus","afterModule":"course:sql-foundations/module/joins","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["sorting/order-asc","sorting/order-desc","sorting/two-keys","sorting/limit","sorting/nulls-last"]
drillGap: These drills practise one sorting feature each. They do not combine a tie-break with missing values.
---

A table has no built-in order. If the order of a result matters, the query has to ask for it. This module covers ORDER BY, taking the first rows with LIMIT, and where missing values land.

## Ask for an order

ORDER BY comes after WHERE and names the column to sort by. The default direction is ascending: smallest first, A before Z, earliest date first. DESC reverses it. LIMIT 3 keeps only the first three rows, and it is applied after sorting, so ORDER BY price DESC LIMIT 3 means the three most expensive. Without ORDER BY the rows can come back in any order, and LIMIT then keeps an arbitrary three.

```sql example top
SELECT name, price
FROM products
ORDER BY price DESC
LIMIT 3;

```

```output
Your query returned:
 name            | price
-----------------+---------
 Forge 16 Laptop | 1649.00
 Aero 13 Laptop  | 1199.00
 Scout 14 Laptop | 749.00
(3 rows)
```

## Predict the first row {prediction}

Read the ORDER BY and LIMIT, then predict the first row.

@example top

:::question top-row example=top
What is the first row?
- [x] Forge 16 Laptop, 1649.00 :: DESC puts the highest price first, and LIMIT keeps the top three.
- [ ] Quiet Harbor, 14.50 :: That is the cheapest product. DESC sorts from the highest price down.
- [ ] Aero 13 Laptop, 1199.00 :: That is the second most expensive. The Forge 16 costs more.
:::

## Sort, then cut {walkthrough}

All 24 products are sorted by price, highest first, and then the first three are kept. The Forge 16 Laptop at 1649.00 is the most expensive, so it comes first.

@example top

## More than one sort key

ORDER BY can list several columns. Rows are sorted by the first one, and rows that tie on it are sorted by the next. Each column has its own direction: ORDER BY country, signup_date DESC sorts countries A to Z and, inside each country, newest signup first. When rows can tie, add another column to the ORDER BY so the order is fully decided.

```sql example two-keys
SELECT first_name, city
FROM customers
WHERE country = 'USA'
ORDER BY city, first_name;

```

```output
Your query returned:
 first_name | city
------------+---------
 Ethan      | Austin
 Sofia      | Austin
 Ava        | Denver
 Liam       | Denver
 Lily       | Denver
 Henry      | Seattle
 Noah       | Seattle
(7 rows)
```

## Sort by city, then name {prediction}

Seven customers live in the USA. Predict the first row.

@example two-keys

:::question two-keys example=two-keys
What is the first row?
- [ ] Ava, Denver :: City is the first sort key, and Austin comes before Denver.
- [x] Ethan, Austin :: Austin is the first city, and Ethan comes before Sofia.
- [ ] Sofia, Austin :: Inside Austin the rows are sorted by first name, and Ethan comes before Sofia.
:::

## Where NULL lands

PostgreSQL sorts NULL as if it were larger than every value. In ascending order NULLs come last. In descending order they come first, which is often a surprise. Say what you want with NULLS LAST or NULLS FIRST after the column, or filter the NULL rows out.

```sql example nulls
SELECT first_name, bonus_pct
FROM employees
WHERE department_id = 4
ORDER BY bonus_pct DESC;

```

```output
Your query returned:
 first_name | bonus_pct
------------+-----------
 Kofi       | NULL
 Tom        | 10.00
 Laura      | 5.00
(3 rows)
```

## Sort a column with a gap {prediction}

Kofi has no bonus_pct. Predict the first row.

@example nulls

:::question nulls-first example=nulls
What is the first row?
- [ ] Tom, 10.00 :: In descending order NULL comes before every value.
- [ ] Laura, 5.00 :: DESC puts larger values first, and NULL counts as the largest.
- [x] Kofi, NULL :: PostgreSQL treats NULL as larger than any value, so DESC puts it first.
:::

## List the cheapest products {modification}

The starter has the right rows in the wrong direction.

@task sorting-cheapest

## Sort signups by country {independent}

Work from the prompt. The two sort columns go in different directions.

@task sorting-signups
