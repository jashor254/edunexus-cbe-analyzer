# Phase A — Architecture Stabilization: Stage-Gated Execution Plan

**This is the authoritative execution plan for Phase A**, restructured to the per-stage template the user specified. It supersedes the deliverable-numbered format of [phase-a-stabilization-plan.md](phase-a-stabilization-plan.md), whose schema grounding (§0 real table shapes, `teachers.school` being a free-text string not an FK) still stands and is reused here rather than re-derived. Findings originate from [examination-report-card-system-audit.md](examination-report-card-system-audit.md).

**Standing guardrail for every stage below (Rule 8 + the Learning Evidence separation):** nothing in Phase A touches `lib/intelligence/`, `lib/projection/`, `lib/learnerRecord/`, `lib/compass/`, `lib/adaptiveLearning/`, `lib/academicClinic/`, or the Evidence Domain's tables. Those systems already correctly treat marks/assessments as one *input* among several to Learning Evidence (via `lib/assessments/reportCardEvidence.ts` and `lib/assessments/evidence.ts` writing into the Evidence Domain) — Phase A consolidates the Official Assessment side that produces that input, and explicitly does not touch, merge into, or restructure the Evidence Domain itself. Any stage below that appears to require touching those modules should stop and be re-scoped, not proceed.

**Execution discipline:** each stage ends with an explicit exit criteria checklist. No stage begins until the prior stage's checklist is confirmed complete by the user. Nothing in this document has been executed yet — Stage 0 is proposed next, pending approval.

---

## Stage 0 — Read-Only Production Audit

**Goal:** Quantify ambiguity before any schema or code change is written, per Rule 5. Answer three questions with real numbers: (1) how many legacy teachers can be unambiguously linked to a school via `school_users`, (2) how many `teacher_classes` rows would map to zero/one/many candidate schools, (3) how many existing `class_assessments`/`learner_marks` rows have tied `position` values within a class — this last number is the real-world blast radius of the ranking bug this sprint will fix.

**Architecture reasoning:** Every later stage's safety depends on these numbers being real rather than assumed. The Third Law requires every record to have a School owner, but `teachers.school` being free text (not an FK) means we don't yet know how much of the fleet can even honestly claim a School owner without manual reconciliation. Guessing here would mean Stage 3's backfill either silently mis-assigns records to the wrong school or silently leaves them unowned — both are violations of the Seventh Law's Audit-before-Add sequencing.

**Files affected:** None. This stage produces a report, not code. Queries run via `mcp__supabase__execute_sql` (read-only) or an equivalent local report script under the scratchpad, never against application code paths.

**Database impact:** None. Read-only `SELECT`/`COUNT`/`GROUP BY` queries only. No `INSERT`/`UPDATE`/`DDL`.

**API impact:** None.

**Risk analysis:** Effectively zero — the only risk is query cost/load on production if run against a large table without limits; mitigated by running aggregate queries, not row-by-row scans, and by using a read replica or Supabase branch if available rather than the primary.

**Security impact:** None directly — but this stage indirectly derisks Stage 1 by confirming, before any authorization fix ships, which `school_users` rows are real/active and which routes' role checks will actually change behavior for real users versus theoretical ones.

**Migration strategy:** N/A — no migration in this stage.

**Rollback strategy:** N/A — nothing is written.

**Test strategy:** N/A — output is verified by manual inspection against expectations (e.g. "does the `school_users` unambiguous-teacher count roughly match the known pilot teacher count of ~50?").

**Exit criteria:**
- [ ] Count of teachers with exactly one active `school_users` row (safe to auto-backfill `school_id`) vs. zero vs. multiple (needs manual reconciliation) is documented.
- [ ] Count of `teacher_classes` rows per backfill-ambiguity bucket is documented.
- [ ] Count and distribution of tied `position` values in `learner_marks`/`class_assessments` per class is documented.
- [ ] User has reviewed the numbers and confirmed Stage 1 may begin.

**Success metrics:** 100% of the three questions answered with exact counts, not estimates; zero write operations performed; ambiguity bucket sizes known precisely enough that Stage 3's backfill predicate can be written without guessing.

---

## Stage 1 — Authorization Fixes (Security Before Architecture, per Rule 6)

