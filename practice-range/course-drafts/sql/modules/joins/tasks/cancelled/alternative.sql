SELECT customers.first_name, orders.id AS order_id, orders.status
FROM customers
JOIN orders ON orders.customer_id = customers.id AND orders.status = 'cancelled'
ORDER BY order_id;
