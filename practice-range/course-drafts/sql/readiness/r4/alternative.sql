WITH order_totals AS (
    SELECT o.id, o.customer_id, sum(i.quantity * i.unit_price) AS total
    FROM orders AS o
    JOIN order_items AS i ON i.order_id = o.id
    WHERE o.status <> 'cancelled'
    GROUP BY o.id, o.customer_id
)
SELECT c.first_name, t.id AS order_id, t.total
FROM order_totals AS t
JOIN customers AS c ON c.id = t.customer_id
WHERE NOT EXISTS (
    SELECT 1 FROM order_totals AS other
    WHERE other.customer_id = t.customer_id
      AND (other.total > t.total OR (other.total = t.total AND other.id < t.id))
)
ORDER BY t.total DESC, c.first_name;
