#!/usr/bin/env bash
# Runs the DSA-01 role-based regression against a disposable LOCAL stack only.
# Default container is the dev stack; DB_CONTAINER may select the isolated
# fingerprint stack. Anything else is refused — never a remote database.
set -euo pipefail
CONTAINER="${DB_CONTAINER:-supabase_db_edunexus}"
case "$CONTAINER" in
  supabase_db_edunexus|supabase_db_pifp) ;;
  *) echo "refusing: $CONTAINER is not an allowed local container"; exit 2 ;;
esac
docker inspect "$CONTAINER" >/dev/null 2>&1 || { echo "refusing: $CONTAINER not found"; exit 2; }
docker exec -i "$CONTAINER" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 \
  < "$(dirname "$0")/shared-reports-boundary.test.sql"
