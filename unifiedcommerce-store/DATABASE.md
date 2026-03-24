# Database: GCP Cloud SQL

This project uses **GCP Cloud SQL** as the primary database (not Supabase).

## Local development

1. **Start Cloud SQL Proxy** so your machine can reach Cloud SQL:
   - See `deploy/REFRESH_SUPABASE_FROM_CLOUDSQL.md` (Steps 1–2) for connection details and proxy install.
   - Example:  
     `cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:5434 &`  
     (use a free port, e.g. 5434 if 5432 is in use.)

2. **Set `DATABASE_URL`** in `.env` to the proxy:
   - `DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5434/medusa_grocery_store`  
   - The password must **exactly** match the `medusa_app` user password in Cloud SQL. If you ran `deploy/01-create-database.sql`, the default is `UnifiedCommerce@1` (use that in the URL, or change the user's password in GCP to match).

3. **Run the backend:**  
   `npm run dev` (or `npx medusa develop`).

## Deployed (e.g. GCP Cloud Run)

Set `DATABASE_URL` to your Cloud SQL connection:

- **Cloud Run with Cloud SQL:**  
  `postgresql://USER:PASSWORD@/postgres?host=/cloudsql/PROJECT:REGION:INSTANCE`
- **Private IP:**  
  `postgresql://USER:PASSWORD@PRIVATE_IP:5432/postgres`

## Troubleshooting: KnexTimeoutError

If the backend logs **Pg connection failed / KnexTimeoutError**:

1. **Check that the database port is reachable:**
   ```bash
   node scripts/check-db-port.js
   ```
   If this fails, start **Cloud SQL Proxy** in another terminal (see above), then run it again.

2. **Test direct PostgreSQL:** Run `node scripts/test-db-connect.js`. If it succeeds but Medusa still times out, run step 3. If it fails with "password authentication failed", fix `medusa_app` user/password in Cloud SQL and `.env`.

3. **Force no-SSL for localhost:** Run `node scripts/apply-cloudsql-ssl-fix.js`, then restart the backend. Re-run after every `npm install`.

4. **Restart script:** `./restart-dev.sh` now runs this check automatically when `DATABASE_URL` points to localhost; if the proxy isn’t running, it will tell you to start it and exit.

## Optional: Supabase copy

If you need a copy of the data in Supabase, use the one-way refresh script:

- `deploy/refresh-supabase-from-cloudsql.sh`  
- See `deploy/REFRESH_SUPABASE_FROM_CLOUDSQL.md`.
