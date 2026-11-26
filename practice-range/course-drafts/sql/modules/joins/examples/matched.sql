SELECT count(*) AS matched
FROM employees AS e
JOIN departments AS d ON d.id = e.department_id;
