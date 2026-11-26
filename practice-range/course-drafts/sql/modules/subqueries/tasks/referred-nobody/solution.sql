SELECT c.first_name
FROM customers AS c
WHERE NOT EXISTS (SELECT 1 FROM customers AS r WHERE r.referred_by = c.id)
ORDER BY c.first_name;
