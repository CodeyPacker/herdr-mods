DELETE FROM order_items AS i
USING orders AS o
WHERE o.id = i.order_id AND o.status = 'cancelled';
