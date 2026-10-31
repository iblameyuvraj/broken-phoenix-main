#!/usr/bin/env bash
# End-to-end smoke test of a running Phoenix stack.
#
#   ./smoke.sh [backend-url] [frontend-url] [expected-version]
#
# Prints "SMOKE OK" and exits 0 only when every check passes; a single failure
# exits non-zero straight away.
set -euo pipefail

BACKEND="${1:-http://localhost:8000}"
FRONTEND="${2:-http://localhost:3000}"
EXPECTED_VERSION="${3:-}"
MAX_TIME=15

fail() {
  echo "SMOKE FAILED: $*" >&2
  exit 1
}

# fetch METHOD URL [TOKEN] [BODY] -> prints the response body, fails on HTTP errors
fetch() {
  local method="$1" url="$2" token="${3:-}" body="${4:-}"
  local args=(-sS -f -X "$method" --max-time "$MAX_TIME")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$body" ] && args+=(-H "Content-Type: application/json" -d "$body")
  curl "${args[@]}" "$url"
}

json() {
  # json '<expression over `j`>' -> evaluates against the JSON on stdin
  node --input-type=module -e '
    let raw = "";
    for await (const chunk of process.stdin) raw += chunk;
    let j;
    try { j = JSON.parse(raw); } catch { console.error("not JSON: " + raw.slice(0, 200)); process.exit(1); }
    process.stdout.write(String(eval(process.argv[1])));
  ' "$1"
}

echo "-> backend health"
HEALTH="$(fetch GET "$BACKEND/api/health")" || fail "backend is not answering at $BACKEND/api/health"
[ "$(printf '%s' "$HEALTH" | json 'j.status')" = "ok" ] || fail "health status is not ok: $HEALTH"
[ "$(printf '%s' "$HEALTH" | json 'j.db')" = "ok" ] || fail "database is not reachable: $HEALTH"
if [ -n "$EXPECTED_VERSION" ]; then
  LIVE_VERSION="$(printf '%s' "$HEALTH" | json 'j.version')"
  [ "$LIVE_VERSION" = "$EXPECTED_VERSION" ] || fail "live version '$LIVE_VERSION' is not the expected commit '$EXPECTED_VERSION'"
fi

echo "-> frontend"
fetch GET "$FRONTEND/" >/dev/null || fail "frontend is not answering at $FRONTEND/"

echo "-> login"
LOGIN="$(fetch POST "$BACKEND/api/auth/login" "" '{"email":"alice@phoenix.dev","password":"phoenix123"}')" \
  || fail "login as the demo user failed"
TOKEN="$(printf '%s' "$LOGIN" | json 'j.access_token')"
[ -n "$TOKEN" ] && [ "$TOKEN" != "undefined" ] || fail "login returned no access token"
[ "$(printf '%s' "$LOGIN" | json 'j.user.email')" = "alice@phoenix.dev" ] || fail "login returned the wrong user"

echo "-> authenticated request"
ME="$(fetch GET "$BACKEND/api/auth/me" "$TOKEN")" || fail "GET /api/auth/me failed"
[ "$(printf '%s' "$ME" | json 'j.email')" = "alice@phoenix.dev" ] || fail "/api/auth/me returned the wrong user"
WORKSPACES="$(fetch GET "$BACKEND/api/workspaces" "$TOKEN")" || fail "GET /api/workspaces failed"
[ "$(printf '%s' "$WORKSPACES" | json 'Array.isArray(j) && j.length')" != "0" ] || fail "the demo user has no workspaces - was the seed run?"

echo "SMOKE OK"
