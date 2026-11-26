WITH averages AS (
    SELECT category_id, avg(price) AS average
    FROM products
    WHERE category_id IS NOT NULL
    GROUP BY category_id
)
SELECT p.name, p.price,
       CASE WHEN p.price < 500 THEN 'standard' ELSE 'high' END AS band
FROM products AS p
JOIN averages AS a ON a.category_id = p.category_id
WHERE p.price > a.average
ORDER BY p.name;
