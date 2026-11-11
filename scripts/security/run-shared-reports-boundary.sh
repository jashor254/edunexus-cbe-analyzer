#!/usr/bin/env bash
# Runs a role-based security regression (default: the DSA-01 shared_reports test;
# pass another .sql path as $1, e.g. school-snapshots-boundary.test.sql) against a
# disposable LOCAL stack only. The tests are wrapped in a transaction that is
# rolled back, but the target is still guarded explicitly:
#   * DB_CONTAINER must be set (there is NO default target),
#   * DISPOSABLE_TEST_DB=yes must be set,
#   * the throwaway stack supabase_db_pifp is always allowed; the default stack
#     supabase_db_edunexus (the developer's own database on a workstation) is
#     allowed only when CI=true (an ephemeral runner).
# Anything else is refused — never a remote database.
set -euo pipefail
CONTAINER="${DB_CONTAINER:-}"
if [ "${DISPOSABLE_TEST_DB:-}" != "yes" ]; then
  echo "refusing: set DISPOSABLE_TEST_DB=yes to confirm the target is a disposable test database"; exit 2
fi
if [ -z "$CONTAINER" ]; then
  echo "refusing: DB_CONTAINER is required (no default target)"; exit 2
fi
case "$CONTAINER" in
  supabase_db_pifp) ;;
  supabase_db_edunexus)
    if [ "${CI:-}" != "true" ]; then
      echo "refusing: supabase_db_edunexus is the local development database; it is accepted only when CI=true"; exit 2
    fi ;;
  *) echo "refusing: $CONTAINER is not an allowed local container"; exit 2 ;;
esac
docker inspect "$CONTAINER" >/dev/null 2>&1 || { echo "refusing: $CONTAINER not found"; exit 2; }
docker exec -i "$CONTAINER" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 \
  < "${1:-$(dirname "$0")/shared-reports-boundary.test.sql}"
