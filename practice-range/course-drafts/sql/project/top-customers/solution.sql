SELECT c.first_name,
       count(DISTINCT o.id) AS orders,
       sum(i.quantity * i.unit_price) AS spent
FROM customers AS c
JOIN orders AS o ON o.customer_id = c.id
JOIN order_items AS i ON i.order_id = o.id
WHERE o.status <> 'cancelled'
GROUP BY c.id, c.first_name
ORDER BY spent DESC
LIMIT 5;
