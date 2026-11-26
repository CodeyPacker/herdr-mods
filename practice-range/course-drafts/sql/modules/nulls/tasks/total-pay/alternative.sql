SELECT first_name, COALESCE(salary + salary * bonus_pct / 100, salary) AS total_pay FROM employees;
