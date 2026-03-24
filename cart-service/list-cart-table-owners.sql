-- List who owns the cart tables. Run with any user that can read pg_tables.
-- Then run grant-cart-permissions.sql as the tableowner user (see column below).

SELECT schemaname,
       tablename,
       tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('commerce_cart', 'commerce_line_item', 'commerce_order', 'commerce_order_line_item')
ORDER BY tablename;
