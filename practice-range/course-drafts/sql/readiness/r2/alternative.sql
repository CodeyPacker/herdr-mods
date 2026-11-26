SELECT d.name AS department,
       (SELECT count(*) FROM employees AS e WHERE e.department_id = d.id) AS staff,
       COALESCE((SELECT sum(e.salary) FROM employees AS e WHERE e.department_id = d.id), 0) AS payroll
FROM departments AS d
ORDER BY payroll DESC, department;
