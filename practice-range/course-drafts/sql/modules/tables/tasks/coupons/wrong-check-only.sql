CREATE TABLE coupons (
    code       text PRIMARY KEY,
    percent    integer CHECK (percent BETWEEN 1 AND 100),
    expires_on date
);
