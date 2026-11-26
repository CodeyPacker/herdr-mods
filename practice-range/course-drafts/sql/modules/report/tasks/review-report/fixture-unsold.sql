-- This case adds two reviews for a product that has never been ordered.
INSERT INTO reviews (id, product_id, customer_id, rating, body, reviewed_on)
VALUES (101, 15, 3, 5, 'Simple and sturdy.', '2025-06-01'),
       (102, 15, 5, 4, NULL, '2025-06-09');
