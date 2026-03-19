# Cloud SQL with Private IP + VPC Connector (Step-by-Step)

This guide walks you through securing your Cloud SQL instance with **private IP** and connecting to it from **Cloud Run** using a **Serverless VPC Access connector**. The database is not exposed on the public internet.

---

## Overview

| Component | Role |
|-----------|------|
| **Cloud SQL (private IP)** | Database has an IP only in your VPC (e.g. `10.x.x.x`). No public IP or authorized networks. |
| **Serverless VPC Access connector** | Lets Cloud Run send traffic into your VPC so it can reach the private IP. |
| **Private Google Access / Private services access** | Allocates an IP range in your VPC for Google services (required for Cloud SQL private IP). |

**Result:** Cloud Run → VPC connector → your VPC → Cloud SQL private IP. No open firewall to the internet.

---

## Prerequisites

- A GCP project with billing enabled.
- `gcloud` CLI installed and logged in: `gcloud auth login` and `gcloud config set project PROJECT_ID`.
- Cloud SQL Admin API and Compute Engine API enabled:
  ```bash
  gcloud services enable sqladmin.googleapis.com compute.googleapis.com run.googleapis.com vpcaccess.googleapis.com servicenetworking.googleapis.com
  ```

---

## Step 1: Allocate an IP range for Private Services Access

Cloud SQL private IP uses a range of IPs in your VPC (managed by Google). You must allocate that range once per network.

1. **Get your project and network names:**
   ```bash
   PROJECT_ID=unifiedcommerce-487215   # your project
   NETWORK=default                      # VPC network name (often "default")
   ```

2. **Create a global address range for private services access** (do this once per VPC):
   ```bash
   gcloud compute addresses create google-managed-services-default \
     --global \
     --purpose=VPC_PEERING \
     --addresses=10.10.10.0 \
     --prefix-length=24 \
     --network=default
   ```
   - If you get "already exists", the range is already allocated; you can skip or use a different name/range.
   - This reserves `10.10.10.0/24` for Google services (including Cloud SQL) in the `default` network.

3. **Create the private connection (VPC peering):**
   ```bash
   gcloud services vpc-peerings connect \
     --service=servicenetworking.googleapis.com \
     --network=default \
     --ranges=google-managed-services-default
   ```

---

## Step 2: Create or enable Private IP on Cloud SQL

### Option A: New instance with private IP only

```bash
gcloud sql instances create INSTANCE_NAME \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --network=projects/PROJECT_ID/global/networks/default \
  --no-assign-ip
```

- Replace `INSTANCE_NAME` (e.g. `medusa-db`).
- `--no-assign-ip` = no public IP; only private IP in the VPC.

### Option B: Existing instance – add private IP

1. In **Cloud Console**: **SQL** → your instance → **Connections**.
2. Under **Network**, click **Set up connection** (or **Private IP**).
3. Select network: **default** (or your VPC).
4. Allocate an IP (or use the range from Step 1). Note the **Private IP** (e.g. `10.10.10.3`).
5. Save.

Or with gcloud (if the instance has no private IP yet):

```bash
gcloud sql instances patch INSTANCE_NAME \
  --network=projects/PROJECT_ID/global/networks/default
```

After this, note the instance **Private IP** (e.g. from Console or `gcloud sql instances describe INSTANCE_NAME --format='value(ipAddresses)'`).

---

## Step 3: Create a Serverless VPC Access connector

Cloud Run cannot reach private IPs unless it uses a connector that lives in your VPC.

1. **Create the connector** (in the same region as Cloud Run and, ideally, the DB):
   ```bash
   gcloud compute networks vpc-access connectors create medusa-vpc-conn \
     --region=us-central1 \
     --network=default \
     --range=10.8.0.0/28
   ```
   - Name must match: lowercase letters, numbers, hyphens; 2–25 chars (e.g. `medusa-vpc-conn`).
   - `--range` must be a free CIDR in your VPC (not overlapping with `10.10.10.0/24` or your subnets). `10.8.0.0/28` is often free in default VPCs.

2. **Verify:**
   ```bash
   gcloud compute networks vpc-access connectors describe medusa-vpc-conn --region=us-central1
   ```

---

## Step 4: Configure deploy/.env for private IP + VPC

1. **Get the private IP** of the instance (from Console or describe command above). Example: `10.10.10.3`.

