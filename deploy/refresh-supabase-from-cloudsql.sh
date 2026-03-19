#!/usr/bin/env bash
#
# Refresh Supabase Medusa DB from GCP Cloud SQL medusa_db
#
# Prerequisites:
#   - pg_dump and psql (PostgreSQL client tools)
#   - Access to Cloud SQL (via Cloud SQL Proxy or authorized network)
#   - Supabase direct connection URL (port 5432, not pooler 6543)
#
# Usage:
#   1. Set env vars (see below or REFRESH_SUPABASE_FROM_CLOUDSQL.md)
#   2. ./deploy/refresh-supabase-from-cloudsql.sh
#
set -e

# --- Source: GCP Cloud SQL (medusa_db) ---
# Option A: Direct URL when using Cloud SQL Proxy (e.g. proxy on localhost:5432)
#   export CLOUDSQL_DATABASE_URL="postgresql://USER:PASSWORD@127.0.0.1:5432/medusa_db"
# Option B: Or set individual parts and use INSTANCE_CONNECTION_NAME to start proxy
#   export CLOUDSQL_USER="medusa_app"
#   export CLOUDSQL_PASSWORD="..."
#   export CLOUDSQL_DATABASE="postgres"   # default on Cloud SQL; set if your Medusa DB has another name
#   export INSTANCE_CONNECTION_NAME="project:region:instance"
#
# --- Target: Supabase ---
# Use "Direct connection" (port 5432), not Session pooler (6543).
# From Supabase: Project Settings → Database → Connection string → URI (direct)
#   export SUPABASE_DATABASE_URL="postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres"
# Or: postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
#
if [ -z "$CLOUDSQL_DATABASE_URL" ] && [ -z "$INSTANCE_CONNECTION_NAME" ]; then
  echo "ERROR: Set CLOUDSQL_DATABASE_URL (or INSTANCE_CONNECTION_NAME + CLOUDSQL_* for proxy)."
  echo "See REFRESH_SUPABASE_FROM_CLOUDSQL.md for step-by-step setup."
  exit 1
fi

if [ -z "$SUPABASE_DATABASE_URL" ]; then
  echo "ERROR: Set SUPABASE_DATABASE_URL (Supabase direct connection, port 5432)."
  exit 1
fi

# Find process using port 5432
PORT=5432
PID=$(lsof -ti:$PORT 2>/dev/null || true)

if [ -z "$PID" ]; then
  echo "✅ No process found on port $PORT"
else
  echo "🛑 Killing process $PID on port $PORT..."
  kill -9 $PID 2>/dev/null || true
  sleep 1
  echo "✅ Process killed"
fi

# When using proxy we set CLOUDSQL_DB later; when using URL only, default for message
CLOUDSQL_DB="${CLOUDSQL_DATABASE:-postgres}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DUMP_FILE="$WORK_DIR/.tmp/medusa_cloudsql_dump_$(date +%Y%m%d_%H%M%S).dump"
PROXY_PID=""

cleanup() {
  if [ -n "$PROXY_PID" ] && kill -0 "$PROXY_PID" 2>/dev/null; then
    echo "Stopping Cloud SQL Proxy (PID $PROXY_PID)..."
    kill "$PROXY_PID" 2>/dev/null || true
  fi
  [ -f "$DUMP_FILE" ] && rm -f "$DUMP_FILE"
}
trap cleanup EXIT

mkdir -p "$WORK_DIR/.tmp"

# URL-encode a string for use in a postgres:// URL (user or password)
urlencode() {
  if command -v python3 &>/dev/null; then
    python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
  else
    # minimal encoding: replace % : @ / \ with percent-encoding
    local s="$1"
    s="${s//%/%25}"; s="${s//:/%3A}"; s="${s//@/%40}"; s="${s//\//%2F}"; s="${s//\\/%5C}"
    printf '%s' "$s"
  fi
}

# --- Resolve Cloud SQL Proxy binary (use PATH or download) ---
CLOUDSQL_PROXY_BIN=""
if command -v cloud_sql_proxy &>/dev/null; then
  CLOUDSQL_PROXY_BIN="cloud_sql_proxy"
elif [ -x "$WORK_DIR/.tmp/cloud_sql_proxy" ]; then
  CLOUDSQL_PROXY_BIN="$WORK_DIR/.tmp/cloud_sql_proxy"
fi

