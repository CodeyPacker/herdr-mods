SELECT d.name AS department, sum(e.salary) AS payroll
FROM departments AS d
JOIN employees AS e ON e.department_id = d.id
GROUP BY d.name, d.budget
HAVING sum(e.salary) * 2 > d.budget
ORDER BY d.name;
