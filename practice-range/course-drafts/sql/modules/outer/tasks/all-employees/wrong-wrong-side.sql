SELECT e.first_name, COALESCE(d.name, 'No department') AS department
FROM departments AS d
LEFT JOIN employees AS e ON d.id = e.department_id
ORDER BY e.first_name;