**Goal:** Close the two confirmed authorization gaps from the audit before any architectural work begins, since Rule 6 places security strictly ahead of consolidation.

**Architecture reasoning:** This stage touches zero architecture by design — the Sixth Law ("Security before architecture") means Stage 1 must not be bundled with, or made to wait for, any consolidation work. Fixing these gaps now, before Stage 2-5 change any of the code paths involved, also means the security fix doesn't have to be re-verified against a moving target later.

**Files affected:**
- `app/api/core/assessments/route.ts` — `POST` handler (create/save-scores/compute actions) currently checks only `getSchoolUser` membership; add a role check matching the pattern already used in `app/api/core/classes/route.ts` (`['school_admin','headteacher','deputy_headteacher']`, plus the assigned subject teacher for that specific class where legitimate — see open decision below).
- `app/api/core/reports/route.ts` — `POST` `update` action (currently membership-only) must be changed to require `isSchoolAdmin` or "is the class-teacher-of-record for this report," matching the stricter check its sibling `publish`/generate actions already use in the same file.

**Database impact:** None. This stage is code-only.

**API impact:** Requests to the two fixed actions from users who are school members but not admin/authorized-teacher will now correctly receive `403` instead of succeeding. No response shape changes for authorized requests.

**Risk analysis:** The main risk is tightening the check further than the real current workflow needs — e.g. if a non-admin class teacher today legitimately edits report-card comments through the `update` action, an admin-only fix would break that. This is flagged as an **open product decision, not resolved by this plan**: "admin-only" vs. "admin-or-class-teacher-of-record" needs a one-line confirmation before this stage ships, ideally checked against Stage 0-style real usage data (does any non-admin school_user currently call this action in logs?) rather than assumed.

**Security impact:** Directly closes two confirmed tenant-isolation/authorization gaps — a non-admin school member can currently save assessment scores school-wide and edit headteacher-attributed report-card comments school-wide. This is the single highest-value security fix identified in the audit, and per the Sixth Law it ships before any of Stages 2-5 regardless of their own merits.

**Migration strategy:** N/A — no schema change.

**Rollback strategy:** Revert the commit. No data or schema footprint to unwind.

**Test strategy:** Integration test per route: a request from a non-admin, non-class-teacher school member must now `403` on the previously-open actions; a request from an admin (and, if the open decision above resolves that way, the assigned class teacher) must still succeed unchanged.

**Exit criteria:**
- [ ] Both role-gate gaps closed and verified by integration test.
- [ ] The admin-only vs. admin-or-class-teacher decision explicitly confirmed with the user (not defaulted silently).
- [ ] No regression in existing authorized workflows (verified via the `verify` skill against a real school/report-card in a non-prod environment).
- [ ] User confirms Stage 2 may begin.

**Success metrics:** 2/2 confirmed authorization gaps closed; 0 regressions in previously-authorized workflows; 100% of the two fixed routes covered by a new integration test asserting both the 403-for-unauthorized and 200-for-authorized cases.

---

## Stage 2 — One Ranking Engine

**Goal:** Eliminate all three independent ranking implementations (`buildPositionMap` in `lib/assessments/mutations.ts`, the inline sort in `lib/core/report-cards.ts`, `updateClassPositions` in `lib/core/assessments.ts`) and the ad-hoc combination logic in `lib/assessments/cohortQueries.ts`, replacing them with one tie-aware engine every consumer calls. This is the stage that directly fixes the correctness bug (untied sequential positions on tied scores) the audit found reaching published, parent-facing report cards.

**Architecture reasoning:** Direct application of the First Law — Ranking is one educational concept and gets exactly one canonical service. The Canonical Domain Registry's Ranking entry moves from `TARGET (Phase A)` to `CANONICAL` at the close of this stage, and the Deprecation Registry's entry #4 moves from `IDENTIFIED` to `REMOVED` once all four call sites are migrated and the old implementations deleted outright (not wrapped — per the Architectural Discipline section, delete duplication, don't hide it).

