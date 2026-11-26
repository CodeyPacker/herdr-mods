-- This case removes the email of one customer who signed up in 2024.
UPDATE customers SET email = NULL WHERE id = 14;
