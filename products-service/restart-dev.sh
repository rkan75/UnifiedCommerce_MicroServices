#!/usr/bin/env bash
# Check if port 8082 is in use; if so, kill the process, then start the products service.
# Loads .env if present (CATALOG_* / SPRING_DATASOURCE_* — see .env.example).

set -e
PORT=8082

if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

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

exec bash ./mvnw spring-boot:run
