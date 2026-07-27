# Blueprint Action Plan — Phase 1: Canonical Data Model and Domain Lifecycle

**Date:** 2026-07-25
**Depends on:** `docs/architecture/blueprint-living-action-plan-audit.md` (the audit), `docs/architecture/adr-0030-blueprint-context-selection.md` (the context rule), Phase 0's corrected `lib/core/permissions.ts`.
**Scope:** Create the canonical Blueprint-owned action-plan data model and domain lifecycle. No delivery fan-out (no assignments, no Compass sessions), no evidence writes, no broad UI.

---

## 1. Focused design verification (performed before writing the migration)

| Convention | Finding | Source |
|---|---|---|
| UUID generation | `gen_random_uuid()` on every PK, every table | `blueprint_snapshots`, `teacher_reflections` migrations |
| Learner identity for a Blueprint-owned table | Core `learners.id`, never legacy `students.id` — both `blueprint_snapshots` and `teacher_reflections` (the two most recent Blueprint-adjacent tables) key this way | Sprint 12K, Sprint 12O |
| School ownership | `school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE` on every Blueprint-owned table | same |
| `created_by`/actor references | `uuid REFERENCES school_users(id) ON DELETE SET NULL` — never `auth.users` directly, never CASCADE (a row must outlive the actor's own membership) | `blueprint_snapshots.created_by`, `teacher_reflections.teacher_id` |
| Timestamps | `created_at`/`updated_at timestamptz NOT NULL DEFAULT now()`, `updated_at` maintained by a trigger, not application code | `teacher_reflections` |
| JSONB usage | Reserved for genuinely polymorphic or multi-record-referencing values only (`blueprint_snapshots.blueprint_payload`, `.provenance`; `learner_projections.value`, `.supporting_evidence_ids`) — never a catch-all for structured content that could be normalized | all evidence/projection/snapshot tables |
| Immutable snapshot/history enforcement | DB triggers, not application discipline alone — `blueprint_snapshots` unconditional (`BEFORE UPDATE/DELETE ... RAISE EXCEPTION`), `teacher_reflections` conditional (immutable only once `status = 'published'`) | both migrations |
| RLS helper functions | `auth_owns_student`, `auth_is_teacher_of_student`, `auth_is_direct_teacher_of_student`, `auth_is_parent_of_student` — all `SECURITY DEFINER`, all keyed on **legacy** `students.id` | `20260525_rls_policies.sql`, `20260720130000_sprint1_evidence_rls_bypass_fix.sql` |
| Audit/event tables | `lib/events` is a cross-cutting integration-event pipeline (platform-wide); domain-internal audit trails (e.g. `intervention_log`) are kept inline in their own table, not routed through it | `intervention_log`, project history |
| Soft delete vs. explicit lifecycle status | This codebase uses explicit status columns with CHECK constraints (`teacher_reflections.status`, `intervention_log`'s effectively-terminal fields), never a `deleted_at` soft-delete column, for domain lifecycle state | all reviewed tables |

### The one real conflict found, and how it was resolved

The strongest, most correct existing RLS pattern in this codebase (`learner_evidence`'s policy, using `auth_is_teacher_of_student`/`auth_is_direct_teacher_of_student`) is keyed on **legacy** `students.id`. But per the identity convention above, `blueprint_action_items` must be Core-native (`learners.id`), matching `blueprint_snapshots`/`teacher_reflections`. Not every Core learner has a legacy bridge yet (`lib/core/identity.ts`'s own documented gap: "a legitimate, common state — a newly-enrolled learner with no assessment history — never an error"). Reusing the legacy-keyed RLS functions directly would deny real teachers of not-yet-bridged learners.

`blueprint_snapshots` and `teacher_reflections` had already hit this identical conflict and resolved it the same way: coarse school-level RLS (any active `school_users` member of the school may read) with the fine-grained "does this teacher actually teach this learner" rule enforced at the **application** layer (Phase 0's corrected `canViewLearner`/`canManageLearnerRecordCore`). This migration follows that precedent, with one deliberate strengthening: the read policy excludes `parent` (see §5) — neither prior table needed that, but this one can carry `teacher_notes`.

This is not a case that required stopping the phase — it is the same conflict already solved once, solved the same way again.

### A second, unplanned finding: `school_users`' own RLS policy was self-referentially recursive

Real-session RLS tests (§7, tests #18/#18b) surfaced `42P17 infinite recursion detected in policy for relation "school_users"` on a **plain** `SELECT` against `school_users` by any authenticated user — reproduced with an isolated script containing zero application code. Root cause: `school_users_own_school`'s own policy queried `school_users` from directly inside `school_users`' own `USING` clause, without the `SECURITY DEFINER` bypass this codebase already uses everywhere else for exactly this shape of problem. This was pre-existing (not introduced by this phase) and had gone unnoticed because almost every read of `school_users` goes through the service-role client (`resolveMembership`/`getSchoolUser`), never a real RLS-enforced session — until this phase's tests were the first to exercise that path for real.

Fixed in `supabase/migrations/20260725130000_fix_school_users_rls_recursion.sql`: a new `auth_is_school_admin_of(school_id)` `SECURITY DEFINER` function, and `school_users_own_school` rewritten to call it instead of a raw self-referencing subquery — the same established pattern (`auth_owns_student`, `auth_is_teacher_of_student`, etc.), applied to the one place it was missing. This transitively fixes every other table whose policy joins into `school_users` from a real session (`academic_years`, `terms`, `streams`, `grade_subjects`, `blueprint_snapshots`, `teacher_reflections`, and the two new tables below) — none of those policies needed to change.

**Follow-up (2026-07-26):** a dedicated regression audit of this fix — `docs/architecture/school-users-rls-regression-audit.md` (Phase 1.5) — found and fixed a second, independent, pre-existing defect in the same policy (a privilege-escalation gap letting any authenticated user self-insert an admin row for any school), and identified a related, broader systemic pattern across 11 other tables that remains open. Read that document for the full findings before starting Phase 2.

---

## 2. Canonical schema

Two tables, both Blueprint-owned exclusively (`lib/repositories/blueprintActionItem.repository.ts`, `blueprintActionItemHistory.repository.ts`, written only from `lib/learnerBlueprint/actionPlan/lifecycle.ts`):

### `blueprint_action_items`

The live, current-state record. Normalized content fields (title, rationale, intendedOutcome, learnerAction, teacherAction, parentSupport, schoolSupport, successIndicator, targetCapability, reviewDate, teacherNotes) — no single unvalidated JSON blob. One JSONB field, `evidence_basis`, justified because it mirrors `Projection<T>`'s own polymorphic shape and references a variable number of evidence ids. Full column list and every constraint's rationale are documented inline in `supabase/migrations/20260725120000_blueprint_action_items.sql`.

Key design decisions:
- **`context`** (`current_term`/`intervention`/`extension`/`end_of_term`/`holiday`) has no `DEFAULT` — ADR-0030: always explicitly supplied, never inferred.
- **`status`** CHECK permits `published`/`completed`/`reviewed` (reserved for later phases) but no Phase 1 code path can ever set them — see §3.
- **`visibility`** (`teacher_only`/`learner_visible`/`parent_visible`/`shared`) governs `lib/learnerBlueprint/actionPlan/projections.ts`'s stakeholder views — see §4.
- **`teacher_notes`** is unconditionally private — never returned by any stakeholder projection regardless of `visibility`.
- **`blueprint_snapshot_id`** and `academic_year_id`/`term_id` are nullable, populated where available, never load-bearing for any Phase 1 logic.
- A DB trigger blocks any `UPDATE`/`DELETE` once `status IN ('approved', 'rejected')` — a final decision is immutable; `deferred` is deliberately excluded (revisitable).

### `blueprint_action_item_history`

Unconditionally immutable (mirrors `blueprint_snapshots`), one row per lifecycle transition (`proposed`/`edited`/`approved`/`rejected`/`deferred`), storing a full snapshot of the row after the event (not a diff) plus `previous_status`, `resulting_status`, `actor_id`, `reason`, `created_at`. This is the audit trail required by "the system must preserve the original proposal, every edit, the decision, actor, timestamp, previous and resulting state."

---

## 3. Lifecycle and allowed transitions

Implemented in `lib/learnerBlueprint/actionPlan/lifecycle.ts`. Phase 1 covers exactly: `propose → edit → approve/reject/defer`.

```
                 ┌────────┐
   propose  ───► │proposed│
                 └───┬────┘
                     │ edit
                     ▼
                 ┌────────┐
                 │ edited │◄──┐
                 └───┬────┘   │ edit
                     │        │
        ┌────────────┼────────┘
        │            │
   approve/reject   defer
        │            │
        ▼            ▼
  ┌──────────┐   ┌──────────┐  edit/approve/reject/defer again
  │ approved │   │ rejected │  ┌──────────┐◄─────────────────────┐
  │(final,   │   │ (final,  │  │ deferred │                      │
  │immutable)│   │immutable)│  └────┬─────┘                      │
  └──────────┘   └──────────┘       └────────────────────────────┘
```

- Every proposal — teacher-authored or system-generated — starts as `proposed`, unconditionally. Phase 1 never auto-approves anything.
- `edit` is only valid from `proposed`/`edited`.
- `approve`/`reject`/`defer` are valid from `proposed`/`edited`/`deferred` — a deferred item is revisitable, not a dead end.
- `approved`/`rejected` are terminal — enforced by both the DB trigger and the service layer's own pre-check (the latter exists to surface a clean error instead of the raw DB exception).
- `published`/`completed`/`reviewed` are reserved in the CHECK constraint (so the column never needs a future migration to widen) but **no function in `lifecycle.ts` can produce them** — there is no code path that sets `status` to any of the three.

---

## 4. RLS behavior

| Actor | Read (`blueprint_action_items`/`_history`) | Write |
|---|---|---|
| School admin/headteacher/deputy | RLS: any active `school_users` membership with an admin-tier or `teacher` role at the matching `school_id` | Via `canManageLearnerRecordCore` in the service layer (admin-tier always qualifies) |
| Teacher who teaches this specific learner | Same coarse RLS grant, further restricted at the service layer to only the learners they actually manage (`canManageLearnerRecordCore` — Phase 0's `class_students`/legacy `teacher_id` rule) | Same |
| Teacher who does **not** teach this learner | Coarse RLS still grants raw SELECT (same precedent as `blueprint_snapshots`/`teacher_reflections` — outer tenant boundary, not per-row) | Denied — `ResourceOwnershipError` from every `lifecycle.ts` function |
| Parent | **Denied at RLS** — the read policy's role list excludes `parent` entirely (a deliberate strengthening beyond `blueprint_snapshots`'/`teacher_reflections`' precedent, justified by `teacher_notes`) | Denied (no write policy for `authenticated` at all) |
| Learner (self) | Denied — `canManageLearnerRecordCore` is staff-only, no self-exception | Denied |
| Cross-school (any role) | Denied — RLS `school_id` match fails; service layer also fails via `canManageLearnerRecordCore` | Denied |
| Service role | Full access — the only writer, used exclusively inside `lib/repositories/blueprintActionItem*.repository.ts` | — |

No `INSERT`/`UPDATE`/`DELETE` policy exists for the `authenticated` role on either table — every write goes through the service-role client, called only from `lifecycle.ts`, which is what actually enforces "is this specific teacher allowed to act on this specific learner." This makes "learners/parents cannot write" true at the strongest layer, independent of any future application-layer bug.

Verified with real signed-in sessions (not mocked): a parent-role session issuing a raw `SELECT` against `blueprint_action_items` returns zero rows with no error; an unrelated teacher at a different school gets the same.

---

## 5. Stakeholder visibility model

Implemented as pure, testable projection functions (`lib/learnerBlueprint/actionPlan/projections.ts`), not per-field DB flags:

- **`toTeacherView`** — the full row, unrestricted (teachers authored/reviewed it).
- **`toParentView`** — returns `null` unless `status === 'approved'` AND `visibility ∈ {parent_visible, shared}`. When non-null, the returned object structurally has no `teacherNotes`/`evidenceBasis` field at all — not filtered at runtime, absent from the type.
- **`toLearnerView`** — same gate, `visibility ∈ {learner_visible, shared}`.

`teacher_notes` cannot leak through either stakeholder view under any circumstance — a future edit to `toParentView`/`toLearnerView` would have to explicitly add a new field to leak it; there is no "accidentally forgot to filter" failure mode.

---

## 6. `composeRecommendedNextSteps` resolution

Per the phase's mandatory requirement, `lib/learnerBlueprint/composeRecommendedNextSteps.ts` no longer runs the legacy `composeParentActions()` selector unconditionally — **Preferred approach implemented**:

1. First checks `listApprovedBlueprintActionsForStakeholder(coreLearnerId, schoolId, 'parent')` — approved, parent-visible/shared canonical items.
2. If any exist, returns **only** those (projected via `toParentView`, mapped to a new `ParentActionType: 'canonical_action_item'`) — the legacy selector is not called at all for that request.
3. If none exist, falls back to the original `composeParentActions()` — unchanged legacy behavior, explicitly marked in code as the compatibility path.

The two paths never run together for the same learner at the same time — proven by test (`composeRecommendedNextSteps.cutover.test.ts`, 4 scenarios: zero canonical items, a draft canonical item, an approved-but-`teacher_only` item, and an approved-`parent_visible` item — only the last one triggers the cutover).

---

## 7. Files changed

**New:**
- `supabase/migrations/20260725120000_blueprint_action_items.sql`
- `supabase/migrations/20260725130000_fix_school_users_rls_recursion.sql`
- `lib/repositories/blueprintActionItem.repository.ts`
- `lib/repositories/blueprintActionItemHistory.repository.ts`
- `lib/learnerBlueprint/actionPlan/{types,validation,lifecycle,projections,candidateGeneration,index}.ts`
- `lib/learnerBlueprint/actionPlan/{projections,lifecycle.integration}.test.ts`
- `lib/learnerBlueprint/composeRecommendedNextSteps.cutover.test.ts`
- `docs/architecture/blueprint-action-plan-phase1.md` (this document)

**Modified:**
- `lib/core/permissions.ts` — added `canManageLearnerRecord`/`canManageLearnerRecordCore`, factored `isCurrentTeacherOfStudent` out of `canViewLearner` for reuse (no behavior change to `canViewLearner` itself).
- `lib/repositories/index.ts` — registered the two new repositories.
- `lib/learnerBlueprint/composeRecommendedNextSteps.ts` — the cutover (§6).
- `lib/parentExperience/actions.ts` — added `'canonical_action_item'` to `ParentActionType` (type only; `composeParentActions()`'s own logic is untouched).

---

## 8. Deferred work (explicitly out of scope for Phase 1)

- **Delivery fan-out** — converting an approved action item into a real assignment or Compass session (§7 Phase 2 of the audit). `evidenceBasis`/linkage columns for this are deliberately not added yet.
- **Holiday Planner generalization / Remedial Planner approval alignment** (§7 Phase 3).
- **Stakeholder UI and PDF** (§7 Phase 4) — `toParentView`/`toLearnerView` exist and are tested, but no route renders them yet.
- **Cross-feature dedup** (§7 Phase 5) — nothing today prevents a Remedial-Planner-derived and a Blueprint-action-plan-derived recommendation from targeting the same gap independently.
- **`school_users` RLS fix's blast radius** — confirmed to transitively fix every other table joining into `school_users` from a real session, but a full regression pass across all of them (beyond the ones this phase's own tests touch) was not performed; worth a dedicated follow-up given its severity.
