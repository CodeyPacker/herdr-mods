WITH payrolls AS (
    SELECT department_id, sum(salary) AS payroll
    FROM employees
    GROUP BY department_id
)
SELECT d.name AS department, p.payroll
FROM payrolls AS p
JOIN departments AS d ON d.id = p.department_id
WHERE p.payroll > d.budget / 2
ORDER BY d.name;
