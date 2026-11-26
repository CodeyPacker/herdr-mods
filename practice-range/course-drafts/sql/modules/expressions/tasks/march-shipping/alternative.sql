SELECT id, shipped_at::date - ordered_at::date AS days
FROM orders
WHERE ordered_at >= '2025-03-01' AND ordered_at < '2025-04-01' AND shipped_at IS NOT NULL
ORDER BY id;
