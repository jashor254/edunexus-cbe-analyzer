-- Migration hygiene reconciliation (Adaptive Assignment Domain audit).
--
-- `assignments.is_holiday_assignment` and `assignments.holiday_period`
-- already exist live and are read/written by real code
-- (lib/repositories/assignment.repository.ts, lib/assignments/create.ts,
-- app/teacher/assignments/new/page.tsx) — confirmed via the generated
-- lib/database.types.ts, which is produced directly from the live schema.
-- No CREATE/ALTER statement adding either column exists anywhere in
-- supabase/migrations/ or any top-level supabase/*.sql file. This
-- migration reconciles tracked history with live state; it changes no
-- live data or behavior. ADD COLUMN IF NOT EXISTS is a no-op against an
-- already-matching live database and only has any effect on an
-- out-of-sync/fresh environment being brought up from tracked migrations
-- alone.
--
-- The printable-routes pilot (20260729120000_assignment_print_routes.sql)
-- deliberately does not depend on either column — holiday-flagged
-- assignments go through the same "Prepare Printable Routes" flow as any
-- other assignment, per the pilot's locked scope.

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS is_holiday_assignment boolean,
  ADD COLUMN IF NOT EXISTS holiday_period text;

COMMENT ON COLUMN assignments.is_holiday_assignment IS
  'Teacher-set flag marking this assignment as holiday work. Historically added to the live schema out-of-band — this migration only reconciles tracked schema history, it does not change existing behavior. Deliberately unrelated to the separate, independently-generated holiday_plans feature (lib/holiday/planner.ts) — see the Adaptive Assignment Domain audit for why those two mechanisms are not (yet) connected.';

COMMENT ON COLUMN assignments.holiday_period IS
  'Free-text, teacher-typed label for the holiday period (e.g. "August Holiday 2026"). Not linked to the Core `terms` table today — the Adaptive Assignment Domain audit recommends FK-ing this to `terms` in a future pass instead of keeping it free text, but that change is out of scope for the printable-routes pilot.';
