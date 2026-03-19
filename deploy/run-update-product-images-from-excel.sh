#!/bin/bash
# Update product images and prices in the database from data/products-images-scraped.xlsx.
# Reads Product, Thumbnail URL, Image URL 1-3, and Price columns.
# Requires: Cloud SQL Proxy running + DATABASE_URL. Excel file in unifiedcommerce-grocery-store/data/.
#
# Usage:
#   Terminal 1: cloud-sql-proxy --port 5433 PROJECT_ID:us-central1:medusa-db
#   Terminal 2:
#     export DATABASE_URL="postgresql://medusa_app:YOUR_PASSWORD@127.0.0.1:5433/medusa_grocery_store"
#     ./deploy/run-update-product-images-from-excel.sh
#
# If password contains @, use %40. Optional: EXCEL_FILE=data/other.xlsx

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../unifiedcommerce-grocery-store" && pwd)"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is required."
  echo "  Start Cloud SQL Proxy, then export DATABASE_URL and run this script."
  exit 1
fi

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
    echo "ERROR: Cannot connect to 127.0.0.1:$PORT. Start Cloud SQL Proxy first."
    exit 1
  fi
fi

cd "$BACKEND_DIR"
echo "Updating product images and prices from data/products-images-scraped.xlsx..."
npx medusa exec ./src/scripts/update-product-images-from-excel.ts

echo "Done."
