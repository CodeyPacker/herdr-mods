SELECT first_name, bonus_pct FROM employees WHERE bonus_pct IS NOT NULL ORDER BY bonus_pct DESC, first_name ASC LIMIT 3;