**Files affected:**
- New: `lib/ranking/rankingEngine.ts` — exports `rankByScore<T>()` (tie-aware, competition ranking — ties share a position, the next distinct score skips accordingly, matching `buildPositionMap`'s already-correct legacy behavior) and `combineStreamRankings<T>()` (cross-stream combination, replacing `cohortQueries.ts`'s ad-hoc logic).
- New: `lib/ranking/rankingEngine.test.ts`.
- Modify: `lib/assessments/mutations.ts` — delete `buildPositionMap`, import the engine in `bulkSaveMarks`/`upsertMarksCSV`.
- Modify: `lib/core/report-cards.ts` — replace the inline sort (`generateReportCards`) with an engine call.
- Modify: `lib/core/assessments.ts` — replace `updateClassPositions`'s inline sort with an engine call.
- Modify: `lib/assessments/cohortQueries.ts` — replace ad-hoc `CombinedRankRow` construction with `combineStreamRankings`.

**Database impact:** Additive only, and only if needed for a transition window: `learner_marks` gains `position_rank int` (new, tie-aware) written by the engine, while the existing `position` column is left populated as-is for one release to avoid breaking any current reader before it's confirmed safe to drop — no `DROP`/`ALTER ... DROP COLUMN` in this stage, per Rule 3/Rule 7 sequencing (Add → Backfill → Verify → Migrate → Observe → Delete; this stage is only the "Add" half for the ranking output field itself, the "Delete" of the old field is explicitly a later, separate cleanup).

**API impact:** None externally — response shapes for report cards/analytics endpoints are unchanged; only the computed `position` values for previously-tied scores change (they become correct, i.e. shared, instead of arbitrarily sequential). This is a visible behavior change for any class that currently has tied scores, not just an internal refactor — flagged so it isn't mistaken for purely invisible cleanup.

**Risk analysis:** Low-medium. The engine change is pure-function and unit-testable in isolation. The one real risk is on already-*published* report cards: this stage does not retroactively recompute historical published `school_report_cards` rows (recomputing a document a parent has already seen is a separate product decision, out of scope here) — only newly generated report cards use the corrected engine.

**Security impact:** None — this stage is a pure computation/correctness fix, no authorization surface changes.

