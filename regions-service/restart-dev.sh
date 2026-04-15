#!/usr/bin/env bash
# Check if port 8084 is in use; if so, kill the process, then start the regions service.

set -e
PORT=8084

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

[ -x "./mvnw" ] && exec ./mvnw spring-boot:run || exec mvn spring-boot:run
