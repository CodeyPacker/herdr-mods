WITH order_totals AS (
    SELECT o.id, o.customer_id, sum(i.quantity * i.unit_price) AS total
    FROM orders AS o
    JOIN order_items AS i ON i.order_id = o.id
    GROUP BY o.id, o.customer_id
),
numbered AS (
    SELECT id, customer_id, total,
           ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY total DESC, id) AS position
    FROM order_totals
)
SELECT c.first_name, n.id AS order_id, n.total
FROM numbered AS n
JOIN customers AS c ON c.id = n.customer_id
WHERE n.position = 1
ORDER BY n.total DESC, c.first_name;
