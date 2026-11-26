SELECT product_id, sum(quantity) AS units, count(*) AS lines
FROM order_items
GROUP BY product_id
HAVING count(*) >= 16
ORDER BY units DESC, product_id;
