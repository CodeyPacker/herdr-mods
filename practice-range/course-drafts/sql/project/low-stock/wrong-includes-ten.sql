SELECT name, stock
FROM products
WHERE discontinued = false AND stock <= 10
ORDER BY stock, name;
