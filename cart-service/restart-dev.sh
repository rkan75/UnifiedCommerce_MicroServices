#!/usr/bin/env bash
# Check if port 8083 is in use; if so, kill the process, then start the cart service.

set -e
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
