#!/bin/bash
# Build backend + storefront images, then deploy backend and storefront to Cloud Run.
#
# Prerequisites:
#   - gcloud authenticated and project set
#   - DATABASE_URL set (Postgres for backend, e.g. Cloud SQL)
#
# Usage:
#   export DATABASE_URL="postgresql://user:pass@/db?host=/cloudsql/PROJECT:REGION:INSTANCE"
#   ./deploy/build-and-deploy-all.sh
#
#   # Skip image build (use existing images):
#   SKIP_BUILD=1 DATABASE_URL="..." ./deploy/build-and-deploy-all.sh
#
#   # Custom storefront URL (for CORS and NEXT_PUBLIC_BASE_URL):
#   STOREFRONT_URL=https://unifiedomnichannel.com DATABASE_URL="..." ./deploy/build-and-deploy-all.sh
#
#   # Override Algolia (build-time; baked into storefront image):
#   NEXT_PUBLIC_ALGOLIA_APP_ID=xxx NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=yyy ./deploy/build-and-deploy-all.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Load DATABASE_URL from env file if not set (try deploy/.env then repo .env)
if [[ -z "$DATABASE_URL" ]] && [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/.env"
  set +a
fi
if [[ -z "$DATABASE_URL" ]] && [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$REPO_ROOT/.env"
  set +a
fi

REGION="${REGION:-us-central1}"
STOREFRONT_URL="${STOREFRONT_URL:-https://unifiedomnichannel.com}"

# Storefront build-time args (Algolia + base URL; same defaults as build-and-deploy-storefront.sh)
NEXT_PUBLIC_BASE_URL="${NEXT_PUBLIC_BASE_URL:-$STOREFRONT_URL}"
NEXT_PUBLIC_ALGOLIA_APP_ID="${NEXT_PUBLIC_ALGOLIA_APP_ID:-8UPZHDU2DT}"
NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY="${NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY:-869234ab00b84d5ec9fcc79f1ff48658}"
NEXT_PUBLIC_ALGOLIA_INDEX_NAME="${NEXT_PUBLIC_ALGOLIA_INDEX_NAME:-products}"

# If DATABASE_URL still unset, we only build + deploy storefront (backend must already be deployed)
DEPLOY_BACKEND=1
if [[ -z "$DATABASE_URL" ]]; then
  DEPLOY_BACKEND=0
  echo "Note: DATABASE_URL not set. Skipping backend deploy (storefront only)."
  echo "      To deploy backend too, set DATABASE_URL in deploy/.env or export it."
fi

# 1) Build both images (unless skipped)
if [[ -z "$SKIP_BUILD" ]]; then
  echo "=== Building backend and storefront images ==="
  echo "  NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL"
  echo "  NEXT_PUBLIC_ALGOLIA_APP_ID=$NEXT_PUBLIC_ALGOLIA_APP_ID"
  echo "  NEXT_PUBLIC_ALGOLIA_INDEX_NAME=$NEXT_PUBLIC_ALGOLIA_INDEX_NAME"
  echo "  NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=*** (hidden)"
  BUILD_SUBS=",_NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL,_NEXT_PUBLIC_ALGOLIA_APP_ID=$NEXT_PUBLIC_ALGOLIA_APP_ID,_NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=$NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY,_NEXT_PUBLIC_ALGOLIA_INDEX_NAME=$NEXT_PUBLIC_ALGOLIA_INDEX_NAME"
  gcloud builds submit --config deploy/cloudbuild.yaml . \
    --substitutions="${BUILD_SUBS:1}"
else
  echo "=== Skipping build (SKIP_BUILD=1) ==="
fi

# 2) Deploy backend (only if DATABASE_URL is set)
if [[ "$DEPLOY_BACKEND" -eq 1 ]]; then
  echo ""
  echo "=== Deploying backend ==="
  "$SCRIPT_DIR/deploy-backend.sh"
fi

# 3) Get backend URL and deploy storefront
export MEDUSA_BACKEND_URL
MEDUSA_BACKEND_URL=$(gcloud run services describe medusa-backend \
  --region "${REGION}" \
  --format 'value(status.url)' 2>/dev/null || true)
if [[ -z "$MEDUSA_BACKEND_URL" ]]; then
  echo "Error: Could not get medusa-backend URL. Deploy backend first (set DATABASE_URL and run this script), or deploy backend manually."
  exit 1
fi
export STOREFRONT_URL
echo ""
echo "=== Deploying storefront ==="
"$SCRIPT_DIR/deploy-storefront.sh"

echo ""
echo "Done. Backend: $MEDUSA_BACKEND_URL"
echo "      Storefront: $(gcloud run services describe medusa-storefront --region ${REGION} --format 'value(status.url)' 2>/dev/null || echo 'Check Cloud Run')"
