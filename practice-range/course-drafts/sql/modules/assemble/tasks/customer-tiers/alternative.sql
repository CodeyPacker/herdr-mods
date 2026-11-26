SELECT c.first_name,
       COALESCE(sum(i.quantity * i.unit_price), 0) AS spent,
       CASE WHEN COALESCE(sum(i.quantity * i.unit_price), 0) < 1000 THEN 'bronze'
            WHEN sum(i.quantity * i.unit_price) < 5000 THEN 'silver'
            ELSE 'gold'
       END AS tier
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.id AND o.status <> 'cancelled'
LEFT JOIN order_items AS i ON i.order_id = o.id
GROUP BY c.id, c.first_name
ORDER BY spent DESC, c.first_name;
