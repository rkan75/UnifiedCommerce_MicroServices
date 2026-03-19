# Backend (Cloud Run) deploy: why it’s slow and how to trace errors

## Why the backend can take a long time (or time out)

1. **Cold start** – First request or new revision: Node loads, Medusa loads modules, DB connection, optional migrations. Can easily be 1–3+ minutes.
2. **Database connection** – If `DATABASE_URL` points to Cloud SQL:
   - Without a VPC connector / private IP, the container may be using the public IP. That can be slow or blocked.
   - With Cloud SQL Auth Proxy (`/cloudsql/...`), the proxy must be configured and the instance must be in the same project/region (or correctly shared). Wrong config → long timeouts then failure.
3. **Startup probe** – Cloud Run waits `initialDelaySeconds` (max 240s) before the first health check, then checks every `periodSeconds` up to `failureThreshold` times. The container must listen on the configured port (9000) before the probe succeeds.
4. **Resource limits** – 2 vCPU / 2Gi is usually enough; if the process is swapping or CPU-throttled, startup can be slower.

## How to trace and find errors

### 1. Stream Cloud Run logs (best first step)

From the repo root:

```bash
# Stream logs (live) — use one of:
# Option A: Cloud Console → Cloud Run → medusa-backend → Logs
# Option B: gcloud beta (tail is only in beta)
gcloud beta logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=medusa-backend"

# Or use the helper script (recent logs + revision status)
./deploy/trace-backend-logs.sh
./deploy/trace-backend-logs.sh --revisions   # show revision status then logs
./deploy/trace-backend-logs.sh --revisions-only   # only revision status
```

In the logs, look for:

- **Success**: `Listening on port 9000` or similar.
- **DB**: `connection refused`, `timeout`, `ECONNREFUSED`, `password authentication failed` → fix `DATABASE_URL` and/or Cloud SQL.
- **Migrations**: Long run of migrations is normal once; if they fail, you’ll see the error in the log.
- **Module/import errors**: Stack traces pointing to missing or misconfigured modules.

### 2. Check revision status

```bash
gcloud run revisions list --service medusa-backend --region us-central1 --limit 5
```

See which revision is serving traffic and whether the latest revision is healthy.

### 3. Inspect the service and recent revisions

```bash
gcloud run services describe medusa-backend --region us-central1
```

Check `status.conditions` and the image/port/env in the template.

### 4. Logs in Google Cloud Console

1. **Cloud Run** → select **medusa-backend** → **Logs**.
2. Filter by severity (Error, Warning) or search for `error`, `ECONNREFUSED`, `timeout`, `listen`.

### 5. Request logs showing ERROR / payloadNotSet

When the backend returns **5xx** (e.g. 503 because the DB is unreachable and the placeholder server is running), Cloud Run logs each request with **severity ERROR**. The `payload: "payloadNotSet"` means the log entry has no custom payload—that’s normal for request logs. To reduce ERROR noise from health checks, the placeholder server returns **200** for `GET /health` with a JSON body like `{"status":"degraded","database":"unreachable"}`; other paths still return 503 until the DB is reachable and Medusa is running.

### 6. Confirm DATABASE_URL and networking

- **Cloud SQL (public IP)** – The instance must have “public IP” and authorized networks (or IAM auth) and a reachable host in `DATABASE_URL`.
- **Cloud SQL Auth Proxy / Unix socket** – `?host=/cloudsql/PROJECT:REGION:INSTANCE` only works when the Cloud SQL Proxy sidecar is configured (add Cloud SQL instance to the Cloud Run service). Otherwise the process will hang or timeout connecting.
- Use a `DATABASE_URL` that Cloud Run can reach without a VPC connector (e.g. Cloud SQL public IP or Proxy).
- **Cloud SQL public IP (35.x.x.x)** – Connection will time out unless the instance allows your client. In **Cloud Console → SQL → your instance → Connections → Networking → Authorized networks**, add **0.0.0.0/0** (or restrict to [Cloud Run egress IPs](https://cloud.google.com/run/docs/securing/egress)) then redeploy.
- **Cloud SQL Auth Proxy (recommended)** – In `deploy/.env` set `CLOUD_SQL_INSTANCE=PROJECT:REGION:INSTANCE` and `DATABASE_URL=postgresql://user:pass@/dbname?host=/cloudsql/PROJECT:REGION:INSTANCE`. Redeploy; the deploy script adds the instance to Cloud Run so no authorized networks are needed.

## Quick reference

| Goal                         | Command |
|-----------------------------|--------|
| Live log stream             | `gcloud beta logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=medusa-backend"` |
| Last N log lines            | `./deploy/trace-backend-logs.sh` or Cloud Console → Logs |
| Revision list               | `gcloud run revisions list --service medusa-backend --region us-central1` |
| Helper script               | `./deploy/trace-backend-logs.sh` |
