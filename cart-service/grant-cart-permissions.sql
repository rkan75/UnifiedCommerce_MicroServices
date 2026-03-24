-- Grant permissions on cart tables to grocery_app.
-- Must be run by the TABLE OWNER (not postgres unless postgres owns the tables).
--
-- If you get "permission denied for table commerce_cart":
--   1. Find the owner: psql ... -c "SELECT tableowner FROM pg_tables WHERE schemaname='public' AND tablename='commerce_cart';"
--   2. Run this script as that user: psql -h HOST -p PORT -U <tableowner> -d grocery_store -f grant-cart-permissions.sql
--
-- Or list all owners: psql ... -f list-cart-table-owners.sql

-- Ensure grocery_app can use the public schema (usually already true)
GRANT USAGE ON SCHEMA public TO grocery_app;

-- Cart service tables: full read/write (run as the user that owns these tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commerce_cart TO grocery_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commerce_line_item TO grocery_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commerce_order TO grocery_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commerce_order_line_item TO grocery_app;
