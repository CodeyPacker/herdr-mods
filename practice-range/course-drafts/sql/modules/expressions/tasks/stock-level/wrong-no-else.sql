SELECT name, stock,
       CASE WHEN stock = 0 THEN 'out'
            WHEN stock < 10 THEN 'low'
       END AS level
FROM products;
