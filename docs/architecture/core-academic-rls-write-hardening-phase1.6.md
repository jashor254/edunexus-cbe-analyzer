# Core Academic RLS Write Hardening — Phase 1.6

**Date:** 2026-07-27
**Scope:** Fix the same defect shape found and fixed on `school_users` (Phase 1.5) across every other table that has it — a `FOR ALL` RLS policy with no explicit `WITH CHECK`, letting Postgres silently reuse a permissive read-scoped `USING` clause for writes too.
**Method:** Static audit of every `FOR ALL` policy in the codebase (58 total, across 22 migrations, verified exhaustively via a dedicated completeness sweep); a full-codebase writer search to confirm intended authorization per table; real-session Supabase tests (no mocked outcomes); empirical spot-checks before and after the fix.

---

## 1. Executive verdict

**12 tables hardened, 2 real defects fixed, 0 legitimate functionality removed.** The starting inventory of 11 tables (from Phase 1.5's §9.1 residual-risk finding) was confirmed complete for that specific pattern, plus one additional table (`learner_projections`) was found carrying the identical write-escalation defect shape during this phase's own exhaustive sweep. All 12 are fixed by the same write correction: remove direct-client write access entirely (every real write already goes through the service-role client — verified per table), and narrow read access only where the broad "any active member" grant was itself an exposure (not just a write risk). While fixing `learner_projections`, a **second, independent** defect was found and fixed in the same table's policy: its read logic had never actually worked for a real session at all (§3.1) — not a regression from this phase, but a previously-undiscovered dead policy.

**GO for Phase 2.**

---

## 2. Starting inventory and completeness confirmation

The 11 tables named in Phase 1.5 (`academic_years`, `terms`, `streams`, `grade_subjects`, `class_subjects`, `learner_enrollments`, `term_subject_summaries`, `school_report_cards`, `attendance_sessions`, `attendance_records`, `core_guardian_invites`) were independently re-confirmed by reviewing every one of the 58 `FOR ALL` policies across all 22 migration files that contain them. All 58 were classified SAFE or FLAG; every SAFE policy was either self-ownership (`teacher_id = auth.uid()` with an explicit or structurally-equivalent `WITH CHECK`), role-gated to admin-tier, or service-role-only.

**One additional table found**: `learner_projections` (`supabase/migrations/20260707_learner_projections.sql`) — `FOR ALL` with `USING (... teacher-owns-student ... OR ... parent-owns-student ...)`, no separate `WITH CHECK`. A parent could directly INSERT/UPDATE/DELETE their own child's row in the Projection Engine's computed intelligence cache — setting arbitrary `confidence`, `value` (risk/growth/academic scores), etc. This is Learner Intelligence domain, not "Core Academic" by name, but the identical defect shape and severity class, so it's included here rather than deferred to a hypothetical "Phase 1.7."

No other table was flagged.

---

## 3. Correct authorization per table (how each read/write scope was decided)

Every real write to all 12 tables was confirmed, via a full-codebase search, to go exclusively through `lib/repositories/*.repository.ts` (all extend `BaseRepository`, which always uses `createServiceClient()`), `lib/core/guardianInvites.ts`, or `lib/projection/recompute.ts` — never a request-scoped client. This means **no legitimate direct-client write exists for any of the 12 tables, for any role** — the correction is uniform (remove write, matching the `school_users`/`blueprint_action_items`/`blueprint_snapshots` precedent), and only the **read** scope required per-table judgment:

| Table | Prior read scope | New read scope | Why |
|---|---|---|---|
| `academic_years`, `terms`, `streams`, `grade_subjects`, `class_subjects` | Any active member | **Unchanged** (any active member) | Non-sensitive structural/config data; only write was ever the real risk here |
| `learner_enrollments` | Any active member | **Staff only** (admin-tier + teacher) | Matches `learners_school_staff`'s existing, already-correct gate; no parent policy existed for this table before either — nothing lost |
| `term_subject_summaries` | Any active member | **Staff only** + existing `_parent_own_child` policy (untouched) | Before this fix, any parent could read every *other* learner's grades at the school — a real per-learner data exposure, not just a theoretical escalation risk |
| `school_report_cards` | Any active member | **Staff only** + existing `_parent_published` policy (untouched) | Same reasoning |
| `attendance_sessions`, `attendance_records` | Any active member | **Staff only** | Matches the *original migration's own documented intent* ("parent visibility... is a future, separately-gated integration, not this sprint's scope") — the SQL had admitted parents anyway; this fix makes the code match the stated intent |
| `core_guardian_invites` | Any active member | **Admin-tier only** | `token` is a bearer credential (same class of secret as a password-reset token) — broad readability let any active member, including parent, read every pending invite token at the school and potentially claim a guardian link that wasn't theirs |
| `learner_projections` | Teacher (own students) + parent (own child), **but never actually functional for a real session** (see below) | **Fixed to actually work**, using the same canonical `SECURITY DEFINER` functions `learner_evidence` already uses | A second, independent defect: see §3.1 |

Verification per table (confirming the intended write role, where the app enforces one, even though RLS no longer allows any direct-client write at all): `academic_years`/`terms` creation is gated by `requireSchoolAdmin` (`app/api/core/academic-years/route.ts`); classes/`class_subjects`-adjacent structural writes gated by `requireSchoolAdmin` (`app/api/core/classes/route.ts`); learner enrollment gated by `requireSchoolStaff` (`app/api/core/learners/[id]/route.ts`); attendance marking gated by `requireSchoolStaff` (`app/api/core/attendance/route.ts`); report-card editing/publishing gated by `requireSchoolAdmin`/`canEditReport` (`app/api/core/reports/route.ts`, and CLAUDE.md's own documented decision: "report publishing is deliberately NOT extended to class teachers").

### 3.1 A second, independent defect found while fixing `learner_projections`

The original `learner_projections_own_students` policy's `EXISTS (SELECT 1 FROM students s WHERE ...)` clauses are plain in-policy subqueries, not `SECURITY DEFINER` calls — so the inner lookup against `students` is itself subject to `students`' *own* RLS policies (`supabase/migrations/20260525_rls_policies.sql`), which grant `SELECT` only to a student's own self-service account or a legacy `teachers.role = 'admin'` row — **never** to a teacher-of-record or a parent. Verified empirically: a real teacher or parent session querying `learner_projections` under the original policy got **zero rows**, even for a learner they genuinely owned. The policy had never actually worked for a real session — only the service-role client (which bypasses `students`' RLS too) ever exercised it successfully, which is exactly why this had gone unnoticed.

This was not introduced by this migration, and is corrected in the same migration (not deferred) because it was directly encountered while fixing the table's write policy, and leaving a non-functional read policy in place while documenting it as "unchanged" would have been inaccurate. Fixed by reusing the exact canonical, already-`SECURITY DEFINER`, already-correct teacher/parent ownership functions `learner_evidence`'s own working policy already uses (`auth_is_direct_teacher_of_student`, `auth_is_teacher_of_student`, `auth_is_parent_of_student` — `20260720130000_sprint1_evidence_rls_bypass_fix.sql`), not a new one-off check. This also brings `learner_projections` into line with the platform-wide rule (CLAUDE.md, applied to `canViewLearner` in Phase 0) that `teacher_id` is attribution, never an access gate — current class membership via `class_students` is what actually governs teacher access.

---

## 4. Real-session test matrix

`lib/core/coreAcademicRlsHardening.integration.test.ts` — real Supabase sessions throughout:

- Structural tables (×3 sampled: `academic_years`, `terms`, `streams`) — admin cannot write directly; a parent can still read (broad read preserved); a School B member cannot read School A rows.
- `learner_enrollments` — a parent cannot read (staff-only); no direct write for admin.
- `term_subject_summaries` — staff (teacher) can read the general view.
- `school_report_cards` — no direct write for admin (publish stays service-role only).
- `attendance_sessions`/`attendance_records` — a parent cannot read either; staff (teacher) can read sessions; no direct write for staff.
- `core_guardian_invites` — a teacher (non-admin staff) cannot read invite tokens; admin cannot write directly either.
- `learner_projections` — the learner's own teacher and own parent can still read (unchanged); the parent can no longer write a fabricated projection value (the confirmed defect); an unrelated School B teacher cannot read.

Plus an empirical before/after spot-check (outside the formal suite) confirming the exact behavior change: a parent's direct `academic_years` INSERT attempt fails with `42501` post-fix (succeeded pre-fix, matching the `school_users` self-escalation pattern), while their `academic_years` SELECT still succeeds; a parent's `core_guardian_invites` SELECT now returns zero rows with no error (previously returned every pending token at the school).

---

## 5. Files changed

- `supabase/migrations/20260727090000_core_academic_rls_write_hardening.sql` — the corrective migration (additive, no destructive change, rollback documented and explicitly marked not-recommended for the sensitive tables).
- `lib/core/coreAcademicRlsHardening.integration.test.ts` — new real-session regression suite.
- This document.
- `docs/architecture/school-users-rls-regression-audit.md` §9 — updated to mark the 11-table (now 12-table) residual risk as resolved, linking here.
- `docs/engineering/implementation-log.md` — new entry.

---

## 6. Residual risks

- The exhaustive `FOR ALL` sweep (58 policies, 22 migrations) found no further tables matching this exact shape. It is a static-analysis sweep, not a runtime fuzzer — a table added after this audit with the same mistake would not be caught automatically; there is no lint rule enforcing "every `FOR ALL` policy must have an explicit `WITH CHECK` or be provably self-limiting." Adding such a check (e.g., a CI script that flags any `FOR ALL` policy without a paired `WITH CHECK`) would be a reasonable follow-up, not done here (would be tooling/process work, out of scope for a schema-focused phase).
- `class_subjects`' write path (assigning a teacher to a subject in a class) was inferred to be admin-gated from `app/api/core/classes/route.ts`'s `requireSchoolAdmin` calls, not from a route creating `class_subjects` rows directly by name — reasonably confident given the broader pattern, but not verified with the same precision as `academic_years`/`terms`/attendance/report-cards. Does not affect the fix's safety (write is removed for everyone regardless of which role it "should" be), only the documentation's confidence about intended future role-scoping if a `FOR INSERT`-with-`WITH CHECK` policy is ever added back for a specific role.

## 7. Recommendation

**GO for Phase 2.** All 12 tables now have RLS write policies that make writing directly as a client (any role) impossible, matching every other table this codebase has designed correctly from the start. Read access is preserved everywhere it was legitimately needed and narrowed everywhere it was a real, confirmed exposure (per-learner academic/attendance data, bearer tokens, computed intelligence values). No Blueprint Phase 2 functionality was started.
