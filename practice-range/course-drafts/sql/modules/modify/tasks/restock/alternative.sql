UPDATE products SET stock = stock + 20 WHERE NOT discontinued AND stock < 1;
