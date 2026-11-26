SELECT first_name, title, salary
FROM employees
WHERE title LIKE '%Engineer%' AND salary > 110000 AND salary < 160000;
