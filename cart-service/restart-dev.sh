#!/usr/bin/env bash
# Check if port 8083 is in use; if so, kill the process, then start the cart service.
# Loads .env from this directory when present (SPRING_DATASOURCE_URL, credentials, etc.).

set -e
cd "$(dirname "$0")"

# DATABASE_URL from store .env only (do not source whole file — DATABASE_EXTRA JSON breaks bash)
# shellcheck source=/dev/null
source "$(dirname "$0")/scripts/load-database-url-from-file.sh"
load_database_url_from_file "../unifiedcommerce-store/.env"
if [ -z "${SPRING_DATASOURCE_URL:-}" ] && [ -n "${DATABASE_URL:-}" ]; then
  eval "$(node scripts/database-url-to-spring.mjs)"
fi

# cart-service/.env overrides Medusa-derived values
if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

PORT=8083

if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "Port $PORT is in use. Killing process(es): $PIDS"
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
else
  echo "Warning: lsof not found; skipping port check."
fi

exec ./mvnw spring-boot:run
