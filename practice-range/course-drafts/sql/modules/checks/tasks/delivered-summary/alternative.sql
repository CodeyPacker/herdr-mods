SELECT (SELECT count(*) FROM orders WHERE status = 'delivered') AS orders,
       (SELECT sum(i.quantity * i.unit_price)
        FROM order_items AS i
        WHERE i.order_id IN (SELECT id FROM orders WHERE status = 'delivered')) AS revenue;
