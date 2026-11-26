SELECT first_name, email AS contact
FROM customers
WHERE email IS NOT NULL;
