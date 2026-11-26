SELECT e.first_name, d.name AS department
FROM employees AS e
LEFT JOIN departments AS d ON d.id = e.department_id
WHERE e.id >= 22
ORDER BY e.id;
