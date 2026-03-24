-- Give the app user (grocery_app) full INSERT/UPDATE/DELETE/SELECT on cart tables.
-- Run as a SUPERUSER (postgres, cloudsqlsuperuser, or the current table owner).
--
-- Option A - Make grocery_app the owner (recommended; owner has all rights):
--   psql -h HOST -p PORT -U postgres -d grocery_store -f ensure-cart-app-user-access.sql
--
-- Option B - If you get "permission denied", find table owner: list-cart-table-owners.sql
--   Then run grant-cart-permissions.sql as that owner.

-- Ensure app user can use public schema
GRANT USAGE ON SCHEMA public TO grocery_app;

-- Make grocery_app the owner so it has full SELECT, INSERT, UPDATE, DELETE (no separate GRANT needed)
ALTER TABLE public.commerce_cart OWNER TO grocery_app;
ALTER TABLE public.commerce_line_item OWNER TO grocery_app;
ALTER TABLE public.commerce_order OWNER TO grocery_app;
ALTER TABLE public.commerce_order_line_item OWNER TO grocery_app;

-- If tables don't exist yet, create them first: cd cart-service && ./run-schema.sh
