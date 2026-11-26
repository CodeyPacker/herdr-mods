SELECT first_name, bonus_pct,
       ROUND(salary * bonus_pct / 100) AS bonus,
       COALESCE(bonus_pct, 0) AS pct
FROM employees
WHERE department_id = 5;
