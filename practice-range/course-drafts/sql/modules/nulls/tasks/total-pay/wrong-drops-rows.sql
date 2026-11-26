SELECT first_name, salary + salary * bonus_pct / 100 AS total_pay
FROM employees
WHERE bonus_pct IS NOT NULL;
