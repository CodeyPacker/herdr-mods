SELECT d.name AS project, p.name AS department
FROM projects AS p
JOIN departments AS d ON d.id = p.department_id
ORDER BY project;
