SELECT name, RANK() OVER (ORDER BY price DESC) AS position
FROM products
WHERE position <= 3;
