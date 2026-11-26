SELECT count(*) AS products, sum(stock) AS units, ROUND(avg(price), 2) AS average_price
FROM products;
