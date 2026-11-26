SELECT c.name AS category,
       count(DISTINCT p.id) AS products,
       COALESCE(sum(i.quantity), 0) AS units
FROM categories AS c
JOIN products AS p ON p.category_id = c.id
LEFT JOIN order_items AS i ON i.product_id = p.id
GROUP BY c.name
ORDER BY units DESC, c.name;
