SELECT projects.name AS project, departments.name AS department
FROM departments
JOIN projects ON projects.department_id = departments.id
ORDER BY projects.name;
