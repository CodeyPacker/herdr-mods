SELECT first_name, last_name
FROM customers
WHERE id NOT IN (SELECT customer_id FROM orders)
ORDER BY first_name;
