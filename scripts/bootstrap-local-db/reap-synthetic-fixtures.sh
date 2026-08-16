#!/bin/bash
# Stale-run reaper for DEEP test fixtures (SAFE-007).
#
# Scope and safety model, matching scripts/bootstrap-local-db/run.sh:
# - Hardcoded to the local Docker container ($LOCAL_CONTAINER below) --
#   no connection-string parameter exists, so there is no code path to a
#   remote/production database.
# - Only ever deletes rows matching the SYNTHETIC_ fixture-marker convention
#   already used by 158/160 DEEP test files (H1D-3 audit) -- never an
#   unscoped delete.
# - Dry-run by default: prints counts, deletes nothing, unless --execute is
#   passed explicitly.
#
# Rationale for NOT attempting a fully generic DEEP_RUN_ID retrofit in this
# phase: 160 existing test files would all need a coordinated rewrite to
# stamp and read a run ID; the SYNTHETIC_ marker convention already achieves
# the same practical goal (unambiguous, greppable, never matches real data)
# without that retrofit. SAFE-006 (true per-run namespacing) is left PARTIAL
# -- recommended as the naming convention for new DEEP tests going forward,
# not retrofitted here.
set -uo pipefail

LOCAL_CONTAINER="supabase_db_edunexus"
EXECUTE=0
[ "${1:-}" = "--execute" ] && EXECUTE=1

if ! docker inspect "$LOCAL_CONTAINER" >/dev/null 2>&1; then
  echo "REFUSE: container '$LOCAL_CONTAINER' not found. This tool never accepts an alternate target." >&2
  exit 1
fi

psql_local() {
  docker exec -i "$LOCAL_CONTAINER" psql -U postgres -d postgres -t -A -q -c "$1"
}

echo "=== Stale synthetic fixture scan (dry-run unless --execute) ==="

echo "--- auth.users matching known synthetic email patterns ---"
psql_local "select count(*) from auth.users where email ilike '%synthetic%' or email ilike '%example.com%' or email ilike '%lifecycle-%';"

echo "--- students matching SYNTHETIC_ school marker ---"
psql_local "select count(*) from students where school ilike '%SYNTHETIC%';"

echo "--- schools matching SYNTHETIC_ name marker ---"
psql_local "select count(*) from schools where school_name ilike '%SYNTHETIC%';"

echo "--- teachers matching SYNTHETIC_ marker (full_name or school) ---"
psql_local "select count(*) from teachers where full_name ilike '%SYNTHETIC%' or school ilike '%SYNTHETIC%';"

if [ $EXECUTE -eq 0 ]; then
  echo "=== Dry run only. Re-run with --execute to delete the above rows (FK-safe order). ==="
  exit 0
fi

echo "=== EXECUTING deletion, FK-safe dependency order ==="

psql_local "
delete from learner_projections where learner_id in (select id from students where school ilike '%SYNTHETIC%');
delete from evidence_projection_events where evidence_id in (select id from learner_evidence where learner_id in (select id from students where school ilike '%SYNTHETIC%'));
delete from evidence_audit_log where evidence_id in (select id from learner_evidence where learner_id in (select id from students where school ilike '%SYNTHETIC%'));
update learner_evidence set supersedes = null, superseded_by = null where learner_id in (select id from students where school ilike '%SYNTHETIC%');
delete from learner_evidence where learner_id in (select id from students where school ilike '%SYNTHETIC%');
delete from notification_log where user_id in (select id from auth.users where email ilike '%synthetic%' or email ilike '%example.com%' or email ilike '%lifecycle-%');
delete from students where school ilike '%SYNTHETIC%';
delete from teachers where full_name ilike '%SYNTHETIC%' or school ilike '%SYNTHETIC%';
delete from schools where school_name ilike '%SYNTHETIC%';
delete from auth.users where email ilike '%synthetic%' or email ilike '%example.com%' or email ilike '%lifecycle-%';
"

echo "=== Reaper complete. Re-run without --execute to confirm zero remaining. ==="
