SELECT e.first_name, CASE WHEN d.id IS NULL THEN 'No department' ELSE d.name END AS department
FROM departments AS d
RIGHT JOIN employees AS e ON d.id = e.department_id
ORDER BY 1;
