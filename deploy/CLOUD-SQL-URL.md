# Cloud SQL connection URL for Cloud Run

Your backend is timing out on **public IP** (34.172.26.215) because Cloud Run’s egress IPs are not in Cloud SQL’s **Authorized networks**. Use one of the two approaches below. For **private IP + VPC connector**, see **[CLOUD-SQL-PRIVATE-IP-VPC-GUIDE.md](./CLOUD-SQL-PRIVATE-IP-VPC-GUIDE.md)**.

---

## Option 1: Cloud SQL Auth Proxy (recommended – no authorized networks)

Cloud Run connects via a Unix socket; no public IP or authorized networks needed.

### 1. Get your instance connection name

In Cloud Console: **SQL → your instance → Overview** → copy **“Connection name”**  
(e.g. `unifiedcommerce-487215:us-central1:my-db-instance`).

Or with gcloud (replace `YOUR_INSTANCE_ID` with the instance name from the console):

```bash
gcloud sql instances describe YOUR_INSTANCE_ID --format='value(connectionName)'
```

Example output: `unifiedcommerce-487215:us-central1:medusa-db`

### 2. Set `deploy/.env`

Use the **same** connection name in both variables (replace `CONNECTION_NAME` with the value from step 1):

```bash
# Auth Proxy – use socket URL (no public IP)
CLOUD_SQL_INSTANCE=CONNECTION_NAME
DATABASE_URL=postgresql://medusa_app:UnifiedCommerce%401@/postgres?host=/cloudsql/CONNECTION_NAME
```

**Example** (if connection name is `unifiedcommerce-487215:us-central1:medusa-db`):

```bash
CLOUD_SQL_INSTANCE=unifiedcommerce-487215:us-central1:medusa-db
DATABASE_URL=postgresql://medusa_app:UnifiedCommerce%401@/postgres?host=/cloudsql/unifiedcommerce-487215:us-central1:medusa-db
```

- Encode `@` in the password as `%40` (e.g. `UnifiedCommerce@1` → `UnifiedCommerce%401`).
- Database name after the last `/` is `postgres`; change it if your DB name is different.

### 3. Deploy

```bash
./deploy/build-and-deploy-all.sh
```

(or build with `deploy/cloudbuild.yaml` then `./deploy/deploy-backend.sh`).  
The deploy script will add the instance to Cloud Run (`--add-cloudsql-instances`) when `CLOUD_SQL_INSTANCE` is set.

---

## Option 2: Public IP (needs authorized networks)

Format:

```text
postgresql://USER:PASSWORD@PUBLIC_IP:5432/DATABASE_NAME
```

Your current URL is correct in form; the problem is **reachability**:

- In **Cloud Console**: **SQL → your instance → Connections** (or **Networking**).
- Under **Authorized networks**, add:
  - **Name:** e.g. `Cloud Run`
  - **Network:** `0.0.0.0/0`
- Save.

Then redeploy. No change to `DATABASE_URL` in `.env` is required; keep:

```bash
DATABASE_URL=postgresql://medusa_app:UnifiedCommerce%401@34.172.26.215:5432/postgres
```

---

## Summary

| Method              | URL form                                                                 | Extra step |
|--------------------|--------------------------------------------------------------------------|------------|
| Auth Proxy (socket)| `postgresql://user:pass@/dbname?host=/cloudsql/PROJECT:REGION:INSTANCE`  | Set `CLOUD_SQL_INSTANCE` in `deploy/.env` and redeploy |
| Public IP          | `postgresql://user:pass@34.172.26.215:5432/postgres`                     | Add authorized network `0.0.0.0/0` in Cloud SQL |

The **actual URL** that works from Cloud Run without opening the world is the **socket URL** in Option 1, with `CONNECTION_NAME` replaced by your instance’s connection name from the console or `gcloud sql instances describe`.

---

## Troubleshooting: "Cloud SQL connection failed...timed out after 10s"

If you see:

  Cloud SQL connection failed...connection to Cloud SQL instance at 34.x.x.x:3307 failed: timed out after 10s

the Cloud Run to Cloud SQL proxy cannot connect. **Fix: grant the Cloud SQL Client IAM role** to the service account used by Cloud Run.

### Option A – Let the deploy script do it

`./deploy/deploy-backend.sh` now tries to add `roles/cloudsql.client` to the default Compute Engine service account when `CLOUD_SQL_INSTANCE` is set. Redeploy:

  ./deploy/deploy-backend.sh

If you see a warning that the role could not be added, use Option B.

### Option B – Run once manually

  PROJECT_ID=unifiedcommerce-487215
  PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/cloudsql.client"

Then redeploy the backend. The port **3307** in the error is from the proxy; fixing IAM resolves the timeout.

### If you use a custom Cloud Run service account

Grant **Cloud SQL Client** to that account in IAM & Admin, or with gcloud projects add-iam-policy-binding using that service account email.