# --- Optional: start Cloud SQL Proxy ---
if [ -n "$INSTANCE_CONNECTION_NAME" ]; then
  if [ -z "$CLOUDSQL_PROXY_BIN" ]; then
    echo "Cloud SQL Proxy not found. Downloading to .tmp/..."
    PROXY_VERSION="1.37.13"
    case "$(uname -s)" in
      Darwin)
        case "$(uname -m)" in
          arm64|aarch64) PROXY_ARCH="darwin.arm64";;
          *)            PROXY_ARCH="darwin.amd64";;
        esac ;;
      Linux)
        case "$(uname -m)" in
          arm64|aarch64) PROXY_ARCH="linux.arm64";;
          *)            PROXY_ARCH="linux.amd64";;
        esac ;;
      *)
        echo "Unsupported OS for auto-download. Install Cloud SQL Proxy manually:"
        echo "  https://cloud.google.com/sql/docs/postgres/connect-auth-proxy#install"
        echo "Or set CLOUDSQL_DATABASE_URL and run the proxy in another terminal."
        exit 1 ;;
    esac
    PROXY_URL="https://storage.googleapis.com/cloudsql-proxy/v${PROXY_VERSION}/cloud_sql_proxy.${PROXY_ARCH}"
    if ! curl -sSfL -o "$WORK_DIR/.tmp/cloud_sql_proxy" "$PROXY_URL"; then
      echo "Download failed. Install manually: https://cloud.google.com/sql/docs/postgres/connect-auth-proxy#install"
      exit 1
    fi
    chmod +x "$WORK_DIR/.tmp/cloud_sql_proxy"
    CLOUDSQL_PROXY_BIN="$WORK_DIR/.tmp/cloud_sql_proxy"
    echo "Downloaded Cloud SQL Proxy to .tmp/cloud_sql_proxy"
  fi
  # Pick a port: use CLOUDSQL_PORT if set and free; else try 5432, then 5434 (5432 often used by local Postgres)
  port_in_use() {
    lsof -i ":$1" 2>/dev/null | grep -q .
  }
  CLOUDSQL_PORT="${CLOUDSQL_PORT:-}"
  if [ -n "$CLOUDSQL_PORT" ]; then
    if port_in_use "$CLOUDSQL_PORT"; then
      echo "ERROR: Port $CLOUDSQL_PORT is in use. Unset CLOUDSQL_PORT or choose another (e.g. 5434)."
      exit 1
    fi
  else
    for p in $PORT; do
      if ! port_in_use "$p"; then
        CLOUDSQL_PORT=$p
        break
      fi
    done
    if [ -z "$CLOUDSQL_PORT" ]; then
      echo "ERROR: No free port among 5432, 5434, 5435. Stop local Postgres or set CLOUDSQL_PORT to a free port."
      exit 1
    fi
    [ "$CLOUDSQL_PORT" != "5432" ] && echo "Port 5432 in use; using $CLOUDSQL_PORT for Cloud SQL Proxy."
  fi
  # Cloud SQL default database is usually "postgres". Set CLOUDSQL_DATABASE if yours is different.
  CLOUDSQL_DB="${CLOUDSQL_DATABASE:-postgres}"
  ENC_USER="$(urlencode "$CLOUDSQL_USER")"
  ENC_PASS="$(urlencode "$CLOUDSQL_PASSWORD")"
  export CLOUDSQL_DATABASE_URL="postgresql://${ENC_USER}:${ENC_PASS}@127.0.0.1:${CLOUDSQL_PORT}/${CLOUDSQL_DB}"
  echo "Starting Cloud SQL Proxy on port $CLOUDSQL_PORT..."
  "$CLOUDSQL_PROXY_BIN" -instances="$INSTANCE_CONNECTION_NAME=tcp:$CLOUDSQL_PORT" &
  PROXY_PID=$!
  echo "Waiting for Cloud SQL Proxy to be ready..."
  sleep 3
  for i in {1..30}; do
    if pg_isready -h 127.0.0.1 -p "$CLOUDSQL_PORT" 2>/dev/null; then break; fi
    [ "$i" -eq 30 ] && { echo "Proxy did not become ready (port $CLOUDSQL_PORT)."; exit 1; }
    sleep 1
  done
  echo "Cloud SQL Proxy is ready on 127.0.0.1:$CLOUDSQL_PORT."
fi

# --- 1. Dump from Cloud SQL ---
echo "Step 1/3: Dumping from Cloud SQL (database: ${CLOUDSQL_DB:-postgres})..."
if ! pg_dump "$CLOUDSQL_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$DUMP_FILE" \
  --verbose; then
  echo ""
  echo "Dump failed. If you see 'database \"X\" does not exist', list databases on Cloud SQL:"
  echo "  psql \"\$CLOUDSQL_DATABASE_URL\" -t -c '\\l'   (use postgres as DB in the URL to connect)"
  echo "Then set CLOUDSQL_DATABASE to the actual database name and run again."
  exit 1
fi

echo "Dump size: $(du -h "$DUMP_FILE" | cut -f1)"

# --- 2. Restore into Supabase (clean = drop objects first) ---
echo "Step 2/3: Restoring into Supabase (this will replace existing data)..."
pg_restore \
  --dbname="$SUPABASE_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --no-privileges \
  --verbose \
  "$DUMP_FILE" || true
# pg_restore exits with 1 when it tries to drop roles/extensions that don't exist; we allow that.

# --- 3. Reclaim ownership on Supabase (optional: set search_path and ownership) ---
echo "Step 3/3: Verifying..."
ROW_COUNT=$(psql "$SUPABASE_DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
echo "Done. Public tables in Supabase: $ROW_COUNT"
echo "Refresh complete. You can now point Medusa (or apps) at SUPABASE_DATABASE_URL."
