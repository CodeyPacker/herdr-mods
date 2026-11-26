SELECT id, CAST(shipped_at AS date) - CAST(ordered_at AS date) AS days
FROM orders
WHERE EXTRACT(MONTH FROM ordered_at) = 3
ORDER BY id;
