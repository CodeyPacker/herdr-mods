CREATE TABLE coupons (
    code       text NOT NULL UNIQUE,
    percent    integer NOT NULL,
    expires_on date,
    CHECK (percent >= 1 AND percent <= 100)
);
