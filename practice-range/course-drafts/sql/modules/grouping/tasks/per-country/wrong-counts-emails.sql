SELECT country, count(email) AS customers
FROM customers
GROUP BY country
ORDER BY customers DESC, country;
