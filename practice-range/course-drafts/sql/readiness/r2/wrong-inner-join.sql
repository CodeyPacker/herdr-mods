SELECT d.name AS department, count(e.id) AS staff, COALESCE(sum(e.salary), 0) AS payroll
FROM departments AS d
JOIN employees AS e ON e.department_id = d.id
GROUP BY d.name
ORDER BY payroll DESC, d.name;