**Migration strategy:** Ship the engine and switch all four call sites in one PR (per Rule 2 — delete duplication, don't leave adapters) rather than a phased per-call-site rollout, since all four call sites are independent, low-risk, and unit-testable together.

**Rollback strategy:** Revert the commit. No schema was dropped, so reverting is a pure code rollback with no data implication.

**Test strategy** (Rule/objective explicitly calls for "comprehensive tests" here):
- Empty input, single entry, all-tied, partial-tied (`[90,85,85,70] → [1,2,2,4]`), cross-stream combination with differing stream sizes.
- Snapshot/regression test comparing the engine's output against the old inline sorts' output on the *untied* subset of a fixture dataset — proves the fix changes only tie behavior, not any already-correct ranking.
- Integration test: generate a report card for a class with a real tie, confirm the published output shows shared positions.

**Exit criteria:**
- [ ] All three duplicate ranking implementations deleted (not left as unused dead code — actually removed, per Rule 2).
- [ ] All four consumers (`mutations.ts`, `report-cards.ts`, `assessments.ts`, `cohortQueries.ts`) call the one engine.
- [ ] Full test suite above passing.
- [ ] User confirms Stage 3 may begin.
- [ ] Canonical Domain Registry's Ranking entry updated to `CANONICAL`; Deprecation Registry entry #4 updated to `REMOVED` with commit reference.

**Success metrics:** 4/4 duplicate ranking implementations deleted (0 remaining, verified by repo-wide reference search, not assumption); 100% of tied-score fixture cases produce shared positions; 0 change in output for untied fixture cases (regression-proven, not merely asserted).

---

## Stage 3 — Additive Schema Only

**Goal:** Add the columns needed to make School ownership and created_by/updated_by attribution expressible, without removing or renaming anything yet, per Rule 3/Rule 7.

**Architecture reasoning:** This is the "Add" step of the Seventh Law's Audit → Understand → Add → Backfill → Verify → Observe → Remove sequence — Stage 0 was Audit/Understand, this stage is Add + the start of Backfill, nothing is Verified/Observed/Removed yet. It also operationalizes the Second Law (Ownership vs. Attribution are different columns, never conflated) at the schema level for the first time in this codebase.

**Files affected:** One new migration (drafted below, not yet written to `supabase/migrations/`); `lib/database.types.ts` regenerated after via `mcp__supabase__generate_typescript_types` once applied.

**Database impact:**
```sql
alter table teachers
  add column if not exists school_id uuid references schools(id);
create index if not exists idx_teachers_school_id on teachers(school_id);

alter table teacher_classes
  add column if not exists school_id uuid references schools(id);
create index if not exists idx_teacher_classes_school_id on teacher_classes(school_id);

alter table class_assessments
  add column if not exists school_id uuid references schools(id),
  add column if not exists academic_year_id uuid references academic_years(id),
  add column if not exists term_id uuid, -- confirm exact type against school_report_cards.term_id / term_subject_summaries.term_id before applying
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id);
create index if not exists idx_class_assessments_school_id on class_assessments(school_id);
create index if not exists idx_class_assessments_academic_year_id on class_assessments(academic_year_id);

alter table learner_marks
  add column if not exists position_rank int;  -- if not already added in Stage 2's transition
```
Backfill of `teachers.school_id`/`teacher_classes.school_id` runs only against the "unambiguous" subset sized by Stage 0's audit, using the exact threshold Stage 0's numbers justify (e.g. teachers with exactly one active `school_users` row) — the precise backfill predicate is written after Stage 0's real numbers are in hand, not guessed here.

**API impact:** None yet. Columns exist but no route reads or writes them until Stage 4.

**Risk analysis:** Low for the `ADD COLUMN ... NULL` statements themselves (non-locking on modern Postgres, no default backfill required). The real risk is entirely in the backfill `UPDATE`, which is why it's scoped to only the unambiguous subset Stage 0 identified, leaving ambiguous rows `null` rather than guessed.

**Security impact:** None directly — these columns aren't read by any authorization check yet (that begins in Stage 4). Indirectly this stage is a prerequisite for Stage 4's `created_by`-based attribution model to exist at all.

**Migration strategy:** Single additive migration, idempotent (`IF NOT EXISTS` throughout so re-running is a no-op), applied first to a Supabase branch and verified against Stage 0's expected counts before applying to production.

**Rollback strategy:** `ALTER TABLE ... DROP COLUMN IF EXISTS` for each added column — safe at any point since Stage 4 hasn't yet made anything depend on these columns being populated.

**Test strategy:** Migration idempotency test (apply twice, confirm no-op second time). Backfill correctness check: newly-populated `school_id` count must match Stage 0's "unambiguous" count exactly, not approximately.

**Exit criteria:**
- [ ] Migration applied to a branch, verified against Stage 0 numbers, then applied to production.
- [ ] `lib/database.types.ts` regenerated and committed.
- [ ] Zero existing reads/writes broken (nothing yet depends on the new columns).
- [ ] User confirms Stage 4 may begin.

**Success metrics:** 100% of new columns idempotent on re-run; backfilled `school_id` count matches Stage 0's unambiguous count exactly (0 mismatches); 0 rows guessed into an ambiguous `school_id`.

---

## Stage 4 — Consolidate Assessment Creation, School-Owned

**Goal:** One `createAssessment` implementation. Teachers become actors (`created_by`/`updated_by`) rather than owners. All writes become school-owned via the columns Stage 3 added.

**Architecture reasoning:** This is the stage where the First, Second, and Third Laws become simultaneously true for the Assessment domain: one canonical service (First Law), `created_by` as attribution distinct from `school_id` as ownership (Second Law), every new assessment provably belonging to a School (Third Law). The Canonical Domain Registry's Assessment entry moves from `TARGET (Phase A)` to `CANONICAL` at the close of this stage; Deprecation Registry entry #1 moves to `REMOVED`.

**Files affected:**
- `lib/core/assessments.ts::createAssessment` — designated canonical (per Rule 2's "which implementation becomes canonical," chosen because it already targets the shared `class_assessments`/`learner_marks` tables under Core's role model). Extended to accept and require `created_by`, and to populate `school_id`/`academic_year_id`/`term_id` from the caller's resolved school context rather than leaving them null.
- `lib/assessments/mutations.ts::createAssessment` — **deleted**, not wrapped (per "delete duplication, not add adapters"). All internal callers repointed.
- `app/api/teacher/assessments/**` (all routes currently calling the legacy function, ~12 routes per the audit) — repointed to the canonical function; `created_by` populated from `auth.getUser().id`, never trusted from the request body.
- `lib/assessments/evidence.ts`, `lib/assessments/reportCardEvidence.ts` — updated only where they currently read `teacher_id` for attribution that should now read `created_by`; explicitly **not** touched for anything beyond that attribution-field swap, since these files' actual job (writing to the Evidence Domain) is out of Phase A's scope per the Learning Evidence separation guardrail above.

**Database impact:** None beyond what Stage 3 already added — this stage is the "Migrate" step in the Add → Backfill → Verify → Migrate → Observe → Delete sequence, using columns already present and backfilled.

**API impact:** No response shape changes for any of the ~12 repointed routes (objective: preserve existing functionality). Internally, every create/update call now carries `created_by`/`updated_by` and a resolved `school_id`.

**Risk analysis:** The main risk is an incompletely-migrated caller left pointing at the old function — mitigated by deleting the old function outright once migration is believed complete, so any missed caller is a compile error, not a silent divergence (this is explicitly the failure mode Rule 2 wants: loud, not silent).

**Security impact:** Positive — `created_by` is now always sourced from `auth.getUser()`, never trusted from the request body, closing off any theoretical spoofing vector in the old dual-path system where two functions might have handled attribution inconsistently. No new attack surface introduced.

**Migration strategy:** Migrate all ~12 routes in one coordinated change, not a phased partial rollout — partial rollout would recreate exactly the two-parallel-paths problem this stage exists to eliminate.

**Rollback strategy:** Keep the legacy function in the codebase, unreferenced-but-not-yet-deleted, for one observation window after the route migration ships — so rollback is "revert the route changes" (fast, safe) rather than "resurrect deleted code" (slow, error-prone). Delete the legacy function only after that observation window, as its own small follow-up commit.

**Test strategy:** Existing test suites for the 12 routes (if present) must pass unchanged (response-shape preservation). New test per route confirming `created_by` is populated from `auth.getUser()` and that a request with a spoofed `created_by`/`teacherId` in the body is ignored in favor of the authenticated user, per the existing `CLAUDE.md` rule that request-body user IDs are never trusted.

**Exit criteria:**
- [ ] `lib/assessments/mutations.ts::createAssessment` has zero remaining callers, confirmed by a full-repo reference search, not assumption.
- [ ] All ~12 routes verified functioning against real data (via `verify` skill) with `created_by`/`school_id` correctly populated.
- [ ] Legacy function deleted after the observation window.
- [ ] User confirms Stage 5 may begin.
- [ ] Canonical Domain Registry's Assessment entry updated to `CANONICAL`; Deprecation Registry entry #1 updated to `REMOVED` with commit reference.

**Success metrics:** 1 `createAssessment` implementation remains (down from 2); 12/12 routes migrated with 0 response-shape changes; 100% of new/updated assessment rows carry a non-null `created_by` and `school_id`.

---

## Stage 5 — Class Domain Consolidation (Dry-Run First, Deferred)

**Goal:** One `classes` system, one `class_students` model. Merge `teacher_classes` into `classes`/`streams`; merge the legacy-FK-space `class_students` rows into Core's `class_students`; then, only after a proven-safe dry run, drop `teacher_classes` and the legacy `class_students` FK space.

**Architecture reasoning:** This is the highest-stakes application of the Seventh Law in all of Phase A — the only stage where "Remove" actually happens, and only after every prior step (Audit → Understand → Add → Backfill → Verify → Observe) has been satisfied by the dry run. It's sequenced last deliberately: Stages 1-4 reduce the number of call sites and ambiguities Stage 5 has to account for, so the highest-risk work happens with the smallest possible surface area remaining.

**Files affected:** Not fully enumerated here by design — per Rule 5, this stage does not get a committed migration or a finished file list until its own dry run (against a `mcp__supabase__create_branch` branch) confirms the mapping is safe on real data. What's already known: `app/api/teacher/classes/route.ts`'s inline creation logic moves into a new `lib/core/classes.ts` teacher-facing wrapper that ultimately targets `classes`/`streams`; every other reader of `teacher_classes`/legacy `class_students` needs a dedicated grep pass at dry-run time, since Stages 1-4 may shift some of those call sites first.

**Database impact:** The only stage in Phase A that is genuinely destructive (`DROP TABLE`/`DROP COLUMN` on live tables with real pilot data). Explicitly not drafted as executable SQL in this document, per Rule 5 — no DROP is written until proven safe with real production data via the dry run.

**API impact:** Potentially significant — any route reading `teacher_classes` directly needs repointing; full impact assessed at dry-run time, not assumed now.

**Risk analysis:** Critical. This is the one stage where a wrong mapping loses data. Explicitly deferred and gated on its own separate approval, not bundled into the same release as Stages 1-4.

**Security impact:** Neutral-to-positive once complete — collapses two class-management surfaces (one entirely unauthenticated at the school-tenant level, since `teacher_classes` has no `school_id`) into the one that already has proper role-gated tenant isolation. No new exposure introduced by the migration itself if the dry run is clean.

**Migration strategy:** Dry run on a Supabase branch first (`mcp__supabase__create_branch`), full data-integrity verification of the mapping, only then a production migration proposal — written as its own follow-up plan once the dry run's findings are in hand.

**Rollback strategy:** Written as part of the dry-run process itself (e.g. restoring from the pre-migration branch snapshot) — not specified further here since the stage is deferred.

**Test strategy:** Full data-integrity test suite comparing pre- and post-migration row counts/content for every migrated class and roster, run against the dry-run branch before any production execution is considered.

**Exit criteria:**
- [ ] Dry run completed on a branch with real production data copy.
- [ ] Zero data-loss/mismatch findings from the dry run, or all findings explicitly resolved.
- [ ] Full file/caller list enumerated and migrated.
- [ ] `teacher_classes` and the legacy `class_students` FK space dropped only after the above, with explicit user approval for the production execution specifically (separate from approval of this stage's plan).
- [ ] Canonical Domain Registry's Class/Class Roster entries updated to `CANONICAL`; Deprecation Registry entries #2 and #3 updated to `REMOVED` with commit reference.

**Success metrics:** 0 data-loss/mismatch findings in the dry run before production execution is even proposed; 1 class-management system remains (down from 2); 100% of pre-migration classes/rosters accounted for post-migration (row-count and content parity, not approximate).

---

## Phase A Completion — Not Yet Reached

Per the user's stated success criteria, Phase A is complete only when all of: one Class Domain, one Assessment Domain, one Ranking Engine, one Report Pipeline, one School Ownership model, teachers acting through permissions, official records belonging to Schools, Learning Intelligence remaining independent, no duplicate business logic, the Canonical Domain Registry complete, the Deprecation Registry complete, documentation synchronized, security gaps closed, and every decision traceable — are independently verified against the live codebase, not asserted from this plan.

**Two items this plan does not resolve, carried forward explicitly rather than silently dropped from scope** (both recorded in the [Deprecation Registry](deprecation-registry.md)):
1. Entry #5 — the duplicated inline `toCbcLevel` closures — has no assigned Phase A stage (0-5). It should either be folded into Stage 4 (natural fit, since it touches `lib/core/assessments.ts`, already in scope there) or given its own micro-stage; needs a decision before "no duplicate business logic remains" can be claimed.
2. Entry #6 — the legacy AI auto-report pipeline vs. Core's `school_report_cards` — is explicitly out of Stages 0-5, since resolving it safely requires first deciding the legacy `assessments` table's relationship to School ownership, and risks the Fourth Law's Official-Records/Learning-Intelligence separation if rushed. This needs its own scoping pass before Phase A's "one Report Pipeline" criterion is honestly complete — most likely a "Phase A.5" or the first item of Phase B, not squeezed into the current five stages.

Both the [Canonical Domain Registry](canonical-domain-registry.md) and [Deprecation Registry](deprecation-registry.md) are now live documents, updated at the close of every stage per the Quality Gates — each stage's exit criteria above includes the specific registry updates expected.

**Next step:** awaiting approval to begin Stage 0.
