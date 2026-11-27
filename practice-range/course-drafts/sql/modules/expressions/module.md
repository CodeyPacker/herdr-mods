---
id: course:sql-foundations/module/expressions
title: Compute new values
requires: ["filter","null","is-null","coalesce","alias","expression","order","logic"]
outcomes: [{"id":"case","can":"Label rows with CASE and order its tests correctly.","assessment":["band","course:sql-foundations/task/expressions-stock-level"]},{"id":"divide","can":"Predict whole-number division and keep a fraction when one is wanted.","assessment":["division","course:sql-foundations/task/expressions-half-stock"]},{"id":"dates","can":"Take a part of a date and subtract two dates.","assessment":["days","course:sql-foundations/task/expressions-march-shipping"]},{"id":"types","can":"Read the error from text that cannot become a number.","assessment":["bad-number"]}]
tasks: [{"id":"course:sql-foundations/task/expressions-stock-level","path":"tasks/stock-level/task.json"},{"id":"course:sql-foundations/task/expressions-march-shipping","path":"tasks/march-shipping/task.json"},{"id":"course:sql-foundations/task/expressions-half-stock","path":"tasks/half-stock/task.json"}]
review: {"task":"course:sql-foundations/task/expressions-half-stock","afterModule":"course:sql-foundations/module/windows","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["case/searched","case/stock-level","select/cast","dates/extract-year","dates/days-between","dates/cast-date"]
drillGap: These drills practise one expression each. They do not test the order of CASE tests or a value on a boundary.
---

A result often needs values that are not stored anywhere: a label for a price range, a number of days between two dates, a ratio that keeps its fraction. This module covers CASE for choosing a value, converting between types, and working with dates.

## Choose a value with CASE

CASE picks one value out of several. It is written CASE WHEN test THEN value WHEN test THEN value ELSE value END. The tests are tried from the top, and the first one that is true decides the result. Later tests are not looked at, so order matters: put the most specific test first. ELSE covers everything that matched no test. Without ELSE, such rows get NULL. A CASE is an expression, so it can sit in the SELECT list and be given a name with AS.

```sql example bands
SELECT name, price,
       CASE WHEN price >= 500 THEN 'premium'
            WHEN price >= 100 THEN 'mid'
            ELSE 'budget'
       END AS band
FROM products
WHERE category_id IN (3, 9)
ORDER BY price DESC;

```

```output
Your query returned:
 name            | price   | band
-----------------+---------+---------
 Forge 16 Laptop | 1649.00 | premium
 Aero 13 Laptop  | 1199.00 | premium
 Scout 14 Laptop | 749.00  | premium
 Standing Desk   | 549.00  | premium
 Office Chair    | 289.00  | mid
 Bookshelf       | 120.00  | mid
(6 rows)
```

## Follow the tests in order {prediction}

The Standing Desk costs 549.00 and passes both tests. Predict its band.

@example bands

:::question band example=bands
Which band does the Standing Desk get?
- [x] premium :: The first test, price >= 500, is true for 549.00, and the first true test decides.
- [ ] mid :: The first test is already true, so the second is never reached.
- [ ] budget :: ELSE is used only when no test is true.
:::

## The first true test wins {walkthrough}

549.00 is at least 500, so the first test is true and the band is premium. The second test, at least 100, is also true for it, but it is never reached. The Office Chair at 289.00 fails the first test and passes the second, so it is mid. If the two tests were written the other way round, everything from 100 up would be mid.

@example bands

## Types and division

Every value has a type, and the type decides what an operation does. Dividing one integer by another gives an integer, and the fraction is dropped: 7 / 2 is 3. If either side has a decimal point, the result keeps its fraction: 7 / 2.0 is 3.5. CAST(value AS type) converts a value, for example CAST(stock AS numeric) or CAST('42' AS integer). A conversion that makes no sense is an error.

```sql example division
SELECT 7 / 2 AS whole,
       7 / 2.0 AS exact,
       CAST('42' AS integer) + 1 AS number;

```

```output
Your query returned:
 whole | exact              | number
-------+--------------------+--------
 3     | 3.5000000000000000 | 43
(1 row)
```

## Divide two integers {prediction}

Predict the first two columns.

@example division

:::question division example=division
What are whole and exact?
- [ ] 3.5 and 3.5 :: 7 / 2 divides two integers, so the fraction is dropped.
- [x] 3 and 3.5 :: Two integers give an integer. A decimal point on one side keeps the fraction.
- [ ] 4 and 3.5 :: Integer division drops the fraction. It does not round up.
:::

## Dates

A timestamp such as 2025-01-02 17:16:00 holds a date and a time. CAST(ordered_at AS date) keeps the date and drops the time. EXTRACT(MONTH FROM ordered_at) returns one part of it as a number, and YEAR and DAY work the same way. Subtracting one date from another gives a whole number of days. Subtracting two timestamps gives an interval instead, such as 3 days 18:29:00, so cast to date first when you want days.

```sql example dates
SELECT id, ordered_at,
       EXTRACT(MONTH FROM ordered_at) AS month,
       CAST(shipped_at AS date) - CAST(ordered_at AS date) AS days_to_ship
FROM orders
WHERE id <= 3;

```

```output
Your query returned:
 id | ordered_at          | month | days_to_ship
----+---------------------+-------+--------------
 1  | 2025-01-02 17:16:00 | 1     | 4
 2  | 2025-01-07 07:01:00 | 1     | 2
 3  | 2025-01-13 08:36:00 | 1     | 3
(3 rows)
```

## Count the days {prediction}

Order 1 was placed on 2 January at 17:16 and shipped on 6 January at 11:45. Predict days_to_ship.

@example dates

:::question days example=dates
What is days_to_ship for order 1?
- [ ] 3 :: Both values are cast to date first, so the times of day play no part.
- [ ] 3 days 18:29:00 :: That is what subtracting the two timestamps would give. Here both are cast to date.
- [x] 4 :: 6 January minus 2 January is 4 days.
:::

## Compare a number with a word {prediction}

price is a number. Read the example before checking.

```sql example bad-number diagnostics=[{"code":"22P02","line":3}]
SELECT name
FROM products
WHERE price > 'cheap';

```

:::question bad-number example=bad-number
What happens when you check this example?
- [ ] It returns no rows. :: The comparison cannot be made at all, so the statement fails.
- [x] PostgreSQL reports an error on line 3. :: 'cheap' cannot be turned into a number to compare with price (22P02).
- [ ] It returns every product. :: A failed conversion is an error. It does not count as true.
:::

## Read the error {walkthrough}

Check the example. To compare, PostgreSQL has to turn 'cheap' into a number, and it cannot. Error 22P02 says invalid input syntax for type numeric: "cheap". The same error appears when a CAST is given text that is not a number.

@example bad-number

## Label the stock level {modification}

The starter's tests are in the wrong order, so one label is never used.

@task expressions-stock-level

## Measure shipping time in March {independent}

Work from the prompt. The answer needs a part of a date and a difference between two dates.

@task expressions-march-shipping
