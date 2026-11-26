SELECT e.first_name, d.name AS department
FROM employees AS e
LEFT JOIN departments AS d ON d.id = e.department_id
ORDER BY e.first_name;
