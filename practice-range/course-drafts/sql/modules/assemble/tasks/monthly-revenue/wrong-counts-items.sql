SELECT EXTRACT(MONTH FROM o.ordered_at) AS month,
       count(*) AS orders,
       sum(i.quantity * i.unit_price) AS revenue
FROM orders AS o
JOIN order_items AS i ON i.order_id = o.id
WHERE o.status <> 'cancelled'
GROUP BY EXTRACT(MONTH FROM o.ordered_at)
ORDER BY month;
