#!/bin/bash
# Grant Cloud SQL Client to the service account used by medusa-backend (fixes "Cloud SQL connection failed...3307...timed out").
# Run once: ./deploy/grant-cloudsql-client.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$SCRIPT_DIR/.env" ]] && set -a && source "$SCRIPT_DIR/.env" && set +a

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Error: PROJECT_ID not set. Set it in deploy/.env or run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

# Service account used by Cloud Run (if custom SA is set, use it; else default compute SA)
RUN_SA=$(gcloud run services describe medusa-backend --region="$REGION" --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)
if [[ -z "$RUN_SA" ]]; then
  PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)' 2>/dev/null || true)
  if [[ -z "$PROJECT_NUMBER" ]]; then
    echo "Error: Could not get project number for $PROJECT_ID"
    exit 1
  fi
  RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  echo "Cloud Run uses default compute SA: $RUN_SA"
else
  echo "Cloud Run service account: $RUN_SA"
fi

echo "Granting roles/cloudsql.client to $RUN_SA ..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUN_SA}" \
  --role="roles/cloudsql.client"

echo ""
echo "Done. Redeploy the backend so the proxy can connect:"
echo "  ./deploy/deploy-backend.sh"
