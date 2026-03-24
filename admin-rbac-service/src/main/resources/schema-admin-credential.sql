-- Admin credentials for Java admin auth (decommission Medusa admin auth).
-- Run once: psql ... -f schema-admin-credential.sql
-- Or the service will create the table at startup if missing (see AdminCredentialInitializer).

CREATE TABLE IF NOT EXISTS public.admin_credential (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_credential_email ON public.admin_credential (LOWER(email));
