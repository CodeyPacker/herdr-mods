SELECT category_id, count(category_id) AS products, ROUND(sum(price) / count(*), 2) AS avg_price
FROM products WHERE NOT discontinued
GROUP BY category_id HAVING count(category_id) > 2 ORDER BY category_id;
