# `school_users` RLS Regression Audit — Phase 1.5

**Date:** 2026-07-26
**Scope:** Focused security regression audit of the `school_users` RLS recursion correction introduced during Blueprint Living Action Plan Phase 1 (`supabase/migrations/20260725130000_fix_school_users_rls_recursion.sql`).
**Method:** Static inspection of every migration and SECURITY DEFINER function touching `school_users`; a full-codebase dependency search; real-session Supabase tests (no mocked policy outcomes) covering reads, writes, and privilege-escalation probes; comparison of DB-level RLS behavior against app-level authorization.

---

## 1. Executive verdict

**One additional real defect was found and fixed.** The Phase 1 recursion correction itself is safe and does exactly what it claims — it does not introduce, weaken, or widen anything. But auditing it surfaced a second, independent, **pre-existing, severe** defect in the same policy that the recursion fix did not touch: `school_users`' `FOR ALL` policy had no explicit `WITH CHECK`, so Postgres silently reused the (permissive) `USING` clause for writes too — letting any authenticated user self-insert a `school_admin` row for any school, with zero prior relationship to it. This was verified empirically with a real signed-in session before being fixed, and again after, in `supabase/migrations/20260726090000_fix_school_users_self_escalation.sql`.

A related, broader finding — the same unrestricted `FOR ALL` shape recurs across 11 other tables — is **not** fixed in this phase (see §9); it is a real, high-severity systemic pattern but fixing it would be the "broad redesign of school authorization" this phase was explicitly told not to do.

**Recommendation: Phase 2 may begin**, conditioned on the residual risk in §9 being tracked as a required near-term follow-up, not silently dropped.

---

## 2. Original recursion chain

`school_users_own_school` (defined in `20260629_core_foundation.sql`) was:

```sql
CREATE POLICY "school_users_own_school"
  ON school_users FOR ALL
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = school_users.school_id
        AND su.user_id = auth.uid()
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher')
        AND su.is_active = true
    )
  );
```

A plain, non-`SECURITY DEFINER` subquery against `school_users` from directly inside `school_users`' own policy. PostgreSQL's RLS recursion guard rejects this the moment a real (non-service-role) session evaluates it, raising `42P17 infinite recursion detected in policy for relation "school_users"`. This had gone unnoticed because every application read of `school_users` goes through the service-role client (§7) — the first real-session exercise of this exact path was `lifecycle.integration.test.ts` tests #18/#18b, written for the unrelated `blueprint_action_items` table, which happens to join into `school_users`.

## 3. Correction mechanism

`20260725130000_fix_school_users_rls_recursion.sql` extracted the admin-tier check into a `SECURITY DEFINER` function, the same pattern already established for `auth_owns_student`/`auth_is_teacher_of_student`/`auth_is_parent_of_student` (`20260525_rls_policies.sql`):

```sql
CREATE OR REPLACE FUNCTION auth_is_school_admin_of(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM school_users su
    WHERE su.school_id = p_school_id
      AND su.user_id = auth.uid()
      AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher')
      AND su.is_active = true
  )
$$;
```

A `SECURITY DEFINER` function executes with the privileges of its owner (`postgres`), which is not itself subject to `school_users`' RLS — the inner `SELECT` no longer triggers policy evaluation on `school_users` a second time, breaking the recursion. Confirmed with a real session: `42P17` no longer occurs on any query tested (§7 of the fix migration's own test coverage, and independently re-confirmed in this audit's test suite, §7 below).

## 4. SECURITY DEFINER safety review

