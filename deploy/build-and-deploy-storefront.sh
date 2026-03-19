#!/bin/bash
# Build storefront image (with custom domain and Algolia) and deploy to Cloud Run
#
# Usage:
#   ./deploy/build-and-deploy-storefront.sh
#   NEXT_PUBLIC_BASE_URL=https://mysite.com ./deploy/build-and-deploy-storefront.sh
#   # Override Algolia (optional; defaults from cloudbuild.yaml used if not set):
#   NEXT_PUBLIC_ALGOLIA_APP_ID=xxx NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=yyy NEXT_PUBLIC_ALGOLIA_INDEX_NAME=products ./deploy/build-and-deploy-storefront.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Ensure gcloud is authenticated before submitting the build
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q .; then
  echo "ERROR: No active gcloud account selected."
  echo ""
  echo "To fix, run one of:"
  echo "  gcloud auth login          # log in and select an account"
  echo "  gcloud config set account ACCOUNT   # use an already logged-in account"
  echo ""
  echo "Then re-run this script."
  exit 1
fi

# Custom domain (baked into build; used for canonical URLs, OG tags, etc.)
NEXT_PUBLIC_BASE_URL="${NEXT_PUBLIC_BASE_URL:-https://unifiedomnichannel.com}"

# Algolia parameters (defaults from cloudbuild.yaml if not provided)
# These are BUILD-TIME variables required for search functionality
NEXT_PUBLIC_ALGOLIA_APP_ID="${NEXT_PUBLIC_ALGOLIA_APP_ID:-8UPZHDU2DT}"
NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY="${NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY:-869234ab00b84d5ec9fcc79f1ff48658}"
NEXT_PUBLIC_ALGOLIA_INDEX_NAME="${NEXT_PUBLIC_ALGOLIA_INDEX_NAME:-products}"

# Always pass Algolia parameters to the build (using defaults if not overridden)
ALGOLIA_SUBS=",_NEXT_PUBLIC_ALGOLIA_APP_ID=$NEXT_PUBLIC_ALGOLIA_APP_ID,_NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=$NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY,_NEXT_PUBLIC_ALGOLIA_INDEX_NAME=$NEXT_PUBLIC_ALGOLIA_INDEX_NAME"

echo "Building storefront with:"
echo "  NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL"
echo "  NEXT_PUBLIC_ALGOLIA_APP_ID=$NEXT_PUBLIC_ALGOLIA_APP_ID"
echo "  NEXT_PUBLIC_ALGOLIA_INDEX_NAME=$NEXT_PUBLIC_ALGOLIA_INDEX_NAME"
echo "  NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=*** (hidden)"

gcloud builds submit --config deploy/cloudbuild-storefront.yaml . \
  --substitutions="_NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL${ALGOLIA_SUBS}"

echo ""
echo "Deploying to Cloud Run..."
STOREFRONT_URL="$NEXT_PUBLIC_BASE_URL" ./deploy/deploy-storefront.sh
