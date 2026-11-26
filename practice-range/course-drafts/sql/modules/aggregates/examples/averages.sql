SELECT count(bonus_pct) AS with_bonus,
       ROUND(avg(bonus_pct), 2) AS avg_bonus,
       ROUND(avg(COALESCE(bonus_pct, 0)), 2) AS avg_all
FROM employees;
