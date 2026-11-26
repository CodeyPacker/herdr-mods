WITH totals AS (
    SELECT product_id, sum(quantity) AS units, count(order_id) AS lines
    FROM order_items
    GROUP BY product_id
)
SELECT product_id, units, lines FROM totals WHERE units > 15 ORDER BY units DESC, product_id;
