WITH order_totals AS (
    SELECT order_id, sum(quantity * unit_price) AS total
    FROM order_items
    GROUP BY order_id
),
customer_totals AS (
    SELECT o.customer_id, count(*) AS orders, sum(t.total) AS spent
    FROM orders AS o
    JOIN order_totals AS t ON t.order_id = o.id
    WHERE o.status <> 'cancelled'
    GROUP BY o.customer_id
)
SELECT c.first_name, ct.orders, ct.spent
FROM customer_totals AS ct
JOIN customers AS c ON c.id = ct.customer_id
ORDER BY ct.spent DESC
LIMIT 5;
