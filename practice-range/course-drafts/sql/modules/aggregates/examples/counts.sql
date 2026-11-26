SELECT count(*) AS products,
       count(category_id) AS with_category,
       min(price) AS cheapest,
       max(price) AS dearest
FROM products;
