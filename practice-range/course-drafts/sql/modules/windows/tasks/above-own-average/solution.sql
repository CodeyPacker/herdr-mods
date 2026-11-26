WITH compared AS (
    SELECT first_name, salary,
           avg(salary) OVER (PARTITION BY department_id) AS department_avg
    FROM employees
    WHERE department_id IS NOT NULL
)
SELECT first_name, salary, ROUND(department_avg) AS department_avg
FROM compared
WHERE salary > department_avg
ORDER BY first_name;
