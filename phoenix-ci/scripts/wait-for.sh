#!/usr/bin/env bash
# Wait until a URL answers with a 2xx status.
#
#   ./wait-for.sh URL [TIMEOUT_SECONDS]
set -euo pipefail

URL="${1:?usage: wait-for.sh URL [TIMEOUT_SECONDS]}"
TIMEOUT="${2:-60}"
INTERVAL=2

start=$SECONDS
until curl -fsS -o /dev/null --max-time 5 "$URL"; do
  if [ $((SECONDS - start)) -ge "$TIMEOUT" ]; then
    echo "wait-for: timed out after ${TIMEOUT}s waiting for $URL" >&2
    exit 1
  fi
  sleep "$INTERVAL"
done

echo "wait-for: $URL is up"
