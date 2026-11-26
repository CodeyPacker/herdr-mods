INSERT INTO departments (id, name, location, budget)
VALUES (7, 'Research', 'Austin', 250000.00);

SELECT name, location
FROM departments
WHERE id >= 6;
