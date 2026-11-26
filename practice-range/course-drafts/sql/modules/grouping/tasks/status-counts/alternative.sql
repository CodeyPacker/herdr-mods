SELECT status, count(id) AS orders FROM orders GROUP BY status HAVING count(id) > 9 ORDER BY 2 DESC;
