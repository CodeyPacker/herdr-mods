SELECT first_name, last_name
FROM customers
WHERE id IN (SELECT customer_id FROM orders WHERE status = 'cancelled')
ORDER BY first_name;
