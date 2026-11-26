SELECT count(DISTINCT r.id) AS reviews,
       count(DISTINCT i.order_id) AS item_rows,
       count(*) AS joined_rows
FROM products AS p
JOIN reviews AS r ON r.product_id = p.id
JOIN order_items AS i ON i.product_id = p.id
WHERE p.id = 6;
