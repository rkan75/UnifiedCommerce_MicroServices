-- Auth table for customer-service (run once against same DB as customer/address).
-- Enables register, login, password reset without Medusa.
-- Run: psql -h HOST -p PORT -U USER -d DB -f src/main/resources/schema-auth.sql

CREATE TABLE IF NOT EXISTS public.customer_auth (
  id VARCHAR(64) PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  reset_token VARCHAR(255),
  reset_token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_customer_auth_email ON public.customer_auth(LOWER(TRIM(email)));
CREATE INDEX IF NOT EXISTS idx_customer_auth_customer_id ON public.customer_auth(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_auth_reset_token ON public.customer_auth(reset_token) WHERE reset_token IS NOT NULL;
