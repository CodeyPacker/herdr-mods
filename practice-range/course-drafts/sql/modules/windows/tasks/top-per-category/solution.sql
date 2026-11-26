WITH numbered AS (
    SELECT category_id, name, price,
           ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY price DESC, name) AS position
    FROM products
    WHERE category_id IS NOT NULL
)
SELECT category_id, name, price
FROM numbered
WHERE position = 1
ORDER BY category_id;
