WITH order_counts AS (
    SELECT customer_id, count(*) AS orders
    FROM orders
    WHERE status <> 'cancelled'
    GROUP BY customer_id
)
SELECT c.first_name, oc.orders
FROM order_counts AS oc
JOIN customers AS c ON c.id = oc.customer_id
WHERE oc.orders >= 6
ORDER BY oc.orders DESC, c.first_name;
