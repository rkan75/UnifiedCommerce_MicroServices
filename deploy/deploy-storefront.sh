#!/bin/bash
# Deploy Medusa storefront (Next.js) to Cloud Run
# Uses current gcloud project. Set env vars or pass as arguments.
#
# Prerequisites:
#   1. Deploy backend first (e.g. ./deploy/deploy-backend.sh)
#   2. Build the storefront image (Algolia is baked in at build time)
#
# --- Deploy WITH Algolia (build + deploy in one step) ---
#   Use build-and-deploy-storefront.sh and pass Algolia parameters:
#
#   # Default Algolia values are in the script; override if needed:
#   ./deploy/build-and-deploy-storefront.sh
#
#   # Or pass your own Algolia credentials:
#   NEXT_PUBLIC_ALGOLIA_APP_ID=your_app_id \
#   NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=your_search_only_key \
#   NEXT_PUBLIC_ALGOLIA_INDEX_NAME=products \
#   ./deploy/build-and-deploy-storefront.sh
#
# --- Deploy only (image already built with Algolia) ---
#   ./deploy/deploy-storefront.sh
#   MEDUSA_BACKEND_URL=https://medusa-backend-xxx.run.app ./deploy/deploy-storefront.sh
#
# Note: Algolia (NEXT_PUBLIC_ALGOLIA_*) are BUILD-TIME variables. They cannot be
#       set when running deploy-storefront.sh; they must be in the image from build.

set -e

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
REPO="${REPO:-medusa-grocery}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/storefront:latest"

# Backend API URL - required. Auto-detected if backend is deployed in same project/region
if [[ -z "$MEDUSA_BACKEND_URL" ]]; then
  MEDUSA_BACKEND_URL=$(gcloud run services describe medusa-backend \
    --region "${REGION}" \
    --format 'value(status.url)' 2>/dev/null || true)
fi
if [[ -z "$MEDUSA_BACKEND_URL" ]]; then
  echo "Error: MEDUSA_BACKEND_URL not set. Deploy backend first, then:"
  echo "  export MEDUSA_BACKEND_URL=\$(gcloud run services describe medusa-backend --region $REGION --format 'value(status.url)')"
  echo "  ./deploy/deploy-storefront.sh"
  exit 1
fi

# Publishable API key from Medusa Admin → Settings → Publishable API Keys
# Must match the key used when building the image
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY="${NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY:-pk_f8e261468637babef6c09293ce362076755f516c3fd5fb40355e8b90c964eb42}"

# Storefront URL - update after first deploy, then redeploy with correct CORS on backend
STOREFRONT_URL="${STOREFRONT_URL:-}"

# Algolia parameters (optional - for reference/documentation)
# NOTE: These are BUILD-TIME variables and must be set during image build, not here.
# They are included here for documentation purposes only.
# To set Algolia during build, use:
#   NEXT_PUBLIC_ALGOLIA_APP_ID=xxx NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=yyy ./deploy/build-and-deploy-storefront.sh
# Or override in cloudbuild.yaml via --substitutions
NEXT_PUBLIC_ALGOLIA_APP_ID="${NEXT_PUBLIC_ALGOLIA_APP_ID:-}"
NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY="${NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY:-}"
NEXT_PUBLIC_ALGOLIA_INDEX_NAME="${NEXT_PUBLIC_ALGOLIA_INDEX_NAME:-products}"

echo "Deploying storefront to project: $PROJECT_ID"
echo "Backend URL: $MEDUSA_BACKEND_URL"
echo "Image: $IMAGE"
if [[ -n "$NEXT_PUBLIC_ALGOLIA_APP_ID" ]]; then
  echo "Note: Algolia vars detected in environment, but they are BUILD-TIME only."
  echo "      Ensure image was built with these values, or rebuild with:"
  echo "      NEXT_PUBLIC_ALGOLIA_APP_ID=$NEXT_PUBLIC_ALGOLIA_APP_ID NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=*** ./deploy/build-and-deploy-storefront.sh"
fi

# Use YAML env file (NEXT_PUBLIC_ALGOLIA_* are build-time only, not runtime)
ENV_FILE=$(mktemp).yaml
trap "rm -f $ENV_FILE" EXIT
cat > "$ENV_FILE" << EOF
HOST: "0.0.0.0"
MEDUSA_BACKEND_URL: "$MEDUSA_BACKEND_URL"
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: "$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY"
EOF

# Add NEXT_PUBLIC_BASE_URL if storefront URL is known (for canonical URLs, etc.)
if [[ -n "$STOREFRONT_URL" ]]; then
  echo "NEXT_PUBLIC_BASE_URL: \"$STOREFRONT_URL\"" >> "$ENV_FILE"
fi

# Next.js standalone runs on port 8000; startup is fast
gcloud run deploy medusa-storefront \
  --image "$IMAGE" \
  --platform managed \
  --region "$REGION" \
  --port 8000 \
  --memory 512Mi \
  --timeout 300 \
  --startup-probe "tcpSocket.port=8000,initialDelaySeconds=10,periodSeconds=10,failureThreshold=3,timeoutSeconds=5" \
  --env-vars-file "$ENV_FILE" \
  --allow-unauthenticated

echo ""
echo "Deployment complete!"
echo "Storefront URL: $(gcloud run services describe medusa-storefront --region ${REGION} --format 'value(status.url)' 2>/dev/null || echo 'Check Cloud Run console')"
echo ""
echo "Notes:"
echo "  - Backend CORS (STORE_CORS, AUTH_CORS) is configured in deploy-backend.sh to include both"
echo "    the custom domain (https://unifiedomnichannel.com) and the Cloud Run storefront URL."
echo "  - Algolia search: NEXT_PUBLIC_ALGOLIA_* variables are BUILD-TIME only."
echo "    If Algolia is not working, rebuild the image with Algolia parameters:"
echo "    NEXT_PUBLIC_ALGOLIA_APP_ID=xxx NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=yyy ./deploy/build-and-deploy-storefront.sh"
