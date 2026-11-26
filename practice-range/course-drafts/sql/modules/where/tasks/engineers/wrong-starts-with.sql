SELECT first_name, title, salary
FROM employees
WHERE title LIKE 'Engineer%' AND salary BETWEEN 110000 AND 160000;
