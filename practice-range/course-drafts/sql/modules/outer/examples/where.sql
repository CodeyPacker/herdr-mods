SELECT d.name, e.first_name
FROM departments AS d
LEFT JOIN employees AS e ON e.department_id = d.id
WHERE e.salary > 200000
ORDER BY d.id;
