-- Address table for customer-service (run once if your DB does not have an address table).
-- Medusa v2 may already have an "address" table; if so, you can skip this or align column names.
-- Run: psql -h HOST -p PORT -U USER -d DB -f customer-service/src/main/resources/schema-address.sql

CREATE TABLE IF NOT EXISTS public.address (
  id VARCHAR(64) PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  company VARCHAR(255),
  address_1 VARCHAR(255) NOT NULL,
  address_2 VARCHAR(255),
  city VARCHAR(255) NOT NULL,
  province VARCHAR(255),
  postal_code VARCHAR(32) NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  phone VARCHAR(32),
  is_default_billing BOOLEAN DEFAULT FALSE,
  is_default_shipping BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_address_customer_id ON public.address(customer_id);
