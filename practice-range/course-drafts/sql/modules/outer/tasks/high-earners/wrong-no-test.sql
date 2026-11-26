SELECT d.name AS department, e.first_name
FROM departments AS d
LEFT JOIN employees AS e ON e.department_id = d.id
ORDER BY d.name, e.first_name;
