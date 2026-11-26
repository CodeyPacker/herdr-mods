SELECT e.first_name, e.department_id, e.salary,
       (SELECT count(*) + 1 FROM employees AS higher
        WHERE higher.department_id = e.department_id AND higher.salary > e.salary) AS position
FROM employees AS e
WHERE e.department_id IS NOT NULL
ORDER BY e.department_id, position;
