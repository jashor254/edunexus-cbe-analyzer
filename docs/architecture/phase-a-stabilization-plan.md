# Phase A — Architecture Stabilization Plan

**Status: PLAN ONLY. Nothing in this document has been executed.** No migration has been applied, no file has been refactored, no route has been changed. Per `CLAUDE.md`'s "Before Building Any New Feature" sequence and the destructive/hard-to-reverse nature of merging live production tables (this platform has real data for the current pilot cohort — see `feedback_post-audit-operating-charter` in project memory: pilot observation is currently the stated priority, and this sprint's scope is larger than the "small trustworthy fixes only" charter that's been in effect since 2026-07-13). **This plan should be reviewed and explicitly approved, section by section, before any code or migration in it is executed.** That tension is flagged here, not resolved unilaterally — Phase A as scoped is architecturally correct and overdue, but it's a different category of work than what's been running since the charter, and the user driving it now (as Lead Architect) should confirm that's a deliberate scope change.

Grounded in the audit at [examination-report-card-system-audit.md](examination-report-card-system-audit.md) and real schema pulled from `lib/database.types.ts` (not assumed).

---

## 0. Real Schema, As It Stands Today

| Table | Has `school_id`? | Has `teacher_id`/owner? | Notes |
|---|---|---|---|
| `teacher_classes` | **No** | `teacher_id` | No FK to any school table at all |
| `classes` | Yes (nullable) | `class_teacher_id` | Core |
| `streams` | Yes | — | Core |
| `class_students` (Core) | via `class_id` | — | `class_id, student_id, parent_id` |
| `class_students` (legacy FK space) | via `class_id`→`teacher_classes` | — | same table name, different `class_id` target |
| `assessments` (legacy, per-student) | **No** | `user_id` (nullable) | No class linkage at all, `student_id` direct |
| `class_assessments` | **No** | `teacher_id` | Has `term` (string) and `year` (number), no `term_id`/`academic_year_id` FK |
| `learner_marks` | **No** | `teacher_id` | Has `class_id`, `position` (single, non-tie-aware) |
| `school_report_cards` | Yes | — | Core, has `position_in_class` |
| `term_subject_summaries` | Yes | — | Core, has `position_in_class` |
| `teachers` | **No** — only a free-text `school: string` column, not an FK | `user_id` | This is the blocker for Rule 1 |
| `school_users` | Yes | `user_id`, `role` | The real teacher↔school membership link |
| `academic_years` | Yes | — | Core only |

**The load-bearing fact this plan is built on:** `teachers.school` is a free-text string, not a foreign key. There is no reliable, queryable link from a legacy-path teacher to a `schools.id` today except by joining through `school_users` on `user_id` — and that join is only valid if every legacy teacher also has a `school_users` row, which is not guaranteed and must be verified before Rule 1 can be enforced for legacy data. This single fact governs the migration ordering below: **backfilling `school_id` correctly is the prerequisite for everything else**, not a side effect of it.

---

## 1. Detailed Migration Plan

Five ordered stages. Each stage is independently shippable and independently reversible (§9). No stage depends on UI changes (per objective 6, "do not redesign the UI").

**Stage 0 — Data audit (read-only, no schema change)**
Run a one-off query against production (via `mcp__supabase__execute_sql` in read-only mode, or a local report script) to answer, before writing a single migration:
- How many `school_users` rows exist per legacy teacher (`teachers.user_id`)? How many legacy teachers have zero `school_users` rows (would need a school created/assigned for them)?
- How many `teacher_classes` rows would map to zero, one, or many candidate schools?
- How many rows in `class_assessments`/`learner_marks` currently have ties in `position` per class — this quantifies the tie-handling bug's real-world blast radius before fixing it.
This stage produces numbers, not code, and gates whether Stage 1 needs a manual-reconciliation step or can be fully automatic.

