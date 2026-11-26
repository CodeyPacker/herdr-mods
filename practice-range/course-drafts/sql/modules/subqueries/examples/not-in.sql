SELECT count(*) AS referred_nobody
FROM customers
WHERE id NOT IN (SELECT referred_by FROM customers);
