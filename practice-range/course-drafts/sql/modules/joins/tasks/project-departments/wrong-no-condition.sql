SELECT p.name AS project, d.name AS department
FROM projects AS p
CROSS JOIN departments AS d
ORDER BY project;
