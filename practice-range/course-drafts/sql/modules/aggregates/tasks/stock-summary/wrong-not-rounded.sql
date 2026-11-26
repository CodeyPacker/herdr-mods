SELECT count(*) AS products, sum(stock) AS units, avg(price) AS average_price
FROM products
WHERE discontinued = false;
