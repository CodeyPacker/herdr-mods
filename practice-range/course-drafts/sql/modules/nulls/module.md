---
id: course:sql-foundations/module/nulls
title: Handle missing values
requires: ["filter","logic","expression","alias","column-list"]
outcomes: [{"id":"find","can":"Find rows where a value is missing.","assessment":["equals-null","course:sql-foundations/task/nulls-no-email"]},{"id":"spread","can":"Predict what NULL does to a calculation and to a comparison.","assessment":["null-math","not-equal"]},{"id":"fallback","can":"Supply a fallback with COALESCE while keeping real values.","assessment":["course:sql-foundations/task/nulls-contact"]},{"id":"transfer","can":"Use a fallback inside a calculation.","assessment":["course:sql-foundations/task/nulls-total-pay"]}]
tasks: [{"id":"course:sql-foundations/task/nulls-no-email","path":"tasks/no-email/task.json"},{"id":"course:sql-foundations/task/nulls-contact","path":"tasks/contact/task.json"},{"id":"course:sql-foundations/task/nulls-total-pay","path":"tasks/total-pay/task.json"}]
review: {"task":"course:sql-foundations/task/nulls-total-pay","afterModule":"course:sql-foundations/module/grouping","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["where/is-null","functions/coalesce","functions/nullif"]
drillGap: These drills practise one NULL tool each. They do not keep empty text apart from a missing value.
---

Real data has gaps: a customer with no email, an employee with no bonus. SQL marks a missing value with NULL, and NULL behaves differently from every other value. This module covers finding it, what it does to comparisons and arithmetic, and how to supply a fallback.

## NULL means unknown

`NULL` marks a value that is missing or unknown. It is not zero, and it is not empty text.

- Because the value is unknown, a comparison with it is unknown too: `email = NULL` is never true, not even for a row whose `email` is `NULL`.
- `WHERE` keeps a row only when its condition is true, so such a row is dropped.
- To test for a missing value use `IS NULL`, and `IS NOT NULL` for the opposite.

## Compare with NULL {prediction}

Three customers have no email. Predict how many rows this query returns.

```sql example equals-null
SELECT first_name, email
FROM customers
WHERE email = NULL;

```

```output
Your query returned:
 first_name | email
------------+-------
(0 rows)
```

:::question equals-null example=equals-null
How many rows come back?
- [x] 0 :: For every row, `email = NULL` is unknown, and unknown is not true. The fix is `WHERE email IS NULL`, which returns the three customers.
- [ ] 3 :: That is what IS NULL would return. = NULL is never true.
- [ ] 17 :: Those are the customers with an email, and email = NULL is not true for them either.
:::

## NULL spreads through calculations

Arithmetic with `NULL` gives `NULL`: an unknown bonus percentage makes an unknown bonus.

- `COALESCE(a, b)` returns `a` when it is not `NULL`, and `b` when it is. `COALESCE(bonus_pct, 0)` reads as: the bonus percentage, or 0 when there is none.
- Use it when a missing value should count as something.
- A real 0 and real empty text are values, and `COALESCE` leaves them alone.


## Calculate with a missing value {prediction}

Mei has no `bonus_pct`. Predict what the `bonus` and `pct` columns show for her.

```sql example bonus
SELECT first_name, bonus_pct,
       ROUND(salary * bonus_pct / 100) AS bonus,
       COALESCE(bonus_pct, 0) AS pct
FROM employees
WHERE department_id = 5;

```

```output
Your query returned:
 first_name | bonus_pct | bonus | pct
------------+-----------+-------+------
 Pete       | 6.00      | 5160  | 6.00
 Mei        | NULL      | NULL  | 0
 Carlos     | NULL      | NULL  | 0
 Ingrid     | NULL      | NULL  | 0
(4 rows)
```

:::question null-math example=bonus
What do bonus and pct show for Mei?
- [ ] 0 and 0 :: Only the pct column uses COALESCE. The bonus calculation has no fallback.
- [ ] NULL and NULL :: COALESCE(bonus_pct, 0) replaces the missing percentage with 0.
- [x] NULL and 0 :: For Mei the percentage is `NULL`, so the multiplication is `NULL` and so is the rounded result. Pete, with 6.00, gets 5160. The `pct` column uses `COALESCE`, so it shows 0 where the percentage is missing and the real value where there is one.
:::

## Not equal, and NULL {prediction}

Twenty customers exist and three have no email. Predict the count.

```sql example not-equal
SELECT count(*) AS customers
FROM customers
WHERE email <> 'noah.kim@example.com';

```

```output
Your query returned:
 customers
-----------
 16
(1 row)
```

:::question not-equal example=not-equal
What count comes back?
- [ ] 19 :: The three customers with no email are dropped too, because the comparison is unknown for them.
- [x] 16 :: One customer has that email, so the test is false for them. For the three with no email, `<>` is unknown, and unknown is not true, so they are dropped too. To keep them, add `OR email IS NULL`.
- [ ] 20 :: The customer with that email does not pass, and neither do the three with no email.
:::

## Find customers with no email {modification}

The starter returns no rows at all. Change the test.

@task nulls-no-email

## Show a contact for every customer {independent}

Work from the prompt. Every customer must appear.

@task nulls-contact