| Property | `auth_is_school_admin_of` | Assessment |
|---|---|---|
| `SECURITY DEFINER` | Yes | Correct — required to bypass RLS on the table it's called from |
| Owner | `postgres` | Matches every sibling helper |
| `search_path` | Fixed: `SET search_path = public` | Safe — prevents search-path hijacking; `school_users` in the body resolves unambiguously to `public.school_users` regardless of the caller's own `search_path` |
| Parameters | `p_school_id uuid` only | No user-identity parameter exists at all — there is no "pass another user's ID" surface (verified in test D3) |
| Identity source | `auth.uid()`, read internally | The caller cannot override which identity is checked |
| Caller-controlled school ID | Yes, but harmless | The function only ever answers "is `auth.uid()` an admin **at this specific school**" — passing an arbitrary `school_id` just asks a true/false question about the caller's own real membership there; it cannot grant anything (verified in test D4) |
| Return value | `boolean` | Minimum possible information — no row data, no other users' identities |
| `EXECUTE` grants | `PUBLIC`, `anon`, `authenticated`, `service_role`, `postgres` (Postgres default — not explicitly narrowed) | Matches the sibling functions' identical (also-unnarrowed) posture; not a new gap, and the function leaks nothing beyond what a client could already infer indirectly by attempting an admin-gated action and observing success/failure. Noted as a low-severity, non-blocking observation, not corrected here to avoid inconsistently hardening one function while leaving its siblings untouched (would be a partial fix outside this phase's scope) |

All required safety properties hold: fixed `search_path`, no user-controlled identity, minimum-necessary return type, no hidden data exposure. **No correction was required for this function.**

## 5. Dependency map

Full detail was produced by a dedicated research pass across every migration referencing `school_users` and every application code path. Summary:

| Dependent table/feature | Policy/function | Authorized roles | School boundary | R/W | Regression status | Risk |
|---|---|---|---|---|---|---|
| `school_users` | `school_users_own_school_read` (post-fix) | self + admin-tier | own `school_id` | R only (post-fix) | Tested, passing | Was Critical (self-escalation), now Low |
| `blueprint_action_items` | `blueprint_action_items_school_staff_read` | admin-tier + teacher (parent excluded) | `school_id` match | R only | Tested, passing | Low |
| `blueprint_action_item_history` | `blueprint_action_item_history_school_staff_read` | admin-tier + teacher | via parent item | R only | Tested, passing | Low |
| `blueprint_snapshots` | `blueprint_snapshots_school_staff_read` | any active member | `school_id` match | R only | Not independently re-tested this phase; structurally safe (no write policy) | Low |
| `teacher_reflections` | `teacher_reflections_school_staff_read` | any active member | `school_id` match | R only | Same | Low |
| `learners`, `learner_guardians`, `learner_promotions`, `learner_transfers` | role-gated `FOR ALL` policies | admin-tier (+teacher for learners/guardians) | `school_id` match | R/W | Not independently re-tested; role-gated, so the implicit-WITH-CHECK caveat is harmless here | Low |
| `academic_years`, `terms`, `streams`, `grade_subjects`, `class_subjects`, `learner_enrollments`, `term_subject_summaries`, `school_report_cards`, `attendance_sessions`, `attendance_records`, `core_guardian_invites` | `*_school_users`/`*_school_staff` (misnamed — no role filter) | **any active member of the school, including `parent`** | `school_id` match | R/W (`FOR ALL`, same implicit-WITH-CHECK shape as the `school_users` defect) | **Not fixed this phase — flagged as residual, see §9** | **High (systemic)** |
| `school_settings` | `school_settings_admin_only` | admin/headteacher only | `school_id` match | R/W | Role-gated; caveat harmless | Low |
| `learner_wellbeing_*` | membership-team-scoped | `wellbeing_support_team` members only | per-case | R only | Strictest existing pattern, not blanket school membership | Low |
| `class_resources`, `course_materials` | teacher-crud via legacy `teachers` table | class teacher only | `class_id` match | R/W, explicit `WITH CHECK` | Does not join `school_users` at all | Out of scope, not affected |

