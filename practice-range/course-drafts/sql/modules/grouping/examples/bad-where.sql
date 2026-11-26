SELECT country, count(*)
FROM customers
WHERE count(*) > 2
GROUP BY country;
