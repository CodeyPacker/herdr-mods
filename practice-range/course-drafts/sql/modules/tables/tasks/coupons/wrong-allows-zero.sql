CREATE TABLE coupons (
    code       text PRIMARY KEY,
    percent    integer NOT NULL CHECK (percent BETWEEN 0 AND 100),
    expires_on date
);
