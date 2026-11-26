SELECT e.first_name, e.salary
FROM employees AS e
CROSS JOIN (SELECT avg(salary) AS average FROM employees) AS a
WHERE e.salary > a.average
ORDER BY e.salary DESC;
