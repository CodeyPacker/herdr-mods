SELECT first_name, salary,
       ROUND(avg(salary) OVER (PARTITION BY department_id)) AS department_avg,
       salary - ROUND(avg(salary) OVER (PARTITION BY department_id)) AS difference
FROM employees
WHERE department_id = 5
ORDER BY salary DESC;
