#!/usr/bin/env bash
# Create commerce_cart and related tables. Uses same env as the app (see application.yml).
# Usage: ./run-schema.sh   (from cart-service directory)
# Or set: SPRING_DATASOURCE_URL, SPRING_DATASOURCE_USERNAME, SPRING_DATASOURCE_PASSWORD

set -e
cd "$(dirname "$0")"
# Use same DB as start-all.sh: load repo .env if present (SPRING_DATASOURCE_URL, etc.)
if [[ -f "../.env" ]]; then
  set -a && source "../.env" && set +a
fi

SCHEMA_FILE="src/main/resources/schema.sql"
if [[ ! -f "$SCHEMA_FILE" ]]; then
  echo "Schema file not found: $SCHEMA_FILE"
  exit 1
fi

# Parse JDBC URL if set (e.g. jdbc:postgresql://127.0.0.1:5433/grocery_store)
if [[ -n "$SPRING_DATASOURCE_URL" ]]; then
  if [[ "$SPRING_DATASOURCE_URL" =~ .*postgresql://([^:/]+):([0-9]+)/([^?]+) ]]; then
    DB_HOST="${BASH_REMATCH[1]}"
    DB_PORT="${BASH_REMATCH[2]}"
    DB_NAME="${BASH_REMATCH[3]}"
  fi
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5433}"
DB_NAME="${DB_NAME:-grocery_store}"
DB_USER="${SPRING_DATASOURCE_USERNAME:-grocery_app}"
export PGPASSWORD="${SPRING_DATASOURCE_PASSWORD:-UnifiedCommerce@1}"

echo "Running schema against $DB_HOST:$DB_PORT/$DB_NAME as $DB_USER ..."
echo "  (Cart service must use this same DB: jdbc:postgresql://$DB_HOST:$DB_PORT/$DB_NAME)"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCHEMA_FILE"
echo "Schema applied. Restart the cart service if it is already running."
