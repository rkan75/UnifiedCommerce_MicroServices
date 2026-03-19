#!/bin/bash
# Add an authorized network to Cloud SQL so Cloud Run (or any client) can connect via public IP.
# Run once: ./deploy/add-cloudsql-authorized-network.sh
# Then redeploy: ./deploy/deploy-backend.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$SCRIPT_DIR/.env" ]] && set -a && source "$SCRIPT_DIR/.env" && set +a

INSTANCE="${1:-medusa-db}"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Error: PROJECT_ID not set. Set it in deploy/.env or: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "Adding authorized network 0.0.0.0/0 to Cloud SQL instance: $INSTANCE (project: $PROJECT_ID)"
echo "This allows Cloud Run to connect to the instance on port 5432."
echo ""

# This REPLACES existing authorized networks. If you have others, add them: --authorized-networks=0.0.0.0/0,10.0.0.0/8
gcloud sql instances patch "$INSTANCE" \
  --project="$PROJECT_ID" \
  --authorized-networks=0.0.0.0/0

echo ""
echo "Done. Redeploy the backend so it can connect:"
echo "  ./deploy/deploy-backend.sh"
