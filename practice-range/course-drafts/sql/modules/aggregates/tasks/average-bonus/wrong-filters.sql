SELECT ROUND(avg(COALESCE(bonus_pct, 0)), 2) AS avg_bonus
FROM employees
WHERE bonus_pct IS NOT NULL;
