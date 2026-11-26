SELECT e.first_name, COALESCE(d.name, 'No department') AS department
FROM employees AS e
JOIN departments AS d ON d.id = e.department_id
ORDER BY e.first_name;
