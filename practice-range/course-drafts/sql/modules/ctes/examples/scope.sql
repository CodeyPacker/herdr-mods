WITH big AS (
    SELECT id FROM products WHERE price > 500
)
SELECT count(*) FROM big;

SELECT count(*) FROM big;
