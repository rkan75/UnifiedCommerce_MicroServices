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
if [ -f ./mvnw ]; then
  exec bash ./mvnw spring-boot:run
elif command -v mvn >/dev/null 2>&1; then
  exec mvn spring-boot:run
else
  echo "Neither ./mvnw nor mvn found. From this directory run: chmod +x ./mvnw" >&2
  exit 1
fi
