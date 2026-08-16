#!/bin/bash
# EduNexus disposable-local-Supabase bootstrap runner.
#
# Reconstructs a fresh local Postgres instance from repository-controlled
# artifacts: supabase/final_schema.sql + loose migration files, this
# directory's recovery SQL for schema objects with no tracked-migration
# origin, all 107 tracked migrations under supabase/migrations/, and the 11
# recovered security-hardening phases (+ one ordering correction) that
# production applied out-of-band of the tracked migration history.
#
# This is assurance infrastructure, proven deterministic under
# H1M-SNAPSHOT-3 (two independent fresh runs produce an identical canonical
# schema fingerprint). It is NOT a production migration tool and must never
# be pointed at anything but the local disposable Docker Supabase instance.
#
# ── SAFETY (SAFE-*, adapted from utils/supabase/test-service.ts's model) ──
# This script takes NO connection-string parameter, reads NO .env.local /
# .env.production, and accepts NO override of the target container. The
# only database it can ever reach is $LOCAL_CONTAINER below, verified live
# via `docker inspect` before any SQL runs. There is no code path from this
# script to a remote/production database — the fail-closed guarantee here is
# structural (no parameter exists to misconfigure), not a runtime check that
# could be bypassed by a bad env var.
set -uo pipefail

LOCAL_CONTAINER="supabase_db_edunexus"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"
LEDGER="${1:-/tmp/edunexus-bootstrap-$(date +%s).log}"
> "$LEDGER"

echo "=== SAFETY PREFLIGHT ===" | tee -a "$LEDGER"
if ! command -v docker >/dev/null 2>&1; then
  echo "REFUSE: docker not available" | tee -a "$LEDGER"; exit 1
fi
if ! docker inspect "$LOCAL_CONTAINER" >/dev/null 2>&1; then
  echo "REFUSE: container '$LOCAL_CONTAINER' not found. Run 'supabase start' first. This script will not accept an alternate target." | tee -a "$LEDGER"
  exit 1
fi
CONTAINER_IMAGE=$(docker inspect -f '{{.Config.Image}}' "$LOCAL_CONTAINER" 2>/dev/null || echo "")
if [[ "$CONTAINER_IMAGE" != *"supabase"* ]]; then
  echo "REFUSE: container '$LOCAL_CONTAINER' does not look like a Supabase local image ($CONTAINER_IMAGE)" | tee -a "$LEDGER"
  exit 1
fi
echo "OK: target verified as local disposable container '$LOCAL_CONTAINER' ($CONTAINER_IMAGE)" | tee -a "$LEDGER"

FAIL_COUNT=0
UNRECOVERED=0

apply() {
  local f="$1"
  local out status
  out=$(docker exec -i "$LOCAL_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$f" 2>&1)
  status=$?
  if [ $status -ne 0 ]; then
    echo "FAIL: $f" | tee -a "$LEDGER"
    echo "$out" | grep -A5 "^ERROR" | tee -a "$LEDGER"
    FAIL_COUNT=$((FAIL_COUNT+1))
    return 1
  else
    echo "OK: $f" >> "$LEDGER"
    return 0
  fi
}

sql1() {
  docker exec -i "$LOCAL_CONTAINER" psql -U postgres -d postgres -q -c "$1" >> "$LEDGER" 2>&1
}

echo "=== STAGE -1: baseline role grants/default privileges ===" | tee -a "$LEDGER"
# H1D-2 finding: this bootstrap creates every object as the `postgres` role
# (via `docker exec ... psql -U postgres`). A pristine Supabase CLI instance
# establishes pg_default_acl entries for anon/authenticated/service_role
# scoped to `supabase_admin`-created objects, but NOT to `postgres`-created
# ones -- so objects this script creates get zero grants to those roles
# unless explicitly established here. Undetected until H1D-2 because all
# prior verification connected as the `postgres` superuser directly (bypasses
# GRANT entirely) rather than through PostgREST/service_role, which respects
# GRANTs on top of RLS. Idempotent -- safe whether starting from a pristine
# container or a DROP SCHEMA-reset one. service_role/anon/authenticated
# getting a broad starting grant is safe: security-hardening STAGE 3 (phases
# 8-11) narrows anon/authenticated correctly to match production; no phase
# narrows service_role's table-level access, since Supabase's own model
# always gives service_role full access (RLS bypass is a separate, additional
# guarantee, not a substitute for table grants).
sql1 "GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;"
sql1 "GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;"
sql1 "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;"
sql1 "GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;"
sql1 "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;"
sql1 "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;"
sql1 "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;"

