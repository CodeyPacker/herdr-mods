CREATE TABLE shipments (
    id         integer PRIMARY KEY,
    order_id   integer NOT NULL,
    weight_kg  numeric(6, 2) NOT NULL CHECK (weight_kg > 0),
    shipped_on date NOT NULL
);
