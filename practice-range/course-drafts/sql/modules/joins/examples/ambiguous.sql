SELECT id, name
FROM employees
JOIN departments ON departments.id = employees.department_id;
