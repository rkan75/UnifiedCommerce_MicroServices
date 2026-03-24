#!/usr/bin/env bash
set -e
PORT=8086
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "Port $PORT in use. Killing process(es): $PIDS"
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
fi
[ -x "./mvnw" ] && exec ./mvnw spring-boot:run || exec mvn spring-boot:run
