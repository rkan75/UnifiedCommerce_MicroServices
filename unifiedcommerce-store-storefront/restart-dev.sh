#!/bin/bash

# Restart Next.js storefront dev server (with optional Algolia search).
#
# Algolia (pick one):
#   A) Set in .env.local – Next.js loads it when the dev server starts:
#        NEXT_PUBLIC_ALGOLIA_APP_ID=xxx
#        NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=yyy
#        NEXT_PUBLIC_ALGOLIA_INDEX_NAME=products
#      Then run: ./restart-dev.sh
#
#   B) Pass inline when restarting (overrides .env.local for this run):
#        NEXT_PUBLIC_ALGOLIA_APP_ID=xxx NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=yyy ./restart-dev.sh
#      Or: NEXT_PUBLIC_ALGOLIA_INDEX_NAME=my-index ./restart-dev.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT=8000

# Algolia status: use env if set (inline overrides), else .env.local is loaded by Next.js
ALGOLIA_APP_ID="${NEXT_PUBLIC_ALGOLIA_APP_ID:-}"
ALGOLIA_SEARCH_KEY="${NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY:-}"
if [[ -n "$ALGOLIA_APP_ID" && -n "$ALGOLIA_SEARCH_KEY" ]]; then
  echo "🔍 Algolia: using env (header search will use Algolia)"
  echo "   NEXT_PUBLIC_ALGOLIA_APP_ID=$ALGOLIA_APP_ID"
  echo "   NEXT_PUBLIC_ALGOLIA_INDEX_NAME=${NEXT_PUBLIC_ALGOLIA_INDEX_NAME:-products}"
elif [[ -f .env.local ]]; then
  if grep -qE '^NEXT_PUBLIC_ALGOLIA_APP_ID=[^[:space:]]' .env.local 2>/dev/null && \
     grep -qE '^NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=[^[:space:]]' .env.local 2>/dev/null; then
    echo "🔍 Algolia: configured in .env.local (header search will use Algolia)"
  else
    echo "🔍 Algolia: not set in .env.local (header search will use fallback). Add NEXT_PUBLIC_ALGOLIA_APP_ID and NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY to enable."
  fi
else
  echo "🔍 No .env.local found. Copy .env.example to .env.local and set MEDUSA_BACKEND_URL, NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY, and (optional) Algolia vars."
fi

echo "🔍 Checking for process on port $PORT..."

# Find process using port 8000
PID=$(lsof -ti:$PORT 2>/dev/null || true)

if [ -z "$PID" ]; then
  echo "✅ No process found on port $PORT"
else
  echo "🛑 Killing process $PID on port $PORT..."
  kill -9 $PID 2>/dev/null || true
  sleep 1
  echo "✅ Process killed"
fi

echo "🧹 Cleaning .next directory..."
rm -rf .next

echo "🚀 Starting dev server (from $SCRIPT_DIR)..."
echo "   Backend: set MEDUSA_BACKEND_URL in .env.local (e.g. http://localhost:9000)"
echo "   Algolia: .env.local or pass NEXT_PUBLIC_ALGOLIA_APP_ID, NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY (and optional NEXT_PUBLIC_ALGOLIA_INDEX_NAME)"
echo ""
# So Next.js inlines Algolia vars at compile time: export from .env.local if not already set
if [[ -f .env.local && -z "${NEXT_PUBLIC_ALGOLIA_APP_ID:-}" ]]; then
  set -a
  source .env.local 2>/dev/null || true
  set +a
fi
export NEXT_PUBLIC_ALGOLIA_APP_ID=8UPZHDU2DT
export NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=08cb74cbf4431198655d4a674893b7fb
export NEXT_PUBLIC_ALGOLIA_INDEX_NAME=products

echo "   (Browser console: look for [Algolia] to confirm Algolia is active.)"
echo ""
npm run dev
