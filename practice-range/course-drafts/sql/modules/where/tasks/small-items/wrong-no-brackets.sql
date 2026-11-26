SELECT name, price
FROM products
WHERE category_id = 4 OR category_id = 8 AND price <= 50;
