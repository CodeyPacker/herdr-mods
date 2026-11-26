SELECT first_name, COALESCE(NULLIF(email, ''), 'no email') AS contact
FROM customers;
