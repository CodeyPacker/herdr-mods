SELECT category_id, count(*) AS products, ROUND(avg(price), 2) AS avg_price
FROM products
WHERE category_id IS NOT NULL
GROUP BY category_id
HAVING count(*) >= 3
ORDER BY category_id;
