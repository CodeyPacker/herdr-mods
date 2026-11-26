SELECT c.first_name,
       (SELECT count(*) FROM orders AS o WHERE o.customer_id = c.id) AS orders
FROM customers AS c
ORDER BY orders DESC, c.first_name;
