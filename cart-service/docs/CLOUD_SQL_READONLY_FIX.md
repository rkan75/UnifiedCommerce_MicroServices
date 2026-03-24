# Fix: "Cannot execute INSERT in a read-only transaction" (25006) with Cloud SQL

## How to find the Primary instance (not a Read replica)

Your app must connect to the **primary** instance. Use one of the methods below to identify it and get its connection name.

### Option A: Google Cloud Console (UI)

1. Open **[Google Cloud Console](https://console.cloud.google.com)** and select your project.
2. Go to **SQL** (search "SQL" in the top bar or use **Navigation menu** → **Databases** → **SQL**).
3. On the **Instances** list you’ll see all Cloud SQL instances. For each instance, check:
   - **Instance type** (or **Role**):
     - **Primary** → this is the read-write instance. Use this one for the app.
     - **Read replica** → this is read-only. Do **not** use for the app.
   - If you see **"Replica of: &lt;instance-name&gt;"**, the primary is that other instance; use the primary’s row.
4. Click the **primary** instance name to open its details.
5. Copy the **Connection name** (e.g. `my-project:us-central1:my-instance`). Use this value for `INSTANCE_CONNECTION_NAME` and for the Cloud SQL Auth Proxy.

### Option B: gcloud CLI

```bash
# List all Cloud SQL instances in the project and show role (primary vs replica)
gcloud sql instances list --format="table(name,region,instanceType,databaseVersion)"

# For PostgreSQL, "instanceType" is often shown in the instance details.
# To see which is primary vs replica (replicas have a "masterInstanceName" or similar):
gcloud sql instances list --format="table(name,region,connectionName)"
# Then describe the instance you care about:
gcloud sql instances describe INSTANCE_NAME --format="yaml(instanceType,connectionName,ipAddresses)"
```

- If the instance is a **read replica**, the description may include a **masterInstanceName** or **primary** reference—use that primary instance’s **connectionName** for the app.
- The **connectionName** in the format `project:region:instance` is what you put in `INSTANCE_CONNECTION_NAME`.

### Option C: Only one instance

If you have only **one** Cloud SQL instance and no read replicas, that instance is the primary. Use its **Connection name** from the instance details page or from `gcloud sql instances describe INSTANCE_NAME`.

---

## After restart: same 25006 error

If cart worked before and you get 25006 again **after restarting** the backend or services, the cart service may be connecting to a **read replica** after the restart (e.g. different startup order, or env not loaded). Do this:

1. **Restart the cart service last** (or ensure it starts with the same `.env` as before) so `SPRING_DATASOURCE_URL` and, if used, `INSTANCE_CONNECTION_NAME` are set correctly.
2. **Check the cart-service log** on startup for:
   - `Cart service: read-write check passed` → DB allows writes; add to cart should work.
   - `Cart service is connected to a READ-ONLY database (replica)` → You are on a replica; fix the connection to point to the **primary** (see "How to find the Primary instance" above).
3. **Use the primary** in `INSTANCE_CONNECTION_NAME` and in the proxy so that every time the cart service starts, it gets a read-write connection.

---

## Why the same query works in Cloud SQL Console but fails in the app

| Where you run the query | Connection target | Writes allowed? |
|-------------------------|-------------------|-----------------|
| **Cloud SQL Console** (in GCP) | **Primary** instance (read-write) | Yes |
| **Your application** (cart service) | Often a **read replica** or read-only path | No → 25006 |

The console always uses the **primary** instance. The app uses whatever host/port and connection name you configured—if that points to a **read replica** or a read-only endpoint, you get 25006.

---

## 1. Use the primary instance for the app (required)

The cart service **must** connect to the **primary** instance, not a read replica.

### If you use Cloud SQL Auth Proxy

- In **GCP Console** → **SQL** → your instance:
  - If you see **"Read replica"**, that instance is read-only. Do **not** use its connection name for the app.
  - Use the **primary** instance’s **Connection name** (e.g. `project-id:region:instance-name`).
- In your repo **`.env`** (or wherever you start the proxy):
  - Set `INSTANCE_CONNECTION_NAME` to the **primary** connection name only.
  - Example: `INSTANCE_CONNECTION_NAME=my-project:us-central1:my-db-primary`
- Start the proxy with that name, and point `SPRING_DATASOURCE_URL` at the proxy (e.g. `jdbc:postgresql://127.0.0.1:5433/grocery_store`). The app will then use the primary.

### If you use direct IP (public or private)

- Use the **primary** instance’s IP from the Cloud SQL instance details page.
- Do **not** use the IP of a read replica. Replicas are read-only.

### If you use a connection pooler or other proxy

- Ensure the pooler/proxy is configured to use the **primary** for read-write traffic, not a replica.

---

## 2. Confirm in GCP Console

1. Open **Google Cloud Console** → **SQL**.
2. Select the instance you use for `grocery_store`.
3. Check **"Instance type"** (or role):
   - **Primary** → use this instance’s connection name / IP for the app.
   - **Read replica** → do **not** use for the app; use the **primary** listed for this replica.
4. Copy the **primary** instance’s **Connection name** and use it in `INSTANCE_CONNECTION_NAME` (and in the proxy command if you run it manually).

---

## 3. Checklist for your repo

- [ ] **`.env`** (repo root) has `INSTANCE_CONNECTION_NAME` = **primary** instance only (no replica).
- [ ] **`.env`** has `SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:5433/grocery_store` (or the port your proxy uses).
- [ ] You start **Cloud SQL Auth Proxy** with that primary connection name before starting the app (e.g. `./scripts/start-all.sh` with `CLOUD_SQL_PROXY=1` and the same `.env`).
- [ ] Cart service is restarted after any change so it picks up the new connection.

---

## 4. Optional: verify from the app host

From the same machine where the cart service runs, connect through the same proxy/URL the app uses:

```bash
# Use same credentials as the app (from .env)
source .env 2>/dev/null
PGPASSWORD="$SPRING_DATASOURCE_PASSWORD" psql -h 127.0.0.1 -p 5433 -U grocery_app -d grocery_store -c "INSERT INTO public.commerce_cart (id, region_id, locale, currency_code, created_at, updated_at) VALUES ('test-1', 'reg_01', 'en', 'usd', NOW(), NOW());"
# If this succeeds, the app should also get read-write. If you get 25006 here too, the proxy/URL is still pointing at a replica.
```

If this INSERT fails with 25006, the connection from that host/port is still read-only (replica or wrong instance). Fix the proxy/connection name and try again.
