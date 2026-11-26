SELECT department_id, count(*) AS staff, ROUND(avg(salary)) AS avg_salary
FROM employees
GROUP BY department_id
HAVING count(*) >= 4
ORDER BY department_id;
