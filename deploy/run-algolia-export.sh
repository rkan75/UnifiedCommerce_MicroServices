#!/bin/bash
# Export products to Algolia index (writes JSON and optionally uploads).
# Requires: Cloud SQL Proxy running + DATABASE_URL.
#
# Usage:
#   Terminal 1: cloud-sql-proxy --port 5433 PROJECT_ID:us-central1:medusa-db
#   Terminal 2:
#     export DATABASE_URL="postgresql://medusa_app:YOUR_PASSWORD@127.0.0.1:5433/medusa_grocery_store"
#     export ALGOLIA_APP_ID=your_app_id          # required for upload to Algolia
#     export ALGOLIA_ADMIN_API_KEY=your_key     # required for upload (Admin API key)
#     ./deploy/run-algolia-export.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../unifiedcommerce-grocery-store" && pwd)"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is required."
  echo ""
  echo "  Terminal 1 - Start Cloud SQL Proxy:"
  echo "    cloud-sql-proxy --port 5433 YOUR_PROJECT_ID:us-central1:medusa-db"
  echo ""
  echo "  Terminal 2 - Run this script:"
  echo "    export DATABASE_URL=\"postgresql://medusa_app:YOUR_PASSWORD@127.0.0.1:5433/medusa_grocery_store\""
  echo "    ./deploy/run-algolia-export.sh"
  echo ""
  echo "  If password contains @, use %40 instead (e.g. pass%401 -> pass@1)"
  exit 1
fi

# If connecting via localhost/127.0.0.1, verify port is reachable
if echo "$DATABASE_URL" | grep -qE '@(127\.0\.0\.1|localhost)(:[0-9]+)?/'; then
  PORT=5433
  echo "$DATABASE_URL" | grep -qE ':([0-9]+)/' && PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
  if ! node -e "
    const net=require('net');
    const s=net.createConnection($PORT,'127.0.0.1');
    s.on('connect',()=>{s.destroy();process.exit(0)});
    s.on('error',()=>process.exit(1));
    s.setTimeout(3000,()=>{s.destroy();process.exit(1)});
  " 2>/dev/null; then
    echo "ERROR: Cannot connect to 127.0.0.1:$PORT"
    echo ""
    echo "  Cloud SQL Proxy must be running first. In another terminal:"
    echo "    cloud-sql-proxy --port $PORT YOUR_PROJECT_ID:us-central1:medusa-db"
    echo ""
    exit 1
  fi
fi

cd "$BACKEND_DIR"
if [[ -z "$ALGOLIA_APP_ID" || -z "$ALGOLIA_ADMIN_API_KEY" ]]; then
  echo "Note: ALGOLIA_APP_ID and ALGOLIA_ADMIN_API_KEY not set. Export will run but products will NOT be uploaded to Algolia (storefront search will stay empty/out of date)."
  echo ""
fi
echo "Exporting products to Algolia (from $BACKEND_DIR)..."
npx medusa exec ./src/scripts/algolia-export-products.ts

echo "Algolia export completed successfully."
