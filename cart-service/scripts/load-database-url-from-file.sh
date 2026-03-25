#!/usr/bin/env bash
# Read DATABASE_URL from a Node-style .env without sourcing the file (JSON lines break bash).

load_database_url_from_file() {
  local envfile="$1"
  [ -f "$envfile" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*DATABASE_URL[[:space:]]*=[[:space:]]*(.+)$ ]] || continue
    local val="${BASH_REMATCH[1]}"
    val="${val#\"}"
    val="${val%\"}"
    val="${val#\'}"
    val="${val%\'}"
    val="${val%%[[:space:]]#*}"
    export DATABASE_URL="$val"
    return 0
  done < "$envfile"
}
