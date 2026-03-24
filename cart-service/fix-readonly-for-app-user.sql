-- Fix "cannot execute INSERT in a read-only transaction" for grocery_app on grocery_store.
-- Run as a SUPERUSER (postgres or cloudsqlsuperuser). This ensures the database and the
-- grocery_app role are NOT forced to read-only (so the cart service can INSERT/UPDATE).
--
-- Usage:
--   psql -h HOST -p PORT -U postgres -d grocery_store -f fix-readonly-for-app-user.sql
--
-- After running, restart the cart service. If you still get the error, you are likely
-- connected to a READ REPLICA—point SPRING_DATASOURCE_URL to the primary instance.

-- 1. Ensure database grocery_store is not forced to read-only (for connections to this DB)
ALTER DATABASE grocery_store SET default_transaction_read_only = off;

-- 2. Ensure role grocery_app is not forced to read-only (for connections as this user)
ALTER ROLE grocery_app SET default_transaction_read_only = off;

-- 3. Ensure grocery_app can connect and use public schema
GRANT CONNECT ON DATABASE grocery_store TO grocery_app;
GRANT USAGE ON SCHEMA public TO grocery_app;

-- Restart the cart service after this. If you still get the error, you are likely
-- connected to a read replica—use the primary instance in SPRING_DATASOURCE_URL.
