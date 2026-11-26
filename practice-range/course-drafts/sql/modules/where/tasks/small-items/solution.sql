SELECT name, price
FROM products
WHERE category_id IN (4, 8) AND price <= 50;
