SELECT first_name
FROM customers
WHERE id NOT IN (SELECT referred_by FROM customers)
ORDER BY first_name;
