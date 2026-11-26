SELECT name, price
FROM products
WHERE stock > 0 OR discontinued = false;
