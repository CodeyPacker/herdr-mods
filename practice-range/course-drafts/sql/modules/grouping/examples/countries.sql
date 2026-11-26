SELECT country, count(*) AS customers
FROM customers
GROUP BY country
ORDER BY customers DESC, country;
