WITH product_units AS (
    SELECT p.id, p.category_id,
           COALESCE((SELECT sum(i.quantity) FROM order_items AS i WHERE i.product_id = p.id), 0) AS units
    FROM products AS p
)
SELECT c.name AS category, count(*) AS products, sum(pu.units) AS units
FROM product_units AS pu
JOIN categories AS c ON c.id = pu.category_id
GROUP BY c.name
ORDER BY units DESC, category;
