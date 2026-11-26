SELECT DISTINCT c.first_name, c.last_name
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.id
ORDER BY c.first_name;
