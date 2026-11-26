SELECT first_name, bonus_pct
FROM employees
ORDER BY bonus_pct DESC NULLS LAST, first_name
LIMIT 3;
