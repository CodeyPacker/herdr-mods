CREATE TABLE shipments (
    id         integer NOT NULL,
    order_id   integer NOT NULL,
    weight_kg  numeric(6, 2) NOT NULL,
    shipped_on date NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (order_id) REFERENCES orders (id),
    CHECK (weight_kg > 0)
);
