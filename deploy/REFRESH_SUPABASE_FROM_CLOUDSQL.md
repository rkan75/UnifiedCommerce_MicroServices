# Refresh Supabase Medusa DB from GCP Cloud SQL

**Note:** This project uses **GCP Cloud SQL** as the primary database. This guide is only for optionally copying data from Cloud SQL into a Supabase project (e.g. for a read replica or migration). Day-to-day development and production use Cloud SQL.

Step-by-step guide to copy the database from GCP Cloud SQL into your Supabase project (replacing existing data).

---

## Prerequisites

1. **PostgreSQL client tools** on your machine (or a VM that can reach both Cloud SQL and Supabase):
   - `pg_dump`
   - `pg_restore`
   - `psql`
   - `pg_isready` (optional, for proxy check)

   **macOS (Homebrew):** `brew install libpq` then add to PATH: `export PATH="/opt/homebrew/opt/libpq/bin:$PATH"`  
   **Ubuntu/Debian:** `sudo apt-get install postgresql-client`

2. **Access to GCP Cloud SQL**
   - Either: **Cloud SQL Proxy** (recommended), or
   - Direct connection from an IP in Cloud SQL’s **Authorized networks**

3. **Supabase project**
   - Use the **direct** connection string (port **5432**), not the pooler (6543).

---

## Step 1: Get Cloud SQL connection details

### Option A: Using Cloud SQL Proxy (recommended)

1. **Instance connection name**
   - GCP Console → **SQL** → your instance → **Overview**.
   - Copy **Connection name** (e.g. `myproject:us-central1:myinstance`).

2. **Database credentials**
   - Same instance → **Users** (user + password) and **Databases** (e.g. `medusa_db`).

3. **Install Cloud SQL Proxy** (if needed):
   - [Install the proxy](https://cloud.google.com/sql/docs/postgres/connect-auth-proxy#install).
   - Or: `curl -o cloud_sql_proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64 && chmod +x cloud_sql_proxy` (adjust OS/arch).

### Option B: Direct connection (authorized network)

1. Enable **Public IP** on the instance (if needed).
2. Add your machine’s IP to **Authorized networks** (instance → **Connections**).
3. Note: **Host**, **Port** (usually 5432), **User**, **Password**, **Database** (e.g. `medusa_db`).

---

## Step 2: Get Supabase connection string

1. Supabase Dashboard → your project → **Project Settings** (gear) → **Database**.
2. Under **Connection string** choose **URI**.
3. Use the **Direct** URL (port **5432**), not Session pooler (6543).
4. Replace `[YOUR-PASSWORD]` with the database password (or the one you set).
5. Example:
   ```text
   postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```
   Or:
   ```text
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
   ```

---

## Step 3: Set environment variables

From the `medusacommerce` repo root (or wherever you run the script), set:

### If using Cloud SQL Proxy (Option A)

```bash
# Cloud SQL (proxy will be started by the script)
export INSTANCE_CONNECTION_NAME="YOUR_PROJECT:YOUR_REGION:YOUR_INSTANCE"
export CLOUDSQL_USER="medusa_app"
export CLOUDSQL_PASSWORD="your_cloudsql_password"
export CLOUDSQL_DATABASE="medusa_db"
export CLOUDSQL_PORT="5432"

# Supabase (direct connection, port 5432)
export SUPABASE_DATABASE_URL="postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

### If using direct Cloud SQL URL (Option B, or proxy already running)

```bash
# Single URL for Cloud SQL (e.g. via proxy on localhost, or direct)
export CLOUDSQL_DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/medusa_db"

# Supabase
export SUPABASE_DATABASE_URL="postgresql://postgres.[ref]:[PASSWORD]@..."
```

**Security:** Avoid committing these. Use a `.env` file that’s in `.gitignore` and `source` it, or set them only in the current shell.

---

## Step 4: Run the refresh script

From the repo root:

```bash
chmod +x deploy/refresh-supabase-from-cloudsql.sh
./deploy/refresh-supabase-from-cloudsql.sh
```

The script will:

1. **Start Cloud SQL Proxy** (if `INSTANCE_CONNECTION_NAME` is set).
2. **Dump** Cloud SQL `medusa_db` to a temporary file (custom format, no owner/acl).
3. **Restore** into Supabase with `--clean --if-exists` (drops existing objects then restores).
4. **Clean up** the dump file and stop the proxy.

---

## Step 5: Verify

1. In Supabase: **Table Editor** (or SQL) and confirm tables/rows look correct.
2. Point your Medusa app (or backend) at the **Supabase** `DATABASE_URL` and run a quick smoke test (e.g. load admin or storefront).

---

## Troubleshooting

| Issue | What to do |
|------|------------|
| `pg_dump: command not found` | Install PostgreSQL client tools (see Prerequisites). |
| `connection refused` to Cloud SQL | Start Cloud SQL Proxy first, or add your IP to Authorized networks and use `CLOUDSQL_DATABASE_URL`. |
| `password authentication failed` | Check user/password and that the user is allowed to connect to `medusa_db`. |
| `role "xyz" does not exist` during restore | Normal: pg_restore may try to drop roles from the source that don’t exist on Supabase. The script allows exit code 1 from `pg_restore` for this. Data should still be there. |
| Supabase “too many connections” | Use the **direct** connection (5432) for this one-off restore, not the pooler. |
| Need to refresh only data, keep Supabase schema | Use a data-only dump: in the script, change `pg_dump` to add `--data-only` and use a schema-only dump first on Supabase, then restore data (or adapt the script for data-only). |

---

## One-off manual steps (without the script)

If you prefer to run commands yourself:

```bash
# 1. Start Cloud SQL Proxy (if needed)
cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:5432 &

# 2. Dump from Cloud SQL
pg_dump "postgresql://USER:PASSWORD@127.0.0.1:5432/medusa_db" \
  --format=custom --no-owner --no-acl -f medusa.dump

# 3. Restore to Supabase (replace SUPABASE_URL)
pg_restore --dbname="SUPABASE_URL" --clean --if-exists --no-owner --no-acl -v medusa.dump

# 4. Remove dump file
rm medusa.dump
```

---

## Summary

1. Install `pg_dump` / `pg_restore` / `psql`.
2. Get Cloud SQL connection (proxy or direct) and Supabase **direct** URL (port 5432).
3. Set `CLOUDSQL_*` (or `CLOUDSQL_DATABASE_URL`) and `SUPABASE_DATABASE_URL`.
4. Run `./deploy/refresh-supabase-from-cloudsql.sh`.
5. Verify in Supabase and in your app.

After this, Supabase Medusa DB is a copy of GCP Cloud SQL medusa_db.
