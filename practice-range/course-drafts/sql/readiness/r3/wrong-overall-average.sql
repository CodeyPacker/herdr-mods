SELECT p.name, p.price,
       CASE WHEN p.price >= 500 THEN 'high' ELSE 'standard' END AS band
FROM products AS p
WHERE p.price > (SELECT avg(price) FROM products)
ORDER BY p.name;
