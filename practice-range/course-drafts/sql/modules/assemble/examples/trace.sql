WITH order_counts AS (
    SELECT customer_id, count(*) AS orders
    FROM orders
    GROUP BY customer_id
)
SELECT c.first_name, COALESCE(oc.orders, 0) AS orders
FROM customers AS c
LEFT JOIN order_counts AS oc ON oc.customer_id = c.id
WHERE c.id >= 16
ORDER BY c.first_name;