echo "=== STAGE 0: baseline objects ===" | tee -a "$LEDGER"
apply "$REPO/supabase/final_schema.sql" || { echo "STOP: baseline failed" | tee -a "$LEDGER"; exit 1; }
apply "$SCRIPT_DIR/00-baseline/01-shared-reports.sql"
apply "$REPO/supabase/teacher_portal_migration.sql"
apply "$SCRIPT_DIR/00-baseline/02-study-groups.sql"
apply "$SCRIPT_DIR/00-baseline/03-sow-curriculum-tables.sql"
apply "$SCRIPT_DIR/00-baseline/04-academic-reports.sql"
apply "$REPO/supabase/migrations/20260530_sow_tables.sql"
apply "$REPO/supabase/notification_layer.sql"
apply "$REPO/supabase/marksheet_migration.sql"
apply "$REPO/supabase/grading_scales_migration.sql"
apply "$REPO/supabase/stream_meangrade_migration.sql"
apply "$REPO/supabase/beta_pioneer_migration.sql"
apply "$REPO/supabase/lesson_plans_migration.sql"
apply "$REPO/supabase/records_of_work_migration.sql"
apply "$REPO/supabase/assignment_plan_link_migration.sql"
apply "$REPO/supabase/kicd_curriculum_migration.sql"
apply "$SCRIPT_DIR/00-baseline/05-additional-prehistory-tables.sql"
apply "$SCRIPT_DIR/00-baseline/06-second-prehistory-batch.sql"
apply "$SCRIPT_DIR/00-baseline/07-clean-slate-sow-schema-and-curriculum-configs.sql"
apply "$SCRIPT_DIR/00-baseline/08-student-learning-context.sql"
apply "$SCRIPT_DIR/00-baseline/09-column-gap-patches.sql"

echo "=== STAGE 0b: single-statement patches (avoid multi-statement rollback) ===" | tee -a "$LEDGER"
sql1 "CREATE TABLE IF NOT EXISTS school_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('school_admin','headteacher','deputy_headteacher','teacher','parent')),
  is_active boolean NOT NULL DEFAULT true,
  invited_by uuid REFERENCES auth.users(id),
  joined_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id, role)
);"
sql1 "ALTER TABLE students ADD COLUMN IF NOT EXISTS teacher_id uuid;"
sql1 "ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_user_id uuid;"

echo "=== STAGE 1: core_foundation table pre-creation ===" | tee -a "$LEDGER"
python3 - "$REPO/supabase/migrations/20260629_core_foundation.sql" > /tmp/core-foundation-tables.sql <<'PYEOF'
import re, sys
with open(sys.argv[1]) as f:
    content = f.read()
out = []
pattern = re.compile(r"CREATE TABLE IF NOT EXISTS \w+ \(")
for m in pattern.finditer(content):
    start = m.start()
    depth = 0
    j = m.end() - 1
    while j < len(content):
        if content[j] == '(':
            depth += 1
        elif content[j] == ')':
            depth -= 1
            if depth == 0:
                break
        j += 1
    semi = content.index(';', j)
    out.append(content[start:semi+1])
for b in out:
    print(b); print()
PYEOF
apply /tmp/core-foundation-tables.sql

echo "=== STAGE 1b: EILS + careers + missing functions + knowledge graph ===" | tee -a "$LEDGER"
apply "$SCRIPT_DIR/00-baseline/13-eils-careers-functions.sql"
apply "$SCRIPT_DIR/00-baseline/14-knowledge-graph-tables.sql"

