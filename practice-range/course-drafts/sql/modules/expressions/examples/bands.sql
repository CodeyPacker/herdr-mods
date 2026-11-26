SELECT name, price,
       CASE WHEN price >= 500 THEN 'premium'
            WHEN price >= 100 THEN 'mid'
            ELSE 'budget'
       END AS band
FROM products
WHERE category_id IN (3, 9)
ORDER BY price DESC;
