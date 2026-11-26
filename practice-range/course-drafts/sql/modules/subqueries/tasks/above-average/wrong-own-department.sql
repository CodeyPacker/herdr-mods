SELECT first_name, salary
FROM employees AS e
WHERE salary > (SELECT avg(salary) FROM employees AS d WHERE d.department_id = e.department_id)
ORDER BY salary DESC;
