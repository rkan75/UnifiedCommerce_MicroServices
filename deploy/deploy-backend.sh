#!/bin/bash
# Deploy Medusa backend (API + Admin) to Cloud Run
# Uses the backend image from Artifact Registry (build with cloudbuild.yaml first).
#
# Prerequisites:
#   1. Build backend image: gcloud builds submit --config deploy/cloudbuild.yaml .
#   2. Set DATABASE_URL (required). Optionally set JWT_SECRET, COOKIE_SECRET, STORE_CORS, ADMIN_CORS, AUTH_CORS.
#
# Usage:
#   export DATABASE_URL="postgresql://user:pass@/db?host=/cloudsql/PROJECT:REGION:INSTANCE"
#   ./deploy/deploy-backend.sh
#
# If deploy is slow or fails: see deploy/BACKEND-DEPLOY-TROUBLESHOOTING.md
# Trace logs: ./deploy/trace-backend-logs.sh   or   gcloud run services logs tail medusa-backend --region us-central1
#
#   # With CORS for custom domain + Cloud Run storefront:
#   STORE_CORS="https://unifiedomnichannel.com,https://medusa-storefront-xxx.run.app" \
#   ADMIN_CORS="https://unifiedomnichannel.com,https://medusa-storefront-xxx.run.app" \
#   AUTH_CORS="https://unifiedomnichannel.com,https://medusa-storefront-xxx.run.app" \
#   DATABASE_URL="..." ./deploy/deploy-backend.sh
#
set -e

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
REPO="${REPO:-medusa-grocery}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/backend:latest"

# Load deploy/.env if present (for DATABASE_URL, PROJECT_ID, etc.)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/.env"
  set +a
fi

if [[ -z "$DATABASE_URL" ]]; then
  echo "Error: DATABASE_URL is required. Set it to your Postgres connection string (e.g. Cloud SQL)."
  echo "  export DATABASE_URL=\"postgresql://user:pass@/db?host=/cloudsql/PROJECT:REGION:INSTANCE\""
  echo "  ./deploy/deploy-backend.sh"
  exit 1
fi

# CORS: default to allow common origins; override with env
BACKEND_URL="https://medusa-backend-${REGION}.run.app"
STOREFRONT_DEFAULT="https://unifiedomnichannel.com"
STORE_CORS="${STORE_CORS:-$STOREFRONT_DEFAULT}"
ADMIN_CORS="${ADMIN_CORS:-$STOREFRONT_DEFAULT}"
AUTH_CORS="${AUTH_CORS:-$STOREFRONT_DEFAULT}"
JWT_SECRET="${JWT_SECRET:-supersecret}"
COOKIE_SECRET="${COOKIE_SECRET:-supersecret}"

echo "Deploying backend to project: $PROJECT_ID"
echo "Image: $IMAGE"
echo "Region: $REGION"

# Use env-vars-file to avoid escaping issues with DATABASE_URL (e.g. special chars in password)
ENV_FILE=$(mktemp).yaml
trap "rm -f $ENV_FILE" EXIT
# Do not set PORT - Cloud Run sets it automatically (reserved env name)
cat > "$ENV_FILE" << ENVEOF
DATABASE_URL: "$DATABASE_URL"
STORE_CORS: "$STORE_CORS"
ADMIN_CORS: "$ADMIN_CORS"
AUTH_CORS: "$AUTH_CORS"
JWT_SECRET: "$JWT_SECRET"
COOKIE_SECRET: "$COOKIE_SECRET"
NODE_ENV: "production"
HOST: "0.0.0.0"
ENVEOF

# Build deploy args
DEPLOY_ARGS=(
  --image "$IMAGE"
  --platform managed
  --region "$REGION"
  --port 9000
  --memory 2Gi
  --cpu 2
  --timeout 300
  --startup-probe="tcpSocket.port=9000,initialDelaySeconds=240,periodSeconds=10,failureThreshold=12,timeoutSeconds=5"
  --cpu-boost
  --env-vars-file "$ENV_FILE"
  --allow-unauthenticated
)
# Cloud SQL: only attach proxy when using socket URL. For PostgreSQL, Cloud Run's proxy wrongly uses port 3307 and fails.
# When using direct TCP (host:5432), we must CLEAR the Cloud SQL instances so the proxy is removed (otherwise it stays from a previous deploy).
if [[ -n "${CLOUD_SQL_INSTANCE:-}" ]] && [[ "$DATABASE_URL" == *"/cloudsql/"* ]]; then
  echo "Using Cloud SQL instance: $CLOUD_SQL_INSTANCE (socket URL)"
  DEPLOY_ARGS+=(--add-cloudsql-instances "$CLOUD_SQL_INSTANCE")
  # Cloud Run must use a service account with Cloud SQL Client to connect. Grant to default compute SA (used by Cloud Run if no custom SA).
  PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)' 2>/dev/null || true)
  if [[ -n "$PROJECT_NUMBER" ]]; then
    CLOUD_RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
    echo "Ensuring Cloud SQL Client role for $CLOUD_RUN_SA (required for Cloud Run → Cloud SQL)..."
    if ! gcloud projects add-iam-policy-binding "$PROJECT_ID" \
      --member="serviceAccount:${CLOUD_RUN_SA}" \
      --role="roles/cloudsql.client" \
      --quiet 2>/dev/null; then
      echo "Warning: Could not add Cloud SQL Client role. If you see 'Cloud SQL connection failed' after deploy, run:"
      echo "  gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:${CLOUD_RUN_SA} --role=roles/cloudsql.client"
    fi
  fi
else
  # Direct TCP to Cloud SQL (no proxy). Remove any previously attached Cloud SQL instances so the 3307 proxy is not used.
  echo "Using direct database connection (no Cloud SQL proxy). Clearing any existing Cloud SQL instances..."
  DEPLOY_ARGS+=(--clear-cloudsql-instances)
fi
# Private IP: use VPC connector so Cloud Run can reach DB in VPC (see deploy/CLOUD-SQL-PRIVATE-IP-VPC-GUIDE.md)
if [[ -n "${VPC_CONNECTOR:-}" ]]; then
  echo "Using VPC connector: $VPC_CONNECTOR (required for private IP database)"
  DEPLOY_ARGS+=(--vpc-connector "$VPC_CONNECTOR")
  DEPLOY_ARGS+=(--vpc-egress "${VPC_EGRESS:-all-traffic}")
fi
gcloud run deploy medusa-backend "${DEPLOY_ARGS[@]}"

echo ""
echo "Backend deployed."
echo "Backend URL: $(gcloud run services describe medusa-backend --region ${REGION} --format 'value(status.url)' 2>/dev/null || echo 'Check Cloud Run console')"
