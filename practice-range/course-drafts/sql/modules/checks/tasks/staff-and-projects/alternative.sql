SELECT d.name AS department,
       (SELECT count(*) FROM employees AS e WHERE e.department_id = d.id) AS staff,
       (SELECT count(*) FROM projects AS p WHERE p.department_id = d.id) AS projects
FROM departments AS d
ORDER BY d.name;
