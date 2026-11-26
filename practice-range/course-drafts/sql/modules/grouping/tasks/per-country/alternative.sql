SELECT country, count(id) AS customers FROM customers GROUP BY 1 ORDER BY count(id) DESC, country ASC;
