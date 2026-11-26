SELECT id, shipped_at - ordered_at AS days
FROM orders
WHERE EXTRACT(MONTH FROM ordered_at) = 3 AND shipped_at IS NOT NULL
ORDER BY id;
