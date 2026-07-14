-- ═══════════════════════════════════════════════════════════════════════════════
-- Sprint 15 — Post-Sprint-14 Corrections
-- 2026-07-10
--
-- TASK 1 — RLS infinite recursion (42P17) on study_groups/study_group_members/
-- study_group_challenges. Reproduced live: Sprint 14's "study_group_members:
-- fellow member read" policy subqueries study_group_members from within its
-- own USING clause. Evaluating the policy re-triggers the same policy on the
-- inner subquery, which Postgres detects and aborts with
-- `42P17: infinite recursion detected in policy for relation
-- "study_group_members"`. Because study_groups and study_group_challenges'
-- policies both subquery study_group_members (and that table's own RLS
-- applies inside the subquery), all three are currently broken for every
-- authenticated user — confirmed by direct execution, not just by reading
-- pg_policies. Only study_group_answers (whose policy checks
-- `user_id = auth.uid()` directly, no subquery) survived.
--
-- Fix: a SECURITY DEFINER helper function that reads study_group_members with
-- RLS bypassed (it runs as the function owner, postgres), then have every
-- policy call the function instead of subquerying the table directly. This
-- breaks the recursion because the function's internal read never
-- re-invokes RLS on study_group_members.
--
-- TASK 3 — study_group_challenges.correct_answer column-level revoke.
-- Root cause (identified in review, not a Supabase quirk): `authenticated`
-- and `anon` have table-level `GRANT SELECT` on this table (confirmed via
-- pg_class.relacl in Sprint 14 — `anon=arwdDxtm/postgres,
-- authenticated=arwdDxtm/postgres`). A column-level REVOKE cannot subtract
-- from a table-level GRANT — in Postgres, revoking a column privilege that
-- was never separately granted at the column level is a no-op, which is
-- exactly what Sprint 14 observed (pg_attribute.attacl stayed null). The
-- correct fix is to revoke the table-level grant entirely, then re-grant
-- SELECT on only the named, non-sensitive columns.
--
-- Freeze boundary respected: no table under Evidence, Projection, Blueprint,
-- Career Intelligence, Adaptive Learning, Parent Intelligence, Teacher
-- Intelligence, Holiday Learning, Knowledge Graph, Recommendation Engine, or
-- SOW/Lesson Plan/Record of Work is touched by this migration. Task 2
-- (storage bucket) has no schema/table component and is not in this file —
-- see storage.buckets update below, which is the one exception explicitly
-- scoped by Sprint 15 Task 2.2.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- TASK 1 — SECURITY DEFINER helper + non-recursive policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Real columns on study_group_members (confirmed via information_schema
-- before writing this): id, group_id, user_id (not null), student_id
-- (nullable), student_name, points, joined_at, created_at, updated_at.
-- Membership is keyed on EITHER user_id directly OR student_id (resolved via
-- students.user_id) — both are populated together at insert time
-- (app/api/groups/join/route.ts), so the helper must check both to match
-- Sprint 14's original intent instead of silently narrowing access.
create or replace function public.auth_is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from study_group_members m
    where m.group_id = p_group_id
      and (
        m.user_id = auth.uid()
        or m.student_id in (select id from students where user_id = auth.uid())
      )
  );
$$;

-- set search_path is not optional on a SECURITY DEFINER function — without
-- it, a caller who can control search_path could shadow `study_group_members`
-- or `students` with an object of their own and hijack the function's
-- behavior. Explicitly pinning to public, pg_temp closes that.

revoke execute on function public.auth_is_group_member(uuid) from public, anon;
grant  execute on function public.auth_is_group_member(uuid) to authenticated;

-- Drop and replace the three recursive policies. study_group_answers is left
-- untouched — its policy already checks user_id = auth.uid() directly, no
-- subquery, not recursive, confirmed by successful execution in Step 1.1.

drop policy if exists "study_groups: member read"           on study_groups;
drop policy if exists "study_group_members: fellow member read" on study_group_members;
drop policy if exists "study_group_challenges: member read" on study_group_challenges;

create policy "study_groups: member read"
  on study_groups for select
  using (public.auth_is_group_member(id));

