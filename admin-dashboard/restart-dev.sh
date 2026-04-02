#!/usr/bin/env bash
# Exit 137 from spring-boot:run = process received SIGKILL (often macOS OOM, or kill -9 on the port).
# Raise heap if the JVM dies under load: export MAVEN_OPTS="-Xmx768m" before running this script.
set -e
PORT=9010

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
# Match admin-rbac-service/restart-dev.sh when .env has no JWT (session + /admin/me validation)
export JWT_SECRET="${JWT_SECRET:-${ADMIN_JWT_SECRET:-43c165c91c29d4762ea3e3171056e933d65fc7381a3cf8036f7a126cebf3e1fb}}"

if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "Port $PORT in use. Killing process(es): $PIDS"
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
fi
export MAVEN_OPTS="${MAVEN_OPTS:--Xmx512m}"

if [ -f ./mvnw ]; then
  exec bash ./mvnw spring-boot:run
elif command -v mvn >/dev/null 2>&1; then
  exec mvn spring-boot:run
else
  echo "Neither ./mvnw nor mvn found. From this directory run: chmod +x ./mvnw" >&2
  exit 1
fi
