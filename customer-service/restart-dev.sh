#!/usr/bin/env bash
set -e
# Load JWT_SECRET from .env if present (copy from .env.example and set JWT_SECRET)
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
PORT=8087
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "Port $PORT in use. Killing process(es): $PIDS"
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
fi
[ -x "./mvnw" ] && exec ./mvnw spring-boot:run || exec mvn spring-boot:run
