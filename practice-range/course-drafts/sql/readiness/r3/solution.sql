SELECT p.name, p.price,
       CASE WHEN p.price >= 500 THEN 'high' ELSE 'standard' END AS band
FROM products AS p
WHERE p.price > (SELECT avg(x.price) FROM products AS x WHERE x.category_id = p.category_id)
ORDER BY p.name;