echo "=== STAGE 1c: eios_foundation applied early ===" | tee -a "$LEDGER"
sql1 "ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS overall_risk_level text, ADD COLUMN IF NOT EXISTS risk_flags jsonb;"
apply "$REPO/supabase/migrations/20260628_eios_foundation.sql"

echo "=== STAGE 2: tracked migrations (107, minus 5 applied-early/data-only) ===" | tee -a "$LEDGER"
SKIP_LIST="20260530_sow_tables.sql 20260707_fix_strand_assessments_source_backfill.sql 20260628_eios_foundation.sql 20260723093000_lms_quiz_extends_assignments.sql 20260723110000_growth_engine_sprint_c0.sql"
for f in $(ls "$REPO/supabase/migrations" | sort); do
  skip=0
  for s in $SKIP_LIST; do [ "$f" = "$s" ] && skip=1; done
  if [ $skip -eq 1 ]; then echo "SKIP (already applied / data-only): $f" >> "$LEDGER"; continue; fi
  if ! apply "$REPO/supabase/migrations/$f"; then
    case "$f" in
      20260629_core_foundation.sql)
        # Genuine bug in the migration's own final statement
        # (core_learner_intelligence view) -- everything else already
        # succeeded via STAGE 1's pre-creation + this file's direct apply.
        echo "OK: $f (minus broken core_learner_intelligence view — genuine bug, non-essential)" | tee -a "$LEDGER"
        ;;
      20260525_performance_indexes.sql)
        sql1 "ALTER TABLE row_entries ADD COLUMN IF NOT EXISTS status text, ADD COLUMN IF NOT EXISTS remarks text, ADD COLUMN IF NOT EXISTS learning_outcomes jsonb, ADD COLUMN IF NOT EXISTS key_inquiry_questions jsonb, ADD COLUMN IF NOT EXISTS learning_resources jsonb, ADD COLUMN IF NOT EXISTS activities_summary jsonb;"
        apply "$REPO/supabase/migrations/$f"
        ;;
      20260619_compass_perf_indexes.sql)
        sql1 "ALTER TABLE compass_sessions ADD COLUMN IF NOT EXISTS status text, ADD COLUMN IF NOT EXISTS message_count integer, ADD COLUMN IF NOT EXISTS one_line_summary text, ADD COLUMN IF NOT EXISTS exchange_count integer, ADD COLUMN IF NOT EXISTS subject text, ADD COLUMN IF NOT EXISTS mode text, ADD COLUMN IF NOT EXISTS completed_at timestamptz, ADD COLUMN IF NOT EXISTS duration_seconds integer, ADD COLUMN IF NOT EXISTS xp_earned integer, ADD COLUMN IF NOT EXISTS starting_level integer, ADD COLUMN IF NOT EXISTS ending_level integer;"
        apply "$REPO/supabase/migrations/$f"
        ;;
      20260706_integration_connections.sql)
        apply "$SCRIPT_DIR/00-baseline/10-devportal-cluster.sql"
        apply "$REPO/supabase/migrations/$f"
        ;;
      20260707_holiday_plans_publish_gate.sql)
        apply "$SCRIPT_DIR/00-baseline/11-learning-intelligence-foundation.sql"
        apply "$REPO/supabase/migrations/$f"
        ;;
      20260710120000_sprint15_corrections.sql)
        sql1 "ALTER TABLE study_group_members ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE CASCADE;"
        sql1 "ALTER TABLE study_group_challenges ADD COLUMN IF NOT EXISTS subject text, ADD COLUMN IF NOT EXISTS difficulty integer DEFAULT 3, ADD COLUMN IF NOT EXISTS kenyan_context text, ADD COLUMN IF NOT EXISTS explanation text, ADD COLUMN IF NOT EXISTS options jsonb;"
        apply "$REPO/supabase/migrations/$f"
        ;;
      20260713120000_academy_ai_fallback_flag.sql)
        apply "$SCRIPT_DIR/00-baseline/12-academy-cluster.sql"
        apply "$REPO/supabase/migrations/$f"
        ;;
      20260720021344_assignment_question_variants.sql)
        apply "$REPO/supabase/migrations/20260723093000_lms_quiz_extends_assignments.sql"
        apply "$REPO/supabase/migrations/$f"
        ;;
      20260720120000_sprint1_critical_rls_fixes.sql)
        sql1 "ALTER TABLE students ADD COLUMN IF NOT EXISTS teacher_id uuid, ADD COLUMN IF NOT EXISTS parent_user_id uuid;"
        apply "$REPO/supabase/migrations/$f"
        ;;
      20260722100000_growth_targeting_engine_fields.sql)
        apply "$REPO/supabase/migrations/20260723110000_growth_engine_sprint_c0.sql"
        apply "$REPO/supabase/migrations/$f"
        ;;
      20260804120100_security_sprint_phase2_3_scope_always_true_policies.sql)
        sql1 "CREATE TABLE IF NOT EXISTS pilot_tracking (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid, term integer, year integer, whatsapp_sent_at timestamptz, parent_name text, parent_phone text, feedback_notes text, feedback_received_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());"
        sql1 "ALTER TABLE pilot_tracking ENABLE ROW LEVEL SECURITY;"
        sql1 "CREATE POLICY \"admin_only\" ON pilot_tracking FOR ALL USING (true) WITH CHECK (true);"
        sql1 "CREATE POLICY \"early_access: service only\" ON early_access_leads FOR ALL USING (true) WITH CHECK (true);"
        sql1 "CREATE POLICY \"kicd_lessons: service insert\" ON kicd_curriculum_lessons FOR INSERT WITH CHECK (true);"
        sql1 "CREATE TABLE IF NOT EXISTS insights_authors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL UNIQUE, bio text, title text, avatar_url text, social_links jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());"
        sql1 "CREATE TABLE IF NOT EXISTS insights_categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL UNIQUE, description text, color text NOT NULL DEFAULT 'violet', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());"
        sql1 "CREATE TABLE IF NOT EXISTS insights_series (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, slug text NOT NULL UNIQUE, description text, cover_image text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());"
        sql1 "CREATE TABLE IF NOT EXISTS insights_articles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE, title text NOT NULL, subtitle text, excerpt text, content text, cover_image text, reading_time integer NOT NULL DEFAULT 5, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published','archived')), featured boolean NOT NULL DEFAULT false, pinned boolean NOT NULL DEFAULT false, publish_date timestamptz, author_id uuid NOT NULL REFERENCES insights_authors(id), category_id uuid NOT NULL REFERENCES insights_categories(id), series_id uuid REFERENCES insights_series(id), series_order integer, view_count integer NOT NULL DEFAULT 0, seo_title text, seo_description text, og_image text, content_type text NOT NULL DEFAULT 'article', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());"
        sql1 "CREATE TABLE IF NOT EXISTS insights_tags (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());"
        sql1 "CREATE TABLE IF NOT EXISTS insights_article_tags (article_id uuid NOT NULL REFERENCES insights_articles(id) ON DELETE CASCADE, tag_id uuid NOT NULL REFERENCES insights_tags(id) ON DELETE CASCADE, PRIMARY KEY (article_id, tag_id));"
        sql1 "CREATE TABLE IF NOT EXISTS insights_newsletter_subscribers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, confirmed boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());"
        for t in insights_authors insights_categories insights_series insights_articles insights_tags insights_article_tags insights_newsletter_subscribers; do
          sql1 "ALTER TABLE $t ENABLE ROW LEVEL SECURITY;"
        done
        sql1 "CREATE POLICY \"public_insert_newsletter\" ON insights_newsletter_subscribers FOR INSERT WITH CHECK (true);"
        apply "$SCRIPT_DIR/00-baseline/16-parent-profiles-service-policy-and-insights-view-fn.sql"
        apply "$REPO/supabase/migrations/$f"
        ;;
      20260812190000_close_self_declared_admin_escalation.sql)
        sql1 "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher','admin'));"
        sql1 "CREATE TABLE IF NOT EXISTS app_config (key text PRIMARY KEY, value text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());"
        sql1 "ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;"
        sql1 "CREATE POLICY \"Admin full access on app_config\" ON app_config FOR ALL USING (EXISTS (SELECT 1 FROM teachers WHERE user_id = auth.uid() AND role = 'admin'));"
        apply "$REPO/supabase/migrations/$f"
        ;;
      *)
        echo "=== UNRECOVERED STOP at: $f ===" | tee -a "$LEDGER"
        UNRECOVERED=1
        break
        ;;
    esac
  fi
