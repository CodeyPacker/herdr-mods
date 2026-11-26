CREATE TABLE suppliers (
    id     integer PRIMARY KEY,
    name   text NOT NULL,
    active boolean NOT NULL DEFAULT true
);
