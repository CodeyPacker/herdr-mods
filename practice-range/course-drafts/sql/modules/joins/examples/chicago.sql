SELECT e.first_name, d.name AS department
FROM employees AS e
JOIN departments AS d ON d.id = e.department_id
WHERE d.location = 'Chicago'
ORDER BY e.first_name;