**Stage 1 — Additive schema changes (non-breaking)**
Add nullable columns; do not drop or rename anything yet. This is the only stage allowed to touch schema before application code is updated to write them.
- `teachers`: add `school_id uuid references schools(id)` nullable. Backfill via `school_users` join where unambiguous (Stage 0 tells us how much is unambiguous).
- `class_assessments`: add `school_id uuid references schools(id)`, `academic_year_id uuid references academic_years(id)`, `term_id uuid` (or reuse whatever Core uses to identify a term — confirm `term_id` type against `school_report_cards.term_id`/`term_subject_summaries.term_id` before writing this column, do not assume a new terms table doesn't already exist), `created_by uuid references auth.users(id)`, `updated_by uuid references auth.users(id)`. Keep `teacher_id` as-is for now — do not remove it, it becomes `created_by`'s semantic equivalent but removing it is Stage 4, not Stage 1.
- `learner_marks`: add `position_rank int` (new, correct, tie-aware) alongside existing `position` (old, kept for one release as a compatibility read-fallback per §7).
- `teacher_classes`: add `school_id uuid references schools(id)` nullable, backfilled the same way as `teachers.school_id`.
- Every new FK column gets an index, per `CLAUDE.md`'s "Every FK column must have an index" rule.

**Stage 2 — Ranking Engine (code-only, no schema change beyond Stage 1's `position_rank`)**
Build `lib/ranking/rankingEngine.ts` (see §5) as the single source of truth for position computation. Have it write to the new `position_rank` column everywhere, read from `position_rank` with fallback to the old `position` field only where `position_rank` is null (covers historical rows). This is the one piece of Phase A that can ship independent of everything else and immediately fixes the tie-handling correctness bug identified in the audit.

**Stage 3 — Authorization gap fixes (code-only, no schema change)**
Fix the two role-gate gaps identified in the audit (`app/api/core/assessments` POST, `app/api/core/reports` update action) by matching the role check already used by sibling actions in the same files. Zero schema dependency — ship independently and first, since it's the highest-severity, lowest-risk item in this whole plan.

**Stage 4 — Consolidate Assessment creation (code-only + Stage 1 columns now populated)**
Designate `lib/core/assessments.ts::createAssessment` as canonical (it already writes to the shared `class_assessments`/`learner_marks` tables and is the one built against Core's role/membership model). Refactor `lib/assessments/mutations.ts::createAssessment` and its callers (`app/api/teacher/assessments/**`) to call the canonical function instead of maintaining a second write path, passing `created_by` (the acting teacher's `auth.users.id`) instead of relying on `teacher_id`-as-ownership. Every caller of the legacy function needs updating, not just the function itself — see §2 for the full call-site list.

**Stage 5 — Class domain consolidation (schema + code, highest risk, done last)**
Only after Stages 0-4 are stable in production: migrate `teacher_classes` rows into `classes`/`streams`, migrate the legacy-FK-space `class_students` rows into Core's `class_students`, then drop `teacher_classes` and the legacy `class_students` FK space. This is deliberately last because it's the only stage that deletes a live table teachers are actively writing to — it needs its own dry-run against a Supabase branch (`mcp__supabase__create_branch`) and explicit sign-off, not folded into the same release as the lower-risk stages.

---

## 2. Files Requiring Modification

**Stage 1 (schema):** new migration file only (see §3) — no application code changes required to *add* nullable columns, but `lib/database.types.ts` must be regenerated after (`mcp__supabase__generate_typescript_types`) before Stage 2+ code can reference the new fields with TypeScript safety.

**Stage 2 (Ranking Engine):**
- New: `lib/ranking/rankingEngine.ts`, `lib/ranking/rankingEngine.test.ts`
- Modify to consume it: `lib/assessments/mutations.ts` (`buildPositionMap` call sites: `bulkSaveMarks`, `upsertMarksCSV`) — delete the local `buildPositionMap`, import the engine instead.
- Modify: `lib/core/report-cards.ts` (`generateReportCards`, lines 36-51 inline sort) — replace with engine call.
- Modify: `lib/core/assessments.ts` (`updateClassPositions`, line 180) — replace with engine call.
- Modify: `lib/assessments/cohortQueries.ts` (`CombinedRankRow` construction in `getCohortData`/`getTeacherCohorts`) — replace ad-hoc combination with engine's cross-stream mode (§5).

**Stage 3 (authorization):**
- `app/api/core/assessments/route.ts` — add role check to `POST` handler, matching `app/api/core/classes/route.ts`'s pattern.
- `app/api/core/reports/route.ts` — change the `update` action's check from `getSchoolUser` membership-only to `isSchoolAdmin` (or a narrower "is this school's class teacher" check if admin-only is too strict for legitimate class-teacher comment edits — this needs a one-line product decision, flagged in §6 risk assessment, not assumed).

**Stage 4 (assessment consolidation):**
- `lib/assessments/mutations.ts` — `createAssessment` becomes a thin adapter calling `lib/core/assessments.ts::createAssessment`, or is deleted outright once all callers are migrated (prefer deletion — CLAUDE.md: no backwards-compat shims once truly unused).
- `app/api/teacher/assessments/route.ts` and sibling routes under `app/api/teacher/assessments/**` (12 routes per the audit) — repoint to the canonical function; add `created_by`/`updated_by` population from `auth.getUser()`.
- `lib/assessments/evidence.ts`, `lib/assessments/reportCardEvidence.ts` — update to read `created_by` for evidence attribution where they currently read `teacher_id`, per the CLAUDE.md rule that actor-id fields are attribution, never an access gate — this is a natural place to also correct any lingering `teacher_id`-as-gate usage while touching these files, but only if audit turns up an actual instance; do not go looking for unrelated cleanup.
- `lib/core/assessments.ts::createAssessment` — extend signature to accept `created_by`/`updated_by` explicitly rather than inferring solely from `teacher_id`.

**Stage 5 (class domain):**
- `app/api/teacher/classes/route.ts` — move inline logic to a new `lib/core/classes.ts` teacher-facing wrapper (e.g. `createClassAsTeacher`) that ultimately writes to `classes`/`streams`, not `teacher_classes`.
- Every reader of `teacher_classes`/legacy `class_students` — full list needs a dedicated grep pass at Stage 5 planning time (not enumerated here since Stage 5 is explicitly deferred and its callers may shift during Stages 1-4); flagged as a Stage 5 pre-work task, not skipped.
- `lib/database.types.ts` regenerated again after the drop.

---

## 3. Database Migrations (drafted, NOT applied)

Stage 1, as a single migration file (to be placed at `supabase/migrations/<timestamp>_phase_a_ownership_and_ranking_foundation.sql` only once approved — not written to that directory yet, kept here as a reviewable draft):

```sql
-- Stage 1: additive, non-breaking. No drops, no renames, no NOT NULL constraints yet.

alter table teachers
  add column if not exists school_id uuid references schools(id);
create index if not exists idx_teachers_school_id on teachers(school_id);

alter table teacher_classes
  add column if not exists school_id uuid references schools(id);
create index if not exists idx_teacher_classes_school_id on teacher_classes(school_id);

alter table class_assessments
  add column if not exists school_id uuid references schools(id),
  add column if not exists academic_year_id uuid references academic_years(id),
  add column if not exists term_id uuid,  -- FIXME: confirm actual term-identifier type against school_report_cards.term_id before applying
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id);
create index if not exists idx_class_assessments_school_id on class_assessments(school_id);
create index if not exists idx_class_assessments_academic_year_id on class_assessments(academic_year_id);

alter table learner_marks
  add column if not exists position_rank int;

-- Backfill teachers.school_id from the unambiguous subset of school_users
-- (Stage 0's data audit determines what "unambiguous" means here — e.g.
-- teachers with exactly one active school_users row).
update teachers t
set school_id = su.school_id
from (
  select user_id, school_id
  from school_users
  where is_active = true
  group by user_id, school_id
  having count(*) = 1  -- placeholder condition; refine per Stage 0 findings
) su
where t.user_id = su.user_id
  and t.school_id is null;
```

This migration is deliberately additive-only. It does not touch `assessments` (the legacy per-student table used by the AI auto-report path) because that table has no class/school concept at all today and folding it into the school-owned model is a separate design decision the audit flagged but did not resolve — including it here would be scope creep beyond what Rule 1 asks for (`class_assessments`/`learner_marks` are the tables that actually back the exam/report-card pipeline this sprint targets).

Stage 5's migration (class consolidation, DROP-bearing) is intentionally **not drafted here** — per §1, it needs its own dry-run against a Supabase branch after Stages 0-4 are live, and a DROP-bearing migration written speculatively before that dry-run risks being wrong in ways only real data will reveal.

---

## 4. API Changes

| Route | Change | Reason |
|---|---|---|
| `app/api/core/assessments/route.ts` `POST` | Add role check (school_admin/headteacher/deputy_headteacher/teacher-of-this-class) before create/save-scores/compute actions | Close Stage 3 authorization gap |
| `app/api/core/reports/route.ts` `POST` (`update` action) | Change membership-only check to admin or class-teacher-of-record | Close Stage 3 authorization gap |
| `app/api/teacher/assessments/**` (all 12 routes) | Repoint underlying calls from `lib/assessments/mutations.ts` to `lib/core/assessments.ts`; populate `created_by` from `auth.getUser()` instead of `teacher_id` | Stage 4 consolidation |
| `app/api/teacher/classes/route.ts` | `POST` moves off `teacher_classes` onto `classes`/`streams` via new `lib/core` wrapper | Stage 5 (deferred) |

No response shape changes are planned for any route — objective 6 ("preserve existing functionality," "do not change user workflows unless required for architectural consistency") means the JSON contracts teachers/parents already depend on stay stable; only the underlying write path and authorization changes.

---

## 5. Refactored Service Architecture

**`lib/ranking/rankingEngine.ts`** — the one new module this sprint introduces:

```typescript
export type RankableEntry<T> = { entity: T; score: number }
export type RankedEntry<T> = { entity: T; score: number; position: number; tied: boolean }

// Tie-aware: equal scores share a position; the next distinct score
// skips to reflect the number of entries above it (standard competition ranking).
export function rankByScore<T>(entries: RankableEntry<T>[]): RankedEntry<T>[]

// Cross-stream combination, replacing the ad-hoc logic in cohortQueries.ts.
export function combineStreamRankings<T>(
  streams: { streamId: string; ranked: RankedEntry<T>[] }[]
): RankedEntry<T>[]
```

This absorbs `buildPositionMap` (legacy, already tie-aware — its algorithm is the one to keep, per the audit's finding that it's the only one of the three that handles ties correctly), and replaces the two non-tie-aware inline sorts in `lib/core/report-cards.ts` and `lib/core/assessments.ts::updateClassPositions`. Every call site listed in §2 Stage 2 switches to this module; no call site gets its own reimplementation going forward — this is the mechanism, not just the migration, that satisfies Rule 2/Rule 3 for rankings specifically.

**Assessment ownership model** (objective 5): `lib/core/assessments.ts::createAssessment` gains `created_by: string` (required) and `updated_by: string` (set on every subsequent `updateAssessment`/`saveScores` call) parameters, sourced from `auth.getUser().id` in the calling route — never trusted from the request body, per `CLAUDE.md`'s security rules, same as `userId` verification already required elsewhere. `teacher_id` stays on `class_assessments`/`learner_marks` for now (dropping it is out of scope for Phase A — objective 5 explicitly says "do not implement moderation or approval yet, only prepare the architecture," and removing `teacher_id` entirely would break the teacher-facing "my classes" queries that Stage 5 hasn't consolidated yet). `moderated_by`/`approved_by`/`published_by` columns are **not** added in Phase A per the explicit instruction — the architecture is prepared (via `created_by`/`updated_by` establishing the audit-field pattern and the school-ownership FK chain) without building the workflow those columns would support.

---

## 6. Risk Assessment

| Risk | Stage | Severity | Mitigation |
|---|---|---|---|
| `teachers.school_id` backfill is ambiguous for teachers with 0 or >1 `school_users` rows | 1 | High | Stage 0's data audit quantifies this *before* writing the backfill query; ambiguous rows stay `null` and get a manual-reconciliation follow-up, not a guessed value |
| Ranking Engine changes visible `position` numbers on already-published, parent-facing report cards | 2 | Medium | Only affects report cards generated *after* the fix ships; historical published cards are not retroactively recomputed (explicitly out of scope — recomputing a published document a parent has already seen is its own product decision, not a silent side effect of this sprint) |
| Authorization tightening in Stage 3 breaks a legitimate current workflow (e.g. a class teacher who isn't `school_admin`-tier currently relies on editing report-card comments) | 3 | Medium | The exact replacement check ("admin-only" vs "admin-or-class-teacher-of-record") is flagged as a one-line product decision in §2, not pre-decided by this plan — confirm against real usage before shipping |
| Stage 4's call-site migration misses a caller of the legacy `createAssessment`, leaving orphaned code that silently diverges again | 4 | Medium | Delete the legacy function once migrated rather than leaving it as a dead-but-callable shim — a compile error on any missed caller is a better failure mode than silent divergence |
| Stage 5's table drops lose data if the migration mapping is wrong | 5 | Critical | Explicitly deferred to its own dry-run-on-a-branch process, not bundled into this plan's execution |
| This entire sprint's scope exceeds the "small trustworthy fixes only, observe pilot usage" charter currently in effect | All | Process risk, not technical | Flagged at the top of this document — needs explicit user confirmation this is an intentional scope change, not something to silently proceed past |

---

## 7. Backward Compatibility Analysis

- Stage 1 is additive-only: existing reads of `class_assessments`/`learner_marks`/`teacher_classes` continue to work unchanged, since no existing column is renamed, retyped, or dropped.
- Stage 2 keeps `learner_marks.position` populated alongside the new `position_rank` for one full release cycle, so any external consumer (PDF exports, CSV downloads per `upsertMarksCSV`'s counterpart read paths) reading the old field isn't broken mid-migration; the old field is dropped only in a follow-up cleanup after confirming no reader remains (a Stage 2.5, not specified further here since it's routine cleanup, not architecture).
- Stage 3's authorization tightening is the one change with a real chance of breaking an existing, currently-working user action (see risk table) — this is why it's flagged for a product decision rather than assumed safe.
- Stage 4 preserves the external API response shape of every `app/api/teacher/assessments/**` route; only the internal implementation and the `created_by` audit trail change.
- Stage 5 is the only stage that is not backward compatible by design — it deletes a table. It is sequenced last and gated on its own separate approval specifically because of this.

---

## 8. Test Plan

- **Stage 0:** none (read-only queries, verified by manual inspection of output, not unit tests).
- **Stage 1:** migration idempotency test (`if not exists` on every clause, re-running the migration twice must be a no-op); backfill correctness spot-check against Stage 0's audit numbers (does the count of newly-populated `school_id` values match the "unambiguous" count from Stage 0?).
- **Stage 2 (Ranking Engine) — the one component this plan calls out for "comprehensive tests" per objective 4:**
  - Empty input → empty output.
  - Single entry → position 1, not tied.
  - All entries tied (identical scores) → all share position 1.
  - Partial ties (e.g. scores `[90, 85, 85, 70]`) → positions `[1, 2, 2, 4]` (competition ranking, matching `buildPositionMap`'s existing legacy behavior — this is a regression test asserting the *fixed* behavior matches what the audit confirmed was already correct in the legacy path, so the fix doesn't accidentally change tie semantics from what teachers are used to).
  - Cross-stream combination with differing stream sizes.
  - Snapshot test: run the engine against the same fixture data `lib/core/report-cards.ts`'s old inline sort would have produced, confirm every non-tied case matches exactly (proves the fix doesn't silently change untied rankings, only fixes ties).
- **Stage 3:** integration test per fixed route — a request from a non-admin school member must now 403 on the previously-open actions; a request from an admin/authorized class-teacher must still succeed.
- **Stage 4:** every migrated route's existing test suite (if any exists — flagged as a pre-check, not assumed) must still pass unchanged, since response shape is preserved; add one new test per route confirming `created_by` is populated from `auth.getUser()` and never trusted from the request body.
- **Stage 5:** deferred along with the stage itself; a full test plan for it should be written as part of its own dry-run process, not speculated here.

---

## 9. Rollback Strategy

- **Stage 1:** additive columns — rollback is `DROP COLUMN IF EXISTS` for each added column, safe at any point since nothing yet depends on them being populated.
- **Stage 2:** the engine is called alongside (not instead of, until proven correct) the old inline sorts for one release if extra caution is wanted — but since Stage 2 is a pure function swap with no schema dependency, the simpler rollback is reverting the commit; no data is destroyed by shipping it.
- **Stage 3:** revert the commit; the added role checks have no schema/data footprint.
- **Stage 4:** keep the legacy `createAssessment` function in the codebase (not yet deleted) for the duration of the migration window specifically so rollback is "revert the route changes," not "resurrect deleted code" — only delete it once Stage 4 has been live and stable for an agreed observation period, consistent with the pilot-observation instinct already in the project's operating charter.
- **Stage 5:** rollback plan is written as part of that stage's own dry-run process (restoring from the pre-drop branch snapshot via `mcp__supabase__reset_branch` or equivalent) — not specified further here since the stage itself is deferred pending separate approval.

---

## 10. Final Architecture Verification Checklist

Phase A is complete only when every item below is independently verifiable against the live codebase (not just "this plan addresses it"):

- [ ] One Class domain exists — `teacher_classes` dropped, all class reads/writes go through `classes`/`streams` (Stage 5).
- [ ] One Assessment domain exists — `lib/assessments/mutations.ts::createAssessment` deleted, every caller uses `lib/core/assessments.ts::createAssessment` (Stage 4).
- [ ] One Ranking Engine exists — `buildPositionMap`, the `report-cards.ts` inline sort, and `updateClassPositions`'s inline sort are all deleted, all three (plus `cohortQueries.ts`) call `lib/ranking/rankingEngine.ts` (Stage 2).
- [ ] One Report generation pipeline exists — confirmed no second report-generation code path remains once Stage 4/5 land (the audit's "legacy AI auto-reports vs. Core `school_report_cards`" duplication needs a resolution decision that this plan has not made — flagged as an open item, not silently assumed solved by Stages 1-5).
- [ ] Critical security issues resolved — both `app/api/core/assessments` and `app/api/core/reports` role gaps closed and covered by the Stage 3 integration tests (Stage 3).
- [ ] Every assessment belongs to a School — `class_assessments.school_id` is non-null for all new rows (Stage 1 + Stage 4); historical backfill completeness reported against Stage 0's ambiguous-row count, not assumed 100%.
- [ ] Teachers operate through permissions rather than ownership — `created_by`/`updated_by` populated on every write, and no remaining code path gates *read* access to assessment data using `teacher_id`, per the existing `CLAUDE.md` rule (Stage 4).
- [ ] No duplicate business logic remains — cross-checked against the audit's §2/§5 duplication inventory item by item, not just the four items called out above.

**Open item this plan does not resolve, flagged for explicit decision before Phase A can be marked complete:** the legacy per-student `assessments` table (AI auto-report path) and its relationship to `class_assessments`/`school_report_cards` was intentionally left out of Stages 1-5 (see §3) because folding it in wasn't part of Rule 1/2's literal scope (which named Classes/Learners/Assessments/Rankings/Reports built on `class_assessments`, the table that actually backs the school-owned exam pipeline) — but the audit's "two report-card pipelines" duplication finding won't be fully closed until someone decides what happens to that table. Surfacing this now rather than letting Phase A's checklist quietly redefine "done" to exclude it.
