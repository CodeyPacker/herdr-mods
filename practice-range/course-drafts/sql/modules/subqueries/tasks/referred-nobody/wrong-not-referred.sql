SELECT first_name
FROM customers
WHERE referred_by IS NULL
ORDER BY first_name;
