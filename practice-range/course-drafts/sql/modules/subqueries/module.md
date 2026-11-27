---
id: course:sql-foundations/module/subqueries
title: Use a query inside a query
requires: ["join","aggregate","filter","order","null","is-null"]
outcomes: [{"id":"scalar","can":"Compare each row with a value computed by a subquery.","assessment":["above","course:sql-foundations/task/subqueries-above-average"]},{"id":"exists","can":"Test whether related rows exist.","assessment":["exists","course:sql-foundations/task/subqueries-cancelled-customers"]},{"id":"transfer","can":"Avoid the trap of NOT IN with a NULL in the list.","assessment":["not-in","course:sql-foundations/task/subqueries-referred-nobody"]}]
tasks: [{"id":"course:sql-foundations/task/subqueries-above-average","path":"tasks/above-average/task.json"},{"id":"course:sql-foundations/task/subqueries-cancelled-customers","path":"tasks/cancelled-customers/task.json"},{"id":"course:sql-foundations/task/subqueries-referred-nobody","path":"tasks/referred-nobody/task.json"}]
review: {"task":"course:sql-foundations/task/subqueries-referred-nobody","afterModule":"course:sql-foundations/module/modify","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["subqueries/above-average","subqueries/in-subquery","subqueries/exists","subqueries/not-exists","subqueries/not-in-subquery"]
drillGap: These drills practise one subquery form each. They do not show NOT IN failing on a NULL.
---

Some questions need an answer before they can be asked: which products cost more than the average? The average has to be worked out first. A subquery is a query inside another query, and it supplies that first answer.

## A query inside a query

A subquery is a SELECT in brackets, used where a value is expected. PostgreSQL runs it and uses its result. A subquery that returns one row with one column acts as a single value, so price > (SELECT avg(price) FROM products) compares each price with the average. This is the way to use an aggregate in a filter, which WHERE alone cannot do.

```sql example above
SELECT name, price
FROM products
WHERE price > (SELECT avg(price) FROM products)
ORDER BY price DESC;

```

```output
Your query returned:
 name             | price
------------------+---------
 Forge 16 Laptop  | 1649.00
 Aero 13 Laptop   | 1199.00
 Scout 14 Laptop  | 749.00
 Standing Desk    | 549.00
 Espresso Machine | 499.00
 27in Monitor     | 329.00
 Office Chair     | 289.00
(7 rows)
```

## Compare with the average {prediction}

The average product price is 269.67. The Office Chair costs 289.00 and the Soundbar 249.00. Predict the last row.

@example above

:::question above example=above
What is the last row?
- [ ] Soundbar, 249.00 :: 249.00 is below the average of 269.67, so it is not kept.
- [x] Office Chair, 289.00 :: It is the lowest price above the average, and the rows are sorted from the highest price down.
- [ ] Forge 16 Laptop, 1649.00 :: That is the first row. The sort is from the highest price down.
:::

## Two steps in one statement {walkthrough}

The subquery runs first and gives one number, about 269.67. The outer query then keeps the products whose price is above it. Seven pass, and the cheapest of them, the Office Chair, is the last row. If prices change, the average is recomputed on every run, which a number typed into the query would not be.

@example above

## Lists and existence

A subquery can also return a column of values for IN: id IN (SELECT customer_id FROM orders). EXISTS asks a different question. It is true when its subquery returns at least one row, whatever that row holds. The subquery usually refers to the outer row, as in WHERE o.customer_id = c.id, and is then checked once for each outer row. That is called a correlated subquery. Unlike a join, EXISTS never repeats the outer row: a customer with three cancelled orders still appears once.

```sql example exists
SELECT c.first_name
FROM customers AS c
WHERE EXISTS (
    SELECT 1
    FROM orders AS o
    WHERE o.customer_id = c.id AND o.status = 'cancelled'
)
ORDER BY c.first_name;

```

```output
Your query returned:
 first_name
------------
 Ava
 Ethan
 Grace
 Isla
 Jack
 Noah
 Sofia
(7 rows)
```

## Customers with a cancelled order {prediction}

Ten orders were cancelled, and Ava cancelled three of them. Predict how many times Ava appears.

@example exists

:::question exists example=exists
How many times does Ava appear?
- [x] Once :: EXISTS is true or false for each customer. It never repeats the outer row.
- [ ] Three times :: A join would repeat her. EXISTS only asks whether at least one such order exists.
- [ ] Not at all :: She has cancelled orders, so EXISTS is true for her row.
:::

## NOT IN and NULL

NOT IN has a trap. If the list contains a NULL, the test is never true for any row. The reason is the one from the NULL module: id NOT IN (2, NULL) asks whether id differs from every item, and comparing with NULL is unknown. referred_by is NULL for many customers, so a NOT IN over that column returns nothing. NOT EXISTS does not have this problem, and is the safer way to ask for rows with no related row.

```sql example not-in
SELECT count(*) AS referred_nobody
FROM customers
WHERE id NOT IN (SELECT referred_by FROM customers);

```

```output
Your query returned:
 referred_nobody
-----------------
 0
(1 row)
```

## Count with NOT IN {prediction}

Ten customers have referred somebody. Predict how many of the twenty customers this query counts.

@example not-in

:::question not-in example=not-in
What count comes back?
- [ ] 10 :: That is the answer NOT EXISTS gives. Here the list contains NULL.
- [ ] 20 :: The customers who did refer somebody are in the list and do not pass.
- [x] 0 :: The list contains NULL, so NOT IN is never true and no row is counted.
:::

## Find the salaries above average {modification}

The starter puts an aggregate in WHERE, which is an error. Supply the average another way.

@task subqueries-above-average

## Find customers who cancelled {independent}

Work from the prompt. Each customer must appear once.

@task subqueries-cancelled-customers
