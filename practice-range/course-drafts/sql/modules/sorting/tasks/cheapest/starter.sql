SELECT name, price
FROM products
WHERE discontinued = false
ORDER BY price DESC
LIMIT 5;
