#!/bin/bash
# Seed Medusa database with demo data (products, regions, gift cards, etc.)
# Must be run AFTER migrations.
# Requires: DATABASE_URL and other env vars (see medusa-config.ts)
#
# Usage:
#   export DATABASE_URL="postgresql://medusa_app:PASSWORD@/medusa_grocery_store?host=/cloudsql/PROJECT:REGION:INSTANCE"
#   export JWT_SECRET="your-jwt-secret"
#   export COOKIE_SECRET="your-cookie-secret"
#   ./deploy/run-seed.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../unifiedcommerce-grocery-store" && pwd)"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is required"
  exit 1
fi

cd "$BACKEND_DIR"
echo "Running seed from $BACKEND_DIR..."
npx medusa exec ./src/scripts/seed.ts

echo "Seed completed successfully."
