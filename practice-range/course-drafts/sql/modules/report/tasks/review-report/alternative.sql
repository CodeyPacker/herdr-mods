SELECT p.name,
       count(r.id) AS reviews,
       ROUND(avg(r.rating), 2) AS avg_rating,
       COALESCE((SELECT sum(i.quantity) FROM order_items AS i WHERE i.product_id = p.id), 0) AS units_sold,
       CASE WHEN ROUND(avg(r.rating), 2) < 3 THEN 'poor'
            WHEN ROUND(avg(r.rating), 2) < 4.5 THEN 'mixed'
            ELSE 'loved'
       END AS verdict
FROM products AS p
JOIN reviews AS r ON r.product_id = p.id
GROUP BY p.id, p.name
HAVING count(r.id) >= 2
ORDER BY avg_rating DESC, p.name;
