UPDATE products
SET stock = 20
WHERE stock = 0 AND discontinued = false;
