SELECT first_name, department_id, salary,
       RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS position
FROM employees
WHERE department_id IS NOT NULL
ORDER BY department_id, position;
