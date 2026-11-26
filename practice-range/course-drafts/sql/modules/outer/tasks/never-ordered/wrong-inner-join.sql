SELECT c.first_name, c.last_name
FROM customers AS c
JOIN orders AS o ON o.customer_id = c.id
WHERE o.id IS NULL
ORDER BY c.first_name;
