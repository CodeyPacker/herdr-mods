SELECT country, count(*) AS customers
FROM customers
GROUP BY country, city
ORDER BY customers DESC, country;
