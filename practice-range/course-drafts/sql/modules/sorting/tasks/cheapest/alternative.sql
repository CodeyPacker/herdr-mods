SELECT name, price FROM products WHERE NOT discontinued ORDER BY price ASC FETCH FIRST 5 ROWS ONLY;
