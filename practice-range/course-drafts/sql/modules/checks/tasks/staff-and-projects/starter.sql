SELECT d.name AS department, count(e.id) AS staff, count(p.id) AS projects
FROM departments AS d
LEFT JOIN employees AS e ON e.department_id = d.id
LEFT JOIN projects AS p ON p.department_id = d.id
GROUP BY d.name
ORDER BY d.name;
