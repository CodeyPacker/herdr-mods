SELECT p.category_id, p.name, p.price
FROM products AS p
WHERE p.category_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM products AS other
      WHERE other.category_id = p.category_id
        AND (other.price > p.price OR (other.price = p.price AND other.name < p.name))
  )
ORDER BY p.category_id;
