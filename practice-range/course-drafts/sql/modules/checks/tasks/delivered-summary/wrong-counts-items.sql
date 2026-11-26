SELECT count(*) AS orders, sum(i.quantity * i.unit_price) AS revenue
FROM orders AS o
JOIN order_items AS i ON i.order_id = o.id
WHERE o.status = 'delivered';
