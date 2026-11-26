SELECT c.first_name, count(*) AS orders
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.id
GROUP BY c.id, c.first_name
ORDER BY orders DESC, c.first_name;
