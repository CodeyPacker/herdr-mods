SELECT status, count(*) AS orders
FROM orders
GROUP BY status
HAVING count(*) > 10
ORDER BY orders DESC;
