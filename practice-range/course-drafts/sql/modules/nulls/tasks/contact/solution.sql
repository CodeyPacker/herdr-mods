SELECT first_name, COALESCE(email, 'no email') AS contact
FROM customers;
