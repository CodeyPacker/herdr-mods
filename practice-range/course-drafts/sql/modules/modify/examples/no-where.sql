UPDATE products
SET discontinued = true;

SELECT count(*) AS discontinued
FROM products
WHERE discontinued;
