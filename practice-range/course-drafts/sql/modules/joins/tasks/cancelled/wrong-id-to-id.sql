SELECT c.first_name, o.id AS order_id, o.status
FROM orders AS o
JOIN customers AS c ON c.id = o.id
WHERE o.status = 'cancelled'
ORDER BY o.id;
