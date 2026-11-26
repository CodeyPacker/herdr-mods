SELECT p.name AS project, d.name AS department
FROM projects AS p
JOIN departments AS d ON d.id = p.id
ORDER BY project;
