#!/bin/bash
# Seed recipe data (recipes, steps, ingredients) into the Medusa database (e.g. Cloud SQL).
# Requires: Cloud SQL Proxy running + DATABASE_URL.
# If recipe tables don't exist, run migrations first: ./deploy/run-migrations.sh (or npx medusa migrations run from unifiedcommerce-grocery-store).
#
# Usage:
#   Terminal 1: cloud-sql-proxy --port 5433 PROJECT_ID:us-central1:medusa-db
#   Terminal 2:
#     export DATABASE_URL="postgresql://medusa_app:YOUR_PASSWORD@127.0.0.1:5433/medusa_grocery_store"
#     ./deploy/run-recipe-seed.sh
#
# If password contains @, use %40 (e.g. pass%401 for pass@1).

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
  echo "    ./deploy/run-recipe-seed.sh"
  echo ""
  echo "  If password contains @, use %40 instead (e.g. pass%401 -> pass@1)"
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
    echo "ERROR: Cannot connect to 127.0.0.1:$PORT"
    echo "  Cloud SQL Proxy must be running first."
    exit 1
  fi
fi

cd "$BACKEND_DIR"
echo "Seeding recipe data (from $BACKEND_DIR)..."
npx medusa exec ./src/scripts/seed-recipe.ts

echo "Recipe seed completed successfully."
