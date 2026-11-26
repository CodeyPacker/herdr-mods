SELECT count(*) AS customers, count(DISTINCT id) AS with_email
FROM customers;
