#!/bin/bash
# Upload data/products-for-algolia.json to the Algolia "products" index.
# No database needed – only the JSON file and Algolia credentials.
#
# Usage:
#   export ALGOLIA_APP_ID=your_app_id
#   export ALGOLIA_ADMIN_API_KEY=your_admin_api_key
#   ./deploy/run-upload-products-json-to-algolia.sh
#
# Optional: JSON_FILE=data/other.json, ALGOLIA_INDEX_NAME=products

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../unifiedcommerce-grocery-store" && pwd)"

if [[ -z "$ALGOLIA_APP_ID" || -z "$ALGOLIA_ADMIN_API_KEY" ]]; then
  echo "ERROR: ALGOLIA_APP_ID and ALGOLIA_ADMIN_API_KEY are required."
  echo "  Get them from https://dashboard.algolia.com/ → API Keys (use Admin API key)."
  exit 1
fi

cd "$BACKEND_DIR"
if [[ ! -f "data/products-for-algolia.json" ]]; then
  echo "ERROR: data/products-for-algolia.json not found."
  echo "  Generate it first: run ./deploy/run-algolia-export.sh (with DATABASE_URL and Algolia env set)."
  exit 1
fi

echo "Uploading products-for-algolia.json to Algolia index 'products'..."
npx ts-node src/scripts/upload-products-json-to-algolia.ts

echo "Done."
