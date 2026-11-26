SELECT d.name AS department, count(DISTINCT e.id) AS staff, count(DISTINCT p.id) AS projects
FROM departments AS d
JOIN employees AS e ON e.department_id = d.id
JOIN projects AS p ON p.department_id = d.id
GROUP BY d.name
ORDER BY d.name;
