WITH spending AS (
    SELECT o.customer_id, sum(i.quantity * i.unit_price) AS spent
    FROM orders AS o
    JOIN order_items AS i ON i.order_id = o.id
    WHERE o.status <> 'cancelled'
    GROUP BY o.customer_id
),
totals AS (
    SELECT c.first_name, COALESCE(s.spent, 0) AS spent
    FROM customers AS c
    LEFT JOIN spending AS s ON s.customer_id = c.id
)
SELECT first_name, spent,
       CASE WHEN spent >= 1000 THEN 'silver'
            WHEN spent >= 5000 THEN 'gold'
            ELSE 'bronze'
       END AS tier
FROM totals
ORDER BY spent DESC, first_name;
