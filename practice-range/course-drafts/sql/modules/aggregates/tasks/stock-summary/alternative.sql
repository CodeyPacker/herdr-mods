SELECT count(id) AS products, sum(stock) AS units, ROUND(sum(price) / count(*), 2) AS average_price
FROM products WHERE NOT discontinued;
