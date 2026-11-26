SELECT first_name, CASE WHEN email IS NULL THEN 'no email' ELSE email END AS contact FROM customers;
