SELECT count(*) AS customers, count(*) FILTER (WHERE email IS NOT NULL) AS with_email FROM customers;