2. **Edit `deploy/.env`:**
   ```bash
   # Private IP – Cloud Run reaches it via VPC connector
   DATABASE_URL=postgresql://medusa_app:YOUR_PASSWORD@10.10.10.3:5432/postgres
   PROJECT_ID=unifiedcommerce-487215
   REGION=us-central1
   REPO=medusa-grocery

   # Required for private IP: connector so Cloud Run can reach the VPC
   VPC_CONNECTOR=medusa-vpc-conn
   VPC_EGRESS=all-traffic
   ```
   - Encode `@` in the password as `%40` if needed (e.g. `pass@word` → `pass%40word`).
   - Use your actual private IP and password.

3. **Do not set** `CLOUD_SQL_INSTANCE` when using private IP (that is for the Auth Proxy / public path). Use either private IP + VPC connector **or** Auth Proxy, not both for the same deploy.

---

## Step 5: Re-enable VPC connector in the deploy script

The deploy script must pass the connector to Cloud Run. Ensure `deploy/deploy-backend.sh` includes something like:

```bash
if [[ -n "${VPC_CONNECTOR:-}" ]]; then
  echo "Using VPC connector: $VPC_CONNECTOR (required for private IP database)"
  DEPLOY_ARGS+=(--vpc-connector "$VPC_CONNECTOR")
  DEPLOY_ARGS+=(--vpc-egress "${VPC_EGRESS:-all-traffic}")
fi
```

If that block is missing, add it back (see “Restore VPC connector in deploy” below).

---

## Step 6: Deploy the backend

1. **Grant Cloud SQL Client** to the Cloud Run service account (if not already done):
   ```bash
   ./deploy/grant-cloudsql-client.sh
   ```
   (Not needed for private IP connectivity, but useful if you later switch to Auth Proxy.)

2. **Deploy:**
   ```bash
   ./deploy/deploy-backend.sh
   ```
   The script will attach the VPC connector; the container will reach the DB at the private IP.

3. **Check logs** if the container fails to start:
   ```bash
   gcloud run services logs read medusa-backend --region=us-central1 --limit=50
   ```
   Or: `./deploy/trace-backend-logs.sh`

---

## Connecting from outside (e.g. your laptop)

Private IP is only reachable from inside the VPC (or via the VPC connector from Cloud Run). To connect from your machine:

### Option 1: Cloud SQL Auth Proxy (recommended)

The proxy runs on your laptop and connects to the instance over a secure channel; no need to open the DB to the internet.

```bash
# Download proxy if needed: https://cloud.google.com/sql/docs/postgres/connect-auth-proxy#install
cloud-sql-proxy PROJECT_ID:us-central1:INSTANCE_NAME
```

Then connect to `localhost:5432` and use:

```bash
DATABASE_URL=postgresql://medusa_app:PASSWORD@127.0.0.1:5432/postgres
```

### Option 2: Bastion / VM in the VPC

- Create a small VM in the same VPC as Cloud SQL.
- SSH into it and run `psql` or your app there, or use SSH tunneling (e.g. `gcloud compute ssh BASTION -- -L 5432:PRIVATE_IP:5432`).

---

## Summary checklist

| Step | Action |
|------|--------|
| 1 | Allocate private services range and run `gcloud services vpc-peerings connect` |
| 2 | Create Cloud SQL with private IP or add private IP to existing instance; note the private IP |
| 3 | Create Serverless VPC Access connector (`medusa-vpc-conn`) in the same region |
| 4 | Set `DATABASE_URL` (private IP), `VPC_CONNECTOR`, `VPC_EGRESS` in `deploy/.env` |
| 5 | Ensure `deploy-backend.sh` adds `--vpc-connector` and `--vpc-egress` when `VPC_CONNECTOR` is set |
| 6 | Run `./deploy/deploy-backend.sh` and verify logs |

---

## Restore VPC connector in deploy (if missing)

If `deploy-backend.sh` does not attach the VPC connector when `VPC_CONNECTOR` is set, add this **after** the existing `DEPLOY_ARGS` block and **before** `gcloud run deploy`:

```bash
if [[ -n "${VPC_CONNECTOR:-}" ]]; then
  echo "Using VPC connector: $VPC_CONNECTOR (required for private IP database)"
  DEPLOY_ARGS+=(--vpc-connector "$VPC_CONNECTOR")
  DEPLOY_ARGS+=(--vpc-egress "${VPC_EGRESS:-all-traffic}")
fi
```

Then redeploy with `./deploy/deploy-backend.sh`.
