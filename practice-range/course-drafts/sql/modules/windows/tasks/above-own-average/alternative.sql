WITH averages AS (
    SELECT department_id, avg(salary) AS department_avg
    FROM employees
    GROUP BY department_id
)
SELECT e.first_name, e.salary, ROUND(a.department_avg) AS department_avg
FROM employees AS e
JOIN averages AS a ON a.department_id = e.department_id
WHERE e.salary > a.department_avg
ORDER BY e.first_name;
