SELECT sum(i.quantity * i.unit_price) AS revenue
FROM order_items AS i
JOIN orders AS o ON o.id = i.order_id
WHERE o.status = 'delivered';

SELECT sum(i.quantity * i.unit_price) AS revenue
FROM order_items AS i
JOIN orders AS o ON o.id = i.order_id
JOIN reviews AS r ON r.customer_id = o.customer_id
WHERE o.status = 'delivered';
