#!/bin/bash
# Preflight for DEEP HTTP suites (SAFE-009, made executable rather than a
# design promise). Proves the running Next server at $TEST_BASE_URL was
# started with the SAME Supabase target as this test process's
# TEST_SUPABASE_* — by reading the server process's actual runtime
# environment, not by trusting that whoever started it typed the same
# values twice. Linux-only (/proc), consistent with the rest of this local
# Docker-only harness.
#
# Usage: TEST_BASE_URL=http://localhost:3100 bash scripts/check-http-target-equality.sh
set -uo pipefail

if [ -z "${TEST_BASE_URL:-}" ]; then
  echo "REFUSE: TEST_BASE_URL is not set. No per-file fallback port is trusted here." >&2
  exit 1
fi
if [ -z "${TEST_SUPABASE_URL:-}" ] || [ -z "${TEST_SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "REFUSE: TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_ROLE_KEY not set for this test process." >&2
  exit 1
fi

PORT=$(printf '%s' "$TEST_BASE_URL" | sed -n 's#.*:\([0-9]\+\).*#\1#p')
if [ -z "$PORT" ]; then
  echo "REFUSE: could not parse a port out of TEST_BASE_URL=$TEST_BASE_URL" >&2
  exit 1
fi

# Find the actual next-server process (not the npm/npx wrapper) listening
# on that port.
SERVER_PID=$(ss -ltnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -1)
if [ -z "$SERVER_PID" ]; then
  echo "REFUSE: no process found listening on port $PORT (is the HTTP test server running?)" >&2
  exit 1
fi

if [ ! -r "/proc/$SERVER_PID/environ" ]; then
  echo "REFUSE: cannot read /proc/$SERVER_PID/environ (permission or process gone)" >&2
  exit 1
fi

SERVER_URL=$(tr '\0' '\n' < "/proc/$SERVER_PID/environ" | grep "^NEXT_PUBLIC_SUPABASE_URL=" | cut -d= -f2- | tr -d '\n')
SERVER_KEY_HASH=$(tr '\0' '\n' < "/proc/$SERVER_PID/environ" | grep "^SUPABASE_SERVICE_ROLE_KEY=" | cut -d= -f2- | tr -d '\n' | md5sum | cut -d' ' -f1)
TEST_KEY_HASH=$(printf '%s' "$TEST_SUPABASE_SERVICE_ROLE_KEY" | md5sum | cut -d' ' -f1)

if [ -z "$SERVER_URL" ]; then
  echo "REFUSE: server process (pid $SERVER_PID) has no NEXT_PUBLIC_SUPABASE_URL in its environment" >&2
  exit 1
fi

if [ "$SERVER_URL" != "$TEST_SUPABASE_URL" ] || [ "$SERVER_KEY_HASH" != "$TEST_KEY_HASH" ]; then
  echo "REFUSE: HTTP server target != test process target" >&2
  echo "  server:  $SERVER_URL" >&2
  echo "  test:    $TEST_SUPABASE_URL" >&2
  echo "  (keys differ too if URLs matched but this still printed)" >&2
  exit 1
fi

echo "SAFE-009: HTTP server target == test target ($SERVER_URL, pid $SERVER_PID)"
exit 0