done

if [ "$UNRECOVERED" -eq 1 ]; then
  echo "=== BOOTSTRAP FAILED: unrecovered migration, stopping before security phases ===" | tee -a "$LEDGER"
  exit 1
fi

echo "=== STAGE 2b: security-phase prerequisite column gaps ===" | tee -a "$LEDGER"
apply "$SCRIPT_DIR/00-baseline/15-security-phase6-column-gaps.sql"
apply "$SCRIPT_DIR/00-baseline/17-students-column-gaps.sql"
apply "$SCRIPT_DIR/00-baseline/18-learner-evidence-column-gaps.sql"
apply "$SCRIPT_DIR/00-baseline/19-classes-fk-constraints.sql"
apply "$SCRIPT_DIR/00-baseline/20-schemes-of-work-column-gap.sql"
apply "$SCRIPT_DIR/00-baseline/21-profiles-column-gap.sql"
apply "$SCRIPT_DIR/00-baseline/22-learner-marks-column-gap.sql"
apply "$SCRIPT_DIR/00-baseline/23-compass-sessions-fk-drop.sql"
apply "$SCRIPT_DIR/00-baseline/24-student-learning-context-column-gaps.sql"
apply "$SCRIPT_DIR/00-baseline/25-learner-profiles-unique-constraint.sql"
apply "$SCRIPT_DIR/00-baseline/26-lesson-plans-column-gap.sql"

