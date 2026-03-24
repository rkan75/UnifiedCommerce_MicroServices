#!/usr/bin/env bash
# Verify cart tables exist in the same DB the cart service uses (same credentials as .env).
# Run from repo root: ./cart-service/verify-cart-tables.sh
# Or from cart-service: ./verify-cart-tables.sh (loads ../.env)

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a && source "$REPO_ROOT/.env" && set +a
fi

# Parse JDBC URL if set
DB_HOST="127.0.0.1"
DB_PORT="5433"
DB_NAME="grocery_store"
DB_USER="${SPRING_DATASOURCE_USERNAME:-grocery_app}"
if [[ -n "$SPRING_DATASOURCE_URL" ]] && [[ "$SPRING_DATASOURCE_URL" =~ .*postgresql://([^:/]+):([0-9]+)/([^?]+) ]]; then
  DB_HOST="${BASH_REMATCH[1]}"
  DB_PORT="${BASH_REMATCH[2]}"
  DB_NAME="${BASH_REMATCH[3]}"
fi

export PGPASSWORD="${SPRING_DATASOURCE_PASSWORD:-}"

if [[ -z "$PGPASSWORD" ]]; then
  echo "Set SPRING_DATASOURCE_PASSWORD in repo root .env (or export PGPASSWORD) and run again."
  exit 1
fi

echo "Checking cart tables at $DB_HOST:$DB_PORT/$DB_NAME as $DB_USER ..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPT_DIR/verify-cart-tables.sql"
echo "Done. If you saw 4 rows above, tables exist and the cart service can use this DB."
