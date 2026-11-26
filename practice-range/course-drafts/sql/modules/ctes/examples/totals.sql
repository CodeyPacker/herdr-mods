WITH order_totals AS (
    SELECT order_id, sum(quantity * unit_price) AS total
    FROM order_items
    GROUP BY order_id
)
SELECT order_id, total
FROM order_totals
WHERE total > 5000
ORDER BY total DESC;
