CREATE TABLE suppliers (
    id     integer NOT NULL,
    name   text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    PRIMARY KEY (id)
);