Every application-code read/write of `school_users` (`lib/repositories/school.repository.ts`, `lib/repositories/teacher.repository.ts`, `lib/auth/getRole.ts`, `lib/core/identity.ts`'s `resolveMembership`) uses `BaseRepository`'s `createServiceClient()` — service-role, RLS bypassed entirely. **No production application code path was ever exposed to either the recursion bug or the self-escalation bug** — both were reachable only by a client querying `school_users` (or a dependent table) directly with a real session, e.g. any signed-up user calling Supabase's auto-exposed REST API directly, bypassing the Next.js app entirely. This is a real external attack surface regardless of what the app itself does — Supabase exposes every public table over PostgREST by default.

## 6. Real-session test matrix

`lib/core/schoolUsersRlsRegression.integration.test.ts` — 21 tests, all against real Supabase sessions/service-role/anon clients, all passing:

| # | Test | Result |
|---|---|---|
| C1 | Admin reads every row at their own school (self + others) | ✔ |
| C1b | Non-admin (teacher) sees only their own row | ✔ |
| C2 | School A staff (admin, teacher) cannot read School B rows | ✔ |
| C3 | Parent cannot enumerate staff — own row only | ✔ |
| C4 | Authenticated non-member gets zero rows, no error | ✔ |
| C5 | Anonymous session gets zero rows, no error, no leak | ✔ |
| C6/C7 | No `42P17` across admin/teacher/parent/non-member/anon sessions | ✔ |
| C9 | School A admin cannot read/write School B `blueprint_action_items` | ✔ |
| C10/C11 | `canManageLearnerRecordCore` matches Phase 0 rule post-fix (teacher-of-record allowed, unrelated teacher denied) | ✔ |
| C12/C13 | `canViewLearnerRecord` denies an unrelated stranger post-fix | ✔ |
| C14 | Deactivated teacher: no manage authorization; own row still visible to self, nothing broader | ✔ |
| C16 | Service-role bypasses RLS as intended | ✔ |
| C17 | Blueprint action-item RLS still denies raw parent reads (no regression) | ✔ |
| C18 | `blueprint_action_item_history` cannot be written directly by any session | ✔ |
| C19 | History rows immutable under a direct session update attempt | ✔ |
| C20 | 10 consecutive queries, never recurses | ✔ |
| D1 | Non-member cannot self-insert a `school_admin` row (**the confirmed-and-fixed defect**) | ✔ |
| D2 | Legitimate teacher cannot self-UPDATE their own row to `school_admin` | ✔ |
| D3 | `auth_is_school_admin_of` cannot be tricked into answering for another user — no such parameter exists | ✔ |
| D4 | Passing a different `school_id` never grants anything — only ever answers about the real caller | ✔ |
| D5 | A user with two independent school memberships: each correctly scoped, no cross-contamination, no admin leakage | ✔ |

Retries used: `mkUser`/`signInAs` fixture provisioning only, up to 6 attempts with linear backoff, for a confirmed external Supabase auth-admin flake independently reproduced with a zero-application-code probe script (documented in the Phase 1 report). **No authorization assertion was ever retried** — every `assert.equal`/`assert.deepEqual`/`assert.ok` on an access-control outcome ran exactly once against a freshly-established, verified session.

## 7. Privilege-escalation findings

| Probe | Outcome |
|---|---|
| Call the SECURITY DEFINER helper with another user's ID | Impossible — the function has no user-id parameter; identity is always `auth.uid()` (schema/function-signature constraint, not a runtime check) |
| Pass another school's ID | Harmless — only ever answers about the real caller at that school (test D4) |
| Manipulate `search_path` | Blocked — fixed `SET search_path = public` on the function |
| Role-name spoofing via parameters | Impossible — no role parameter exists; role is read from the caller's own real row |
| Inactive membership satisfying role checks | Blocked — `auth_is_school_admin_of` requires `is_active = true`; verified in test C14 |
| Duplicated `school_users` rows | Constrained — `UNIQUE (school_id, user_id, role)` prevents exact duplicates; a user may hold *different* roles at the *same* school as separate rows, each independently and correctly scoped |
| Cross-school duplicate roles | Verified safe — test D5: a user with a teacher role at two schools gains admin at neither |
| A user who is both parent and staff | Schema-permitted (different `role` values, same `user_id`/`school_id` pair is allowed since `role` is part of the unique key) — each row is independently checked by the read policy; no combination grants more than the union of what each row alone would grant |
| A user who changes schools | Not a distinct code path — handled by the same per-row `school_id` matching; an old membership row for a prior school continues to behave exactly as any other row (still requires `is_active = true` for admin-tier checks) |
| Revoked staff membership | `deactivateSchoolUser` sets `is_active = false`; verified this correctly removes admin-tier and manage authorization (test C14) while leaving the row itself visible to its own owner (§8) |
| Null/malformed membership fields | Impossible — `school_id`/`user_id`/`role` are all `NOT NULL`, `role` is `CHECK`-constrained to five values, `school_id`/`user_id` are FKs with `ON DELETE CASCADE` (an orphaned row referencing a deleted school or user cannot exist) |
| Access through views or RPC bypassing the intended policy | None found — no view wraps `school_users`; the one RPC (`auth_is_school_admin_of`) is a narrow boolean, not a data-returning bypass |
| **Direct self-insertion of an admin row (not explicitly listed in Part D, found during Part A/D cross-check)** | **Confirmed exploitable pre-fix, confirmed blocked post-fix** — see §8 |

## 8. Confirmed defect and correction

**Defect:** `school_users_own_school`, both before and immediately after the recursion fix, was declared `FOR ALL` with only a `USING` clause. Postgres defaults `WITH CHECK` to the same expression when none is given. The `USING` expression's first branch, `user_id = auth.uid()`, is trivially satisfiable for any row a client inserts naming themselves — with no requirement that `school_id` or `role` bear any relationship to a real, prior membership. `anon`/`authenticated` hold full `INSERT`/`UPDATE`/`DELETE` grants on `school_users` (Supabase's default public-schema grants) — RLS was the only barrier, and it was not stopping this.

