SELECT name, stock,
       CASE WHEN stock < 10 THEN 'low'
            WHEN stock = 0 THEN 'out'
            ELSE 'ok'
       END AS level
FROM products;
