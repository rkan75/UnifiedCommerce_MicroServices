-- Run as a SUPERUSER (e.g. cloudsqlsuperuser on Cloud SQL, or postgres if it is superuser).
-- This makes postgres the owner of the cart tables so that postgres can then run
-- grant-cart-permissions.sql successfully.
--
-- Usage (as superuser):
--   psql -h HOST -p PORT -U cloudsqlsuperuser -d grocery_store -f take-ownership-cart-tables.sql
-- Then run grant-cart-permissions.sql as postgres.

ALTER TABLE public.commerce_cart OWNER TO postgres;
ALTER TABLE public.commerce_line_item OWNER TO postgres;
ALTER TABLE public.commerce_order OWNER TO postgres;
ALTER TABLE public.commerce_order_line_item OWNER TO postgres;
