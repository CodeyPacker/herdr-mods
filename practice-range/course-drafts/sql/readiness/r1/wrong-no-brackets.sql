SELECT first_name, city, COALESCE(email, 'none') AS contact
FROM customers
WHERE country = 'USA' OR country = 'Canada'
  AND signup_date BETWEEN '2024-01-01' AND '2024-12-31'
ORDER BY signup_date DESC;
