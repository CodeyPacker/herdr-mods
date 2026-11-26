CREATE TABLE suppliers (
    id      integer PRIMARY KEY,
    name    text NOT NULL,
    country text NOT NULL DEFAULT 'USA',
    rating  integer CHECK (rating BETWEEN 1 AND 5)
);

INSERT INTO suppliers (id, name, rating)
VALUES (2, 'Bolt', 9);
