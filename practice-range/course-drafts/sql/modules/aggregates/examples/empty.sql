SELECT count(*) AS products, sum(stock) AS units
FROM products
WHERE category_id = 99;
