#!/bin/bash

# Script to kill process on port 9000, clean .next, and restart Medusa dev server

set -e



SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure node/npm are on PATH (e.g. when run from Cursor terminal where nvm/fnm aren't loaded)
if ! command -v node &>/dev/null; then
  if [ -f "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    . "$NVM_DIR/nvm.sh"
  elif [ -f "$HOME/.local/share/fnm/fnm" ] || command -v fnm &>/dev/null; then
    eval "$(fnm env)" 2>/dev/null || true
  fi
  [ -x "/opt/homebrew/bin/node" ] && export PATH="/opt/homebrew/bin:$PATH"
  [ -x "/usr/local/bin/node" ] && export PATH="/usr/local/bin:$PATH"
fi
if ! command -v node &>/dev/null; then
  echo "❌ node not found. Install Node.js or run this script from a terminal where nvm/fnm is loaded."
  exit 1
fi

# If DATABASE_URL points to localhost (e.g. Cloud SQL Proxy), verify the port is reachable first
if grep -qE '^DATABASE_URL=.*(127\.0\.0\.1|localhost)' .env 2>/dev/null; then
  echo "🔍 Checking database port (Cloud SQL Proxy)..."
  if ! node scripts/check-db-port.js; then
    echo ""
    echo "Start the proxy in another terminal, then run this script again."
    exit 1
  fi
fi

PORT=9000

echo "🔍 Checking for process on port $PORT..."

# Find process using port 9000
PID=$(lsof -ti:$PORT 2>/dev/null || true)

if [ -z "$PID" ]; then
  echo "✅ No process found on port $PORT"
else
  echo "🛑 Killing process $PID on port $PORT..."
  kill -9 $PID 2>/dev/null || true
  sleep 1
  echo "✅ Process killed"
fi

echo "🧹 Cleaning .medusa directory..."
rm -rf .medusa

echo "🚀 Starting dev server (from $SCRIPT_DIR)..."
npm run dev