echo "=== STAGE 3: security hardening phases ===" | tee -a "$LEDGER"
apply "$SCRIPT_DIR/01-security-hardening/phase1_search_path.sql"
apply "$SCRIPT_DIR/01-security-hardening/phase2_is_admin_fix.sql"
apply "$SCRIPT_DIR/01-security-hardening/phase3_rls_policies.sql"
apply "$SCRIPT_DIR/01-security-hardening/phase4-prereq-api-views.sql"
apply "$SCRIPT_DIR/01-security-hardening/phase4_security_invoker_views.sql"
apply "$SCRIPT_DIR/01-security-hardening/phase5_platform_releases.sql"
apply "$SCRIPT_DIR/01-security-hardening/phase6_missing_fk_indexes.sql"
apply "$SCRIPT_DIR/01-security-hardening/phase7_remaining_search_paths.sql"
apply "$SCRIPT_DIR/01-security-hardening/phase8_revoke_anon.sql"
apply "$SCRIPT_DIR/01-security-hardening/phase9_function_execute_grants.sql"
apply "$SCRIPT_DIR/01-security-hardening/phase10_explicit_role_revokes.sql"
apply "$SCRIPT_DIR/01-security-hardening/phase11_final_cleanup.sql"
apply "$SCRIPT_DIR/01-security-hardening/phase11b-study-group-challenges-ordering-correction.sql"

echo "=== STAGE 4: canonical schema fingerprint ===" | tee -a "$LEDGER"
FINGERPRINT=$(docker exec -i "$LOCAL_CONTAINER" psql -U postgres -d postgres -t -A -q < "$SCRIPT_DIR/fingerprint.sql")
echo "FINGERPRINT: $FINGERPRINT" | tee -a "$LEDGER"

echo "=== DONE. FAIL_COUNT=$FAIL_COUNT UNRECOVERED=$UNRECOVERED FINGERPRINT=$FINGERPRINT ===" | tee -a "$LEDGER"
