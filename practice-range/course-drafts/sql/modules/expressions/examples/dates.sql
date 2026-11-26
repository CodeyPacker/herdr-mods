SELECT id, ordered_at,
       EXTRACT(MONTH FROM ordered_at) AS month,
       CAST(shipped_at AS date) - CAST(ordered_at AS date) AS days_to_ship
FROM orders
WHERE id <= 3;
