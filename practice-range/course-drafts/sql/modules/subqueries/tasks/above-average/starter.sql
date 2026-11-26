SELECT first_name, salary
FROM employees
WHERE salary > avg(salary)
ORDER BY salary DESC;
