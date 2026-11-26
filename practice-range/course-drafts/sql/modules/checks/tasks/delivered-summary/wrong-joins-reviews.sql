SELECT count(DISTINCT o.id) AS orders, sum(i.quantity * i.unit_price) AS revenue
FROM orders AS o
JOIN order_items AS i ON i.order_id = o.id
JOIN reviews AS r ON r.customer_id = o.customer_id
WHERE o.status = 'delivered';
