SELECT first_name, salary + salary * COALESCE(bonus_pct, 0) / 100 AS total_pay
FROM employees;
