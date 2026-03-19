#!/bin/bash

# Restart Next.js storefront dev server (with optional Algolia search).
# Algolia: set in .env.local (NEXT_PUBLIC_ALGOLIA_APP_ID, NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY,
# NEXT_PUBLIC_ALGOLIA_INDEX_NAME). Copy from .env.example if needed. Next.js loads .env.local automatically.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT=5433

echo "🔍 Checking for process on port $PORT..."

# Find process using port 8000
PID=$(lsof -ti:$PORT 2>/dev/null || true)

if [ -z "$PID" ]; then
  echo "✅ No process found on port $PORT"
else
  echo "🛑 Killing process $PID on port $PORT..."
  kill -9 $PID 2>/dev/null || true
  sleep 1
  echo "✅ Process killed"
fi


echo "🚀 Starting Cloud SQL Proxy (from $SCRIPT_DIR)..."
cloud-sql-proxy --port $PORT unifiedcommerce-487215:us-central1:medusa-db
