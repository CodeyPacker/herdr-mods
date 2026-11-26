SELECT name, CAST(stock / 2 AS numeric) AS half
FROM products
WHERE category_id = 4;
