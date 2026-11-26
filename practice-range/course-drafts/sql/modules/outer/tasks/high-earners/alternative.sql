SELECT d.name AS department, e.first_name
FROM employees AS e
RIGHT JOIN departments AS d ON d.id = e.department_id AND e.salary > 150000
ORDER BY 1, 2;
