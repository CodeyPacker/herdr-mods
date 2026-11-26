WITH spending AS (
    SELECT o.customer_id, sum(i.quantity * i.unit_price) AS spent
    FROM orders AS o
    JOIN order_items AS i ON i.order_id = o.id
    WHERE o.status <> 'cancelled'
    GROUP BY o.customer_id
)
SELECT c.first_name, s.spent,
       CASE WHEN s.spent >= 5000 THEN 'gold' WHEN s.spent >= 1000 THEN 'silver' ELSE 'bronze' END AS tier
FROM customers AS c
JOIN spending AS s ON s.customer_id = c.id
ORDER BY s.spent DESC, c.first_name;
