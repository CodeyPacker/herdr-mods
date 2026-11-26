SELECT status, count(*) AS orders
FROM orders
GROUP BY status
ORDER BY orders DESC;
