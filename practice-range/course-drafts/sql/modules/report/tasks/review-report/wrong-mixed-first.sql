WITH review_stats AS (
    SELECT product_id, count(*) AS reviews, ROUND(avg(rating), 2) AS avg_rating
    FROM reviews
    GROUP BY product_id
    HAVING count(*) >= 2
),
sales AS (
    SELECT product_id, sum(quantity) AS units_sold
    FROM order_items
    GROUP BY product_id
)
SELECT p.name, r.reviews, r.avg_rating,
       COALESCE(s.units_sold, 0) AS units_sold,
       CASE WHEN r.avg_rating >= 3 THEN 'mixed' WHEN r.avg_rating >= 4.5 THEN 'loved' ELSE 'poor' END AS verdict
FROM review_stats AS r
JOIN products AS p ON p.id = r.product_id
LEFT JOIN sales AS s ON s.product_id = p.id
ORDER BY r.avg_rating DESC, p.name;
