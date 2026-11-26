SELECT e.first_name, p.name AS project, a.hours
FROM assignments AS a
JOIN employees AS e ON e.id = a.employee_id
JOIN projects AS p ON p.id = a.employee_id
WHERE a.hours > 400
ORDER BY a.hours DESC, e.first_name;