create policy "study_group_members: fellow member read"
  on study_group_members for select
  using (public.auth_is_group_member(group_id));

create policy "study_group_challenges: member read"
  on study_group_challenges for select
  using (public.auth_is_group_member(group_id));

-- No authenticated-role write policies are added — Sprint 14's decision
-- stands: every INSERT/UPDATE on these tables goes through a service-role
-- API route already (app/api/groups/create, app/api/groups/join,
-- app/api/groups/challenge).

-- ─────────────────────────────────────────────────────────────────────────────
-- TASK 3 — correct_answer: table-level revoke + column-level re-grant
-- ─────────────────────────────────────────────────────────────────────────────

-- Real columns on study_group_challenges (confirmed via information_schema
-- immediately before writing this list — do not copy blind if the table
-- shape changes): id, group_id, date, question, correct_answer, hint,
-- created_at, updated_at, subject, difficulty, kenyan_context, explanation,
-- options.
--
-- Granted below: id, group_id, date, question, hint, created_at, updated_at,
-- subject, difficulty, kenyan_context.
--
-- Deliberately withheld:
--   - correct_answer — the entire point of this migration.
--   - explanation — no live client code reads this column today (confirmed:
--     zero references to `.explanation` on a challenge object anywhere in
--     app/). If this is meant to be shown after a student answers (a common
--     "here's why" pattern), that needs a submission-gated read path, not a
--     blanket grant — flagging for a product decision, not building it here.
--   - options — jsonb, also unread by any live client code today (the
--     current UI is free-text answer entry, not multiple-choice). Shape/
--     content unknown; withheld until there's a confirmed need and confirmed
--     contents.
--
-- NOTE: adding a new column to study_group_challenges in the future does NOT
-- automatically grant it to authenticated/anon under this column-level
-- model — it must be added to the grant list below explicitly, or it will
-- silently be unreadable by the app.

revoke select on table public.study_group_challenges from authenticated, anon;

grant select (
  id, group_id, date, question, hint, created_at, updated_at,
  subject, difficulty, kenyan_context
) on table public.study_group_challenges to authenticated;

-- service_role and postgres are untouched by the revoke above (only
-- authenticated/anon were named) — app/api/groups/challenge/route.ts reads
-- correct_answer via the service-role client and is unaffected.

-- ─────────────────────────────────────────────────────────────────────────────
-- TASK 2.2 — clinic-reports storage bucket: make private, remove public read
-- ─────────────────────────────────────────────────────────────────────────────

-- Confirmed: `clinic-reports` is currently a PUBLIC bucket with a single
-- storage.objects policy, "Public read clinic reports"
-- (qual: bucket_id = 'clinic-reports', roles: {public}) — any anon or
-- authenticated request can SELECT/list/download any object in this bucket.
-- Clinic Report PDFs contain named minors' marks and career diagnostics.
--
-- Blast radius mapped before this change (Sprint 15 Task 2.1): the public
-- URL is persisted in student_clinic_reports.pdf_url for 5 real-named
-- students (created 2026-06-02 through 2026-07-06), and was rendered as a
-- direct <a href> in two client pages (app/dashboard/clinic/page.tsx —
-- parent, app/teacher/reports/page.tsx — teacher; app/admin/pilot/page.tsx
-- declares the same field but never renders it as a link, so no change was
-- needed there). Both live call sites are updated in this same sprint to
-- fetch a signed URL from app/api/reports/clinic/[reportId]/url/route.ts
-- instead. whatsapp_sent_at
-- and email_sent_at are null on every row — no automated send is recorded —
-- but the one-off script that created these rows
-- (scripts/upload-reports-storage.ts) explicitly instructs the operator to
-- forward the link manually via WhatsApp, so a real send outside the app's
-- own tracking cannot be ruled out. Flagged for follow-up with the team —
-- see Sprint 15 report.

update storage.buckets set public = false where id = 'clinic-reports';

drop policy if exists "Public read clinic reports" on storage.objects;

-- No replacement SELECT policy is added for anon/authenticated — all access
-- to this bucket now flows exclusively through
-- app/api/reports/clinic/[reportId]/url/route.ts on the service-role client,
-- which bypasses RLS on storage.objects the same way it does on any table.
