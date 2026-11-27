---
id: course:sql-foundations/module/grouping
title: Summarize by group
requires: ["aggregate","count-forms","order","filter","is-null","alias"]
outcomes: [{"id":"group","can":"Produce one summary row per group.","assessment":["group-count","course:sql-foundations/task/grouping-per-country"]},{"id":"having","can":"Filter rows before grouping and groups after it.","assessment":["having","course:sql-foundations/task/grouping-busy-categories"]},{"id":"placement","can":"Read the error from an aggregate in WHERE.","assessment":["bad-where"]},{"id":"transfer","can":"Group, filter the groups and sort by the summary.","assessment":["course:sql-foundations/task/grouping-status-counts"]}]
tasks: [{"id":"course:sql-foundations/task/grouping-per-country","path":"tasks/per-country/task.json"},{"id":"course:sql-foundations/task/grouping-busy-categories","path":"tasks/busy-categories/task.json"},{"id":"course:sql-foundations/task/grouping-status-counts","path":"tasks/status-counts/task.json"}]
review: {"task":"course:sql-foundations/task/grouping-status-counts","afterModule":"course:sql-foundations/module/ctes","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["grouping/count-per-country","grouping/sum-per-category","grouping/having-count","grouping/where-then-group","grouping/order-by-aggregate"]
drillGap: These drills practise one grouping feature each. They do not place one test in WHERE and another in HAVING.
---

One total for the whole table is rarely enough. Reports want a total for each country, each department, each status. GROUP BY produces one summary row per group, and HAVING chooses which groups to keep.

## One row per group

GROUP BY country sorts the rows into groups that share a country, then returns one row for each group. The SELECT list of a grouped query can hold two kinds of thing: the columns you grouped by, and aggregates. Each aggregate is worked out separately for every group. A plain column that is not in the GROUP BY is an error, for the same reason as in the last module: a group has many values of it.

```sql example countries
SELECT country, count(*) AS customers
FROM customers
GROUP BY country
ORDER BY customers DESC, country;

```

```output
Your query returned:
 country   | customers
-----------+-----------
 USA       | 7
 Canada    | 3
 UK        | 3
 Germany   | 2
 Australia | 1
 France    | 1
 Ireland   | 1
 Italy     | 1
 Spain     | 1
(9 rows)
```

## Count the groups {prediction}

Twenty customers live in nine countries. Predict how many rows come back.

@example countries

:::question group-count example=countries
How many rows come back?
- [ ] 20 :: GROUP BY returns one row per group, not one per customer.
- [x] 9 :: There is one row for each country.
- [ ] 1 :: Without GROUP BY the count would be one row. With it, each country gets its own.
:::

## Follow the groups {walkthrough}

There is one row per country, so nine rows. count(*) is counted inside each group: 7 customers in the USA, 3 in Canada, and so on. ORDER BY runs last and can sort by an aggregate or by its alias. Here it puts the largest group first and breaks ties by country name.

@example countries

## WHERE before, HAVING after

A grouped query can filter at two points. WHERE filters rows before they are grouped, so it cannot use aggregates. HAVING filters the groups after the aggregates are worked out, so it can. The clauses are written in this order: SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY.

```sql example having
SELECT department_id, count(*) AS staff, ROUND(avg(salary)) AS avg_salary
FROM employees
GROUP BY department_id
HAVING count(*) >= 4
ORDER BY department_id;

```

```output
Your query returned:
 department_id | staff | avg_salary
---------------+-------+------------
 2             | 11    | 143955
 3             | 4     | 118250
 5             | 4     | 64375
(3 rows)
```

## Keep the large groups {prediction}

Departments have 1, 11, 4, 3 and 4 employees, and one employee has no department. Predict which department_id values appear.

@example having

:::question having example=having
Which department_id values appear?
- [x] 2, 3 and 5 :: Those departments have 11, 4 and 4 employees. HAVING keeps groups of four or more.
- [ ] 2 only :: The test is count(*) >= 4, and two departments have exactly 4.
- [ ] 1, 2, 3, 4 and 5 :: HAVING removes the groups with fewer than four employees.
:::

## Follow the HAVING {walkthrough}

The rows are grouped by department_id, and count(*) and the average salary are worked out for each group. HAVING then keeps the groups with at least four rows: departments 2, 3 and 5. The group of one employee with a NULL department_id exists too, and is dropped with the other small groups.

@example having

## An aggregate in WHERE {prediction}

This query tries to keep the large groups with WHERE. Read it before checking.

```sql example bad-where diagnostics=[{"code":"42803","line":3}]
SELECT country, count(*)
FROM customers
WHERE count(*) > 2
GROUP BY country;

```

:::question bad-where example=bad-where
What happens when you check this example?
- [ ] It returns the countries with more than two customers. :: WHERE cannot use count(*). The statement fails.
- [ ] It returns every country. :: The statement does not run. An aggregate in WHERE is an error.
- [x] PostgreSQL reports an error on line 3. :: WHERE runs before grouping, so it cannot use an aggregate (42803). The test belongs in HAVING.
:::

## Read the error {walkthrough}

Check the example. Error 42803 says aggregate functions are not allowed in WHERE. WHERE runs before the groups exist, so there is nothing to count yet. Move the test to HAVING, after GROUP BY.

@example bad-where

## Count customers per country {modification}

The starter groups by too much, so it returns one row per city.

@task grouping-per-country

## Find the well-stocked categories {independent}

Work from the prompt. One test belongs in WHERE and one in HAVING.

@task grouping-busy-categories
