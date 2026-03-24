#!/usr/bin/env bash
set -e
PORT=8088
export ADMIN_JWT_SECRET=43c165c91c29d4762ea3e3171056e933d65fc7381a3cf8036f7a126cebf3e1fb


if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "Port $PORT in use. Killing process(es): $PIDS"
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
fi
[ -x "./mvnw" ] && exec ./mvnw spring-boot:run || exec mvn spring-boot:run
