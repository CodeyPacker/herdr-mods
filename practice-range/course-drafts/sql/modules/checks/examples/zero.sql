SELECT c.first_name, count(o.id) AS orders, count(*) AS joined_rows
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.id
WHERE c.id >= 16
GROUP BY c.first_name
ORDER BY c.first_name;
