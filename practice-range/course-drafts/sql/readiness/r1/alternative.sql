SELECT first_name, city, CASE WHEN email IS NULL THEN 'none' ELSE email END AS contact
FROM customers
WHERE (country = 'USA' OR country = 'Canada')
  AND signup_date >= '2024-01-01' AND signup_date < '2025-01-01'
ORDER BY signup_date DESC;
