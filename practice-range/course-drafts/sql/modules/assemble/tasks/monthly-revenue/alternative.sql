WITH order_totals AS (
    SELECT order_id, sum(quantity * unit_price) AS total
    FROM order_items
    GROUP BY order_id
)
SELECT CAST(EXTRACT(MONTH FROM o.ordered_at) AS integer) AS month,
       count(*) AS orders,
       sum(t.total) AS revenue
FROM orders AS o
JOIN order_totals AS t ON t.order_id = o.id
WHERE o.status IN ('pending', 'shipped', 'delivered')
GROUP BY 1
ORDER BY 1;
