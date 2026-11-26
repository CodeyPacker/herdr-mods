SELECT first_name, department_id, salary,
       RANK() OVER (ORDER BY salary DESC) AS overall,
       RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS in_department
FROM employees
WHERE department_id IN (3, 4)
ORDER BY department_id, salary DESC;
