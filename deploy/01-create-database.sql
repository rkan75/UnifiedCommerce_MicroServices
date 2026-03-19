-- Cloud SQL: Create database and user for Medusa
-- Run as postgres superuser (Cloud SQL default user)
-- Replace YOUR_DB_PASSWORD with a strong password before running
--
-- Usage (Cloud SQL Proxy):
--   cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:5432 &
--   export PGPASSWORD=postgres_password
--   psql "postgresql://postgres@localhost:5432/postgres" -f deploy/01-create-database.sql
--
-- Or via Cloud Shell:
--   gcloud sql connect INSTANCE_NAME --user=postgres < 01-create-database.sql

-- Create database
CREATE DATABASE medusa_grocery_store;

-- Create user (replace YOUR_DB_PASSWORD with a strong password)
CREATE USER medusa_app WITH PASSWORD 'UnifiedCommerce@1';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE medusa_grocery_store TO medusa_app;

-- Connect to the new database and grant schema privileges
\c medusa_grocery_store 

-- Grant schema usage
GRANT ALL ON SCHEMA public TO medusa_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO medusa_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO medusa_app;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO medusa_app;

-- Default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO medusa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO medusa_app;
