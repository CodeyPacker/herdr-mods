UPDATE products
SET stock = 20
WHERE stock < 20 AND discontinued = false;
