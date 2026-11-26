SELECT first_name
FROM customers
WHERE id NOT IN (SELECT referred_by FROM customers WHERE referred_by IS NOT NULL)
ORDER BY first_name;
