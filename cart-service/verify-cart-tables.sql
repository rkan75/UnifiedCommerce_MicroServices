-- Verify cart tables exist in this database (run against the SAME DB as SPRING_DATASOURCE_URL).
-- If this returns 0 rows, run: cd cart-service && ./run-schema.sh
--
-- Easiest: use same credentials as the app (no password prompt):
--   ./cart-service/verify-cart-tables.sh   (from repo root; loads .env)
--
-- Or: PGPASSWORD='YourPassword' psql -h HOST -p PORT -U grocery_app -d grocery_store -f cart-service/verify-cart-tables.sql

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('commerce_cart', 'commerce_line_item', 'commerce_order', 'commerce_order_line_item')
ORDER BY table_name;
