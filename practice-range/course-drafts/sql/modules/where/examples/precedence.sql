SELECT first_name, department_id, salary
FROM employees
WHERE department_id = 5 OR department_id = 4 AND salary > 90000;
