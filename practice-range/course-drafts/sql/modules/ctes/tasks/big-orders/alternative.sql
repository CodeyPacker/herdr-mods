SELECT order_id, sum(unit_price * quantity) AS total
FROM order_items
GROUP BY order_id
HAVING sum(unit_price * quantity) > 4000
ORDER BY total DESC;
