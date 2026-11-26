SELECT p.name,
       count(r.id) AS reviews,
       ROUND(avg(r.rating), 2) AS avg_rating,
       COALESCE(sum(i.quantity), 0) AS units_sold,
       CASE WHEN avg(r.rating) >= 4.5 THEN 'loved' WHEN avg(r.rating) >= 3 THEN 'mixed' ELSE 'poor' END AS verdict
FROM products AS p
JOIN reviews AS r ON r.product_id = p.id
LEFT JOIN order_items AS i ON i.product_id = p.id
GROUP BY p.id, p.name
HAVING count(r.id) >= 2
ORDER BY avg_rating DESC, p.name;
