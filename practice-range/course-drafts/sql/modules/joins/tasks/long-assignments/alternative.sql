SELECT e.first_name, p.name AS project, a.hours
FROM employees AS e
JOIN assignments AS a ON a.employee_id = e.id AND a.hours >= 401
JOIN projects AS p ON a.project_id = p.id
ORDER BY 3 DESC, 1;
