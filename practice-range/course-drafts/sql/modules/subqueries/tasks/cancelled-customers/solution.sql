SELECT c.first_name, c.last_name
FROM customers AS c
WHERE EXISTS (
    SELECT 1 FROM orders AS o
    WHERE o.customer_id = c.id AND o.status = 'cancelled'
)
ORDER BY c.first_name;
