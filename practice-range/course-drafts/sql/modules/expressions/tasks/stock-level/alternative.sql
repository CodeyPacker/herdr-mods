SELECT name, stock,
       CASE WHEN stock >= 10 THEN 'ok' WHEN stock >= 1 THEN 'low' ELSE 'out' END AS level
FROM products;
