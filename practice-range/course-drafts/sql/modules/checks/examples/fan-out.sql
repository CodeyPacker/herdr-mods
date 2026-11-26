SELECT d.name,
       count(DISTINCT e.id) AS staff,
       count(DISTINCT p.id) AS projects,
       count(*) AS joined_rows
FROM departments AS d
LEFT JOIN employees AS e ON e.department_id = d.id
LEFT JOIN projects AS p ON p.department_id = d.id
GROUP BY d.name
ORDER BY d.name;
