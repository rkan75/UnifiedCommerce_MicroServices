#!/usr/bin/env bash
set -e
PORT=8088
export ADMIN_JWT_SECRET=43c165c91c29d4762ea3e3171056e933d65fc7381a3cf8036f7a126cebf3e1fb
export JWT_SECRET="${JWT_SECRET:-$ADMIN_JWT_SECRET}"
# Invite / password-reset links (override for production)
export AUTH_PUBLIC_BASE_URL="${AUTH_PUBLIC_BASE_URL:-http://localhost:9010}"

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