**Verified exploit (before fix):** a freshly-created user, with zero prior relationship to a school, ran `client.from('school_users').insert({ school_id: <arbitrary>, user_id: auth.uid(), role: 'school_admin', is_active: true })` and it succeeded.

**Correction:** `supabase/migrations/20260726090000_fix_school_users_self_escalation.sql` — split the policy to `FOR SELECT` only. No INSERT/UPDATE/DELETE policy exists for `authenticated`/`anon` at all, so RLS's default-deny applies to writes for any role subject to RLS. Verified: every legitimate application write path (`upsertSchoolUser`, `updateSchoolUserRole`, `deactivateSchoolUser` in `lib/repositories/teacher.repository.ts`; school creation in `lib/repositories/school.repository.ts`) already used the service-role client exclusively — this migration removes zero legitimate functionality. Confirmed post-fix: the same exploit attempt now fails with `42501` (RLS policy violation); a legitimate own-row `UPDATE` attempt (e.g., a teacher trying to self-promote) affects zero rows rather than erroring, which is the correct RLS behavior for "no policy grants this."

## 9. Residual risks

1. **RESOLVED 2026-07-27 (Phase 1.6)**: the identical unrestricted `FOR ALL` shape recurred across 11 other tables — `academic_years`, `terms`, `streams`, `grade_subjects`, `class_subjects`, `learner_enrollments`, `term_subject_summaries`, `school_report_cards`, `attendance_sessions`, `attendance_records`, `core_guardian_invites` — plus one further table (`learner_projections`) found during Phase 1.6's own completeness sweep. All 12 fixed in `supabase/migrations/20260727090000_core_academic_rls_write_hardening.sql`; a second, independent, previously-non-functional read policy on `learner_projections` was also found and fixed in the same migration. Full findings: `docs/architecture/core-academic-rls-write-hardening-phase1.6.md`.
2. `auth_is_school_admin_of`'s `EXECUTE` grant is unnarrowed (default `PUBLIC`), matching every sibling helper — low severity, not corrected to avoid a one-off inconsistent hardening pass.
3. `blueprint_snapshots`/`teacher_reflections` and the other `*_school_staff_read`-pattern tables in §5 were not independently re-tested with fresh real-session tests this phase (only reasoned about structurally) — they inherited the recursion fix automatically and have no write policy, so risk is assessed Low, but a future pass could add direct coverage.

## 10. Recommendation

**Phase 2 (Blueprint delivery fan-out) may begin.** The specific defect this audit was scoped to regress-test (`school_users`' own policy) is now fully closed — both the recursion bug and the previously-undiscovered self-escalation bug — and verified with 21 real-session tests plus the existing Phase 0/Phase 1 suites, none of which regressed. The one open item (§9.1) was itself resolved in Phase 1.6 (`docs/architecture/core-academic-rls-write-hardening-phase1.6.md`), closing the loop on this entire audit chain.
