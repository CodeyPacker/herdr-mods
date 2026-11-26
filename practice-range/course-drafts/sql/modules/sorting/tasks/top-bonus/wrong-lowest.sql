SELECT first_name, bonus_pct
FROM employees
ORDER BY bonus_pct NULLS LAST, first_name
LIMIT 3;
