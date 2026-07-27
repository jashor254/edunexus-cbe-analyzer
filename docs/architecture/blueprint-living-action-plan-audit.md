# Blueprint → Living Action-Plan Audit

**Date:** 2026-07-25
**Scope:** Whether the Learner Blueprint can grow into a living, school-owned, teacher-approved action-plan system (in-term actions, intervention plans, extension plans, end-of-term holiday plans) without creating a parallel recommendation/intervention engine, bypassing the canonical Evidence/Projection domain, or introducing a second source of truth for "what should this learner do next."

**Method:** Read-only investigation across four parallel passes (Blueprint + Evidence/Projection; recommendation/intervention surfaces; Compass + assignments; calendar/security/unstructured input). No code was changed to produce this document, with one exception noted in §7 (none were actually required — flagged as N/A).

---

## 1. Executive verdict

**SAFE WITH REQUIRED CORRECTIONS.**

The foundation this feature would sit on is genuinely sound: one canonical Evidence writer (`lib/intelligence/evidenceLifecycle.ts`), one canonical Projection reader (`lib/projection/recompute.ts`'s `recomputeLearnerProjection()`), an ESLint-enforced read-path guardrail with zero live violations, a working immutable snapshot/versioning system (`blueprint_snapshots`), and a real precedent for a "generate → teacher-approves → publish → notify" lifecycle (Holiday Planner). This is not a codebase where "add an action-plan layer" requires inventing infrastructure from nothing.

It is not yet safe to start building, for three concrete, fixable reasons:

1. **The exact capability being proposed already partially exists inside Blueprint** — `composeRecommendedNextSteps.ts` (Sprint 12S, "Parent Action Centre") is a stateless, read-only "next steps" selector. Building a new stateful, approved action-plan engine alongside it without an explicit decision to retire/absorb it creates precisely the "three sources of truth" the product intent prohibits.
2. **The teacher-access gate that any new approval UI will sit on has a known, self-documented inconsistency** — the app-level check (`canViewLearner` in `lib/core/permissions.ts`) does not implement the `class_students`-based teacher rule that the DB-level RLS policy already implements correctly. This should be fixed before, not after, a new teacher-approval surface is built on top of it.
3. **There is no single existing table that can safely own a multi-context, multi-item, delivery-mode-aware action plan** without either overloading a narrowly-scoped table beyond its design intent, or leaving persistence ownerless. See §5 for the reasoning — a new, narrowly-scoped table is justified, not a default.

None of these require an architecture redesign. They are the smallest-safe-phase's prerequisites (see §7).

---

## 2. Current domain map

| Concern | Canonical owner | File |
|---|---|---|
| Evidence writes | `persistEvidenceBatch`, `confirmReview`, `rejectReview`, `retractEvidence`, `eraseEvidence` | `lib/intelligence/evidenceLifecycle.ts` |
| Evidence reads (bulk, learner-scoped) | `recomputeLearnerProjection()` only — ESLint-enforced, zero violations found | `lib/projection/recompute.ts` |
| Learner chronological history | `getLearnerTimeline()` — explicitly "no other function should reimplement this merge" | `lib/learnerRecord/timeline.ts` |
| Recommendation (cross-domain arbitration) | **Frozen, no live owner** — `computeNextBestActions()` was EILS's job; nothing replaced its cross-system dedup role | `_frozen/eils/nextAction.ts` (dead) |
| Intervention (single type, auto-triggered) | `intervention_log` table, closed via teacher check-in | `lib/remedial/interventionEvidence.ts`, `app/api/teacher/intervention-checkin/route.ts` |
| Class-level remedial plan | Remedial Planner — no approval gate | `lib/remedial/planner.ts` |
| Per-student holiday plan | Holiday Planner — **has** a draft→publish approval gate | `lib/holiday/planner.ts`, `lib/holiday/return.ts` |
| Assignment/quiz creation | ~~One inline route handler~~ — extracted Phase 2A into `lib/assignments/create.ts` (`createAssignment`), now Blueprint-deliverable with provenance (Phase 2B) | `lib/assignments/create.ts`, `lib/learnerBlueprint/actionPlan/delivery/assignment.ts` |
| Compass journey (session) | `getOrCreateSession()` — internal only, no public "request a journey" entry point | `lib/compass/session.ts` |
| Compass external read boundary | `getLearningCompassSummary()` — read-only, RAS §10.7/§10.8 enforced | `lib/compass/summary.ts` |
| Blueprint composition | `composeBlueprint()`, 18 parallel composers | `lib/learnerBlueprint/composeBlueprint.ts` |
| Blueprint publication/versioning | `blueprint_snapshots` (immutable, DB-trigger-enforced), triggered only by report-card publish / end-of-term / graduation | `lib/learnerBlueprint/snapshot.ts` |
| Blueprint's existing "next steps" | `composeRecommendedNextSteps.ts` — pure selector over sibling sections, **no persistence, no approval, no lifecycle** | `lib/learnerBlueprint/composeRecommendedNextSteps.ts`, `lib/parentExperience/actions.ts` |
| Stakeholder visibility (app-level) | `canViewLearner` / `requireLearnerAccess` | `lib/core/permissions.ts` |
| Stakeholder visibility (DB-level) | RLS policies on `learner_evidence`, `learners`, `schools` | `supabase/migrations/20260525_rls_policies.sql`, `20260720130000_sprint1_evidence_rls_bypass_fix.sql` |

---

## 3. Overlap and duplication findings

### Holiday Planner — **reuse as the template**
- **Does:** generates a per-student/per-class holiday plan from Projection + a shared classifier, holds it as a draft, requires explicit teacher publish (or a 3-day auto-publish cron fallback) before it reaches the parent-facing Blueprint.
- **Reads:** `recomputeLearnerProjection()`, `buildCareerIntelligence`, `buildAdaptiveTask()` (`lib/adaptiveLearning/recommend.ts` — the same classifier Remedial Planner uses).
- **Writes:** `upsertHolidayPlan` (draft), `publishHolidayPlan`/`publishClassHolidayPlans` (publish), evidence via `lib/holiday/return.ts` → `persistEvidenceBatch`.
- **Canonical:** Yes.
- **Verdict:** This is the one existing feature with the exact generate → draft → teacher-approve → publish → notify shape the product intent describes. Its lifecycle pattern (not its table) should be generalized, and its event-trigger distinction (`trigger: 'teacher' | 'auto'`) is worth copying directly.

### Remedial Planner — **adapt, bring to the same standard as Holiday Planner**
- **Does:** generates a class-level, 4-group differentiated remediation plan.
- **Reads:** `recomputeLearnerProjection()`, `classifyGroup()` (the same canonical classifier Holiday Planner uses — confirmed **not** a duplicate classification engine, a real precedent the team already enforced once, in Sprint 6A, per its own module header).
- **Writes:** `repos.learnerIntelligence.upsertRemedialPlan` — immediately, on generation.
- **Canonical:** Yes, for class-level remediation.
- **Verdict:** No approval gate exists (unlike Holiday Planner). It is currently teacher-generated/teacher-facing only, so the missing gate is lower-stakes today — but if any new action-plan surface exposes Remedial Planner output downstream (to parents, or into the new engine), it must be brought up to Holiday Planner's draft/publish standard first, not left as a second, weaker-governed precedent.

### `intervention_log` — **reuse the "did it work" loop, do not overload it into a general action-plan store**
- **Does:** the platform's only real per-intervention lifecycle table (`intervened_at` → `checkin_due_at` → `checkin_completed_at`), but scoped to exactly one intervention type (`prerequisite_warmup`), auto-triggered by a severity threshold, never teacher-initiated.
- **Writes:** evidence via `recordInterventionCheckinEvidence()` → `persistEvidenceBatch` — the outcome is capped at CBC level 3, never a raw score (a conservative pattern worth copying).
- **Canonical:** Yes, for its narrow scope.
- **Verdict:** Reuse its check-in/outcome pattern for "did an approved action work," but do not repurpose the table itself as the general action-item store — it has no `context` concept, no priority, no delivery-mode fields, and is architecturally tied to one auto-trigger source.

### Next Action Engine — **leave untouched, different concern**
- **Does:** orders an individual teacher's own dashboard tasks (attendance gaps, pending marks, teaching prep) — explicitly documented as "deterministic workflow composition, not intelligence... never performs an action, publishes anything, or sends any communication itself."
- **Verdict:** Not prior art for a learner-facing action plan. Flagged only so its name isn't mistaken for the feature being built.

### Monday Panel — **reuse as a read/trigger surface, not a plan store**
- **Does:** a cached (24h), read-side aggregation of five intelligence layers, migrated off frozen EILS's `teacherIntelligence.ts` ("same output, new home" per its own header).
- **Verdict:** A legitimate place to surface "you have N pending action-plan approvals," not a place to store the plan itself.

### Parent Pulse — **leave untouched, different concern**
- **Does:** a stateless, cron-driven weekly WhatsApp composer, no teacher review step, writes no plan table.
- **Verdict:** Could eventually *consume* the new engine's "one current action" for its message, but should not itself become a plan-writer.

### EILS / EIR — **confirmed frozen, leave untouched, do not revive**
- Frozen 2026-07-07, zero live callers confirmed by grep in this pass and by prior Sprint 7B audit. `nextAction.ts`'s own header describes exactly the cross-system arbitration/dedup role ("if Compass already covers gap X, don't also recommend it via holiday plan") that **no live feature currently performs**. This is the sharpest concrete gap the freeze left behind — see §4.

### `composeRecommendedNextSteps.ts` (Blueprint's own "Parent Action Centre") — **be strict here per the audit brief; must be explicitly resolved, not left alongside a new engine**
- **Does:** selects a parent-facing action list from Blueprint's own already-composed sibling sections (Compass, Teacher Reflection, Attendance, Career).
- **Reads:** nothing new — pure function over sibling `BlueprintSection` data.
- **Writes:** nothing — stateless, recomputed on every Blueprint render.
- **Canonical:** Yes, for "parent-facing default next-step text," but it has no approval workflow, no persistence, no versioning, no delivery-mode linkage.
- **Verdict:** This is the single most important overlap in the whole audit. It already occupies the exact conceptual slot ("what should this learner do next") the new capability is meant to fill. **It must be explicitly retired into the new engine's read view once the new engine exists** — i.e., once a teacher-approved action plan exists for a learner, `composeRecommendedNextSteps` should render *that* approved plan's parent-facing projection, not run its own independent selection in parallel. Shipping the new engine without this decision is exactly the "three sources of truth" failure mode the product intent prohibits.

---

## 4. Gap analysis

Smallest missing capabilities, by target requirement:

| Requirement | Status | Gap |
|---|---|---|
| In-term action plans | **Missing** | No table/model with a `context` concept spanning `current_term`/`intervention`/`extension`/`holiday` simultaneously for one learner. |
| End-term holiday plans | **Exists** (Holiday Planner) | Needs to become one context value of the same general model, not stay a structurally separate table forever — but is not blocking; can be bridged. |
| Teacher review/approval | **Partially exists** (Holiday Planner only) | Remedial Planner has none; no shared approval-state model exists across features. |
| Compass linking | **Missing** | `getOrCreateSession()` is mechanically sufficient (accepts `studentId`+`subject`, idempotent) but is internal-only, not exposed as a public "start journey" entry point, and `compass_sessions` has no `requested_by`/`source` provenance column. |
| Assignment linking | **Missing** | Creation logic is inline in a route (not `lib/`, pre-existing debt); no `student_id`-only targeting exists (assignments are `class_id`-only, with submissions fanned out to the whole roster); no linkage field analogous to `lesson_plan_id` exists for a plan-action source. |
| Parent support | **Exists, weakly** | Holiday Planner already notifies parents via WhatsApp on publish; the pattern generalizes, but there's no generic "parent support text" field independent of holiday context today. |
| Learner-facing goals | **Missing** | No structured, learner-legible goal/success-indicator field exists anywhere; `composeRecommendedNextSteps` produces parent-oriented prose only. |
| Review dates | **Missing** | No `review_date`-equivalent field found on any recommendation/intervention/plan table in this pass. |
| Success indicators | **Missing** | Not found as a structured field; only present as narrative text inside various composers. |
| Blueprint versioning | **Exists** (`blueprint_snapshots`) | Already immutable, trigger-enforced, reused correctly by the history UI. A new action-plan's own approval/publish events should hang off the same snapshot discipline rather than invent a second versioning concept — confirm during Phase 1 design whether action-plan state needs its own version column or can piggyback `blueprint_snapshots`' existing trigger points. |
| Cross-feature dedup (was EILS's job) | **Missing** | Nothing today prevents Remedial Planner and Holiday Planner from independently proposing an action against the same evidence gap with no awareness of each other. |

---

## 5. Canonical ownership decision

**Recommendation: a new, narrowly-scoped, Blueprint-owned table (e.g. `blueprint_action_items`), following the exact single-owner pattern `blueprint_snapshots` already established** ("this table is owned exclusively by `lib/learnerBlueprint/`, nothing else may write to it").

This is not the default choice — it is the conclusion after ruling out every existing candidate:

- **`intervention_log` cannot own it.** It is schema- and logic-bound to one auto-triggered intervention type (`prerequisite_warmup`) with no `context` field, no priority, no delivery-mode linkage. Repurposing it into a general action-item store would either break its existing single-purpose semantics or require bolting on enough new columns that it stops being the same table in practice — that's a new table wearing an old name.
- **Holiday Planner's plan tables cannot own it.** Their schema is structurally single-context (one holiday plan per learner per term/year). The product intent requires multiple simultaneous contexts (`current_term`, `intervention`, `extension`, `holiday`) coexisting for one learner — this doesn't fit a single-context table without a redesign that would itself be "creating a new table," just badly disguised as an extension.
- **Remedial Planner's table cannot own it.** Class-level only, no approval lifecycle, no per-learner item structure.
- **`composeRecommendedNextSteps` cannot own it.** It has no persistence at all — it is a pure function, not a data owner.

What the new table should **not** do: it must not write evidence directly, must not implement its own classification/scoring logic, and must not create Compass sessions or assignments itself. It is a **decision/plan record**, structurally analogous to `blueprint_snapshots` (a record of what was decided/frozen), not a second intelligence engine:

- **Candidate generation** reuses Projection (`recomputeLearnerProjection`) and the existing shared classifier (`classifyGroup`/`buildAdaptiveTask` from `lib/adaptiveLearning/recommend.ts`) — the same one Holiday Planner and Remedial Planner already share. No new classification logic.
- **Approval lifecycle** follows Holiday Planner's proven draft→publish pattern, including its `trigger: 'teacher' | 'auto'` event-attribution discipline.
- **Delivery fan-out** calls existing canonical services only: the assignment creation path (once extracted into `lib/`, see §7), and Compass's `getOrCreateSession()` (once exposed as a public entry point, see §7) — never a new writer.
- **Outcome tracking** reuses `intervention_log`'s check-in pattern conceptually (evidence-capped-at-observed-level, never inflated) rather than inventing a new evidence-capping rule.
- **`composeRecommendedNextSteps`** is retired into a read view over this new table once it exists (see §3).

---

## 6. Security analysis

| Check | Status | Detail |
|---|---|---|
| School isolation (`learner_evidence`, `schools`, `learners` RLS) | **Pass** | No cross-school leakage path found. `schools` is deliberately globally readable (non-sensitive metadata, documented decision) — not a leak. |
| Learner ownership (self-access) | **Pass** | `requireLearnerAccess` correctly matches the authenticated user's own resolved student id. |
| Parent-child relationship | **Pass** | Checked against real `learner_guardians`/legacy `parent_user_id` links, not "any parent at the school." |
| Teacher authorization (DB-level) | **Pass** | RLS's `auth_is_teacher_of_student` correctly joins `class_students → teacher_classes → teachers` — implements the "currently teaches this learner" rule correctly. |
| Teacher authorization (app-level) | **Fixed in Phase 0 (2026-07-25)** | `canViewLearner`'s teacher branch (`lib/core/permissions.ts`) checked only the legacy `students.teacher_id` column, not `class_students`, so a teacher who legitimately teaches a learner only via current class membership could be wrongly denied Blueprint access. Now checks both, matching RLS's `auth_is_teacher_of_student OR auth_is_direct_teacher_of_student` exactly — see `lib/core/permissions.teacherclassaccess.test.ts` and the implementation log's 2026-07-25 entry. |
| Admin privileges | **Pass, by design** | Any `school_admin`/`headteacher`/`deputy_headteacher` can view any learner's Blueprint at their school — intentional. |
| Service-role usage | **Pass** | Storage writes (including the new school-logo upload) correctly go through `createServiceClient()` only from server-side `lib/` functions, gated by `requireSchoolAdmin` at the route. |
| Sensitive-note visibility (teacher-private vs parent-visible) | **Not yet modeled** | No existing field distinguishes "teacher-private note" from "parent-visible note" anywhere in the recommendation/intervention surfaces audited. This must be designed explicitly for the new action-item model (Part C's stakeholder-projection requirement depends on it) — it is a gap, not a confirmed leak, because nothing currently exposes teacher-private text to parents; the risk is only realized if the new model is built without this distinction. |
| Cross-school logo/Blueprint leakage | **Pass, confirmed non-issue** | `school-logos` bucket is public by design (non-sensitive branding), paths are UUID-namespaced (not guessable), writes are admin-gated. |
| Published vs draft access | **Not yet modeled for Blueprint itself** | Blueprint has no draft/published status — it composes live on every request. Holiday Plans do have this distinction. If the new action-plan needs a draft state invisible to parents (Part C requires this explicitly — "draft recommendations must not appear in a published parent/learner PDF"), this must be designed new; it does not fall out of anything that exists today. |

**No critical or high-severity findings.** One medium finding (app-level teacher gate inconsistency) that fails closed rather than leaking, and two "not yet modeled" gaps that are prerequisites for Part C/F of the product intent rather than active vulnerabilities.

---

## 7. Implementation plan

Phased, each with an explicit exit condition. No phase after Phase 0 should start until the prior phase's exit condition is met.

**Phase 0 — Prerequisite corrections (no new feature surface) — RESOLVED 2026-07-25**
- Fixed `canViewLearner`'s teacher branch to check `class_students`, matching the RLS policy it was previously inconsistent with — see `lib/core/permissions.ts`, tested by `lib/core/permissions.teacherclassaccess.test.ts`.
- Calendar-context question resolved as "explicit teacher selection only, calendar data suggests but never decides" — documented in `docs/architecture/adr-0030-blueprint-context-selection.md`. No schema change made; none required by this decision.
- *Exit condition met:* teacher access gate matches RLS (10 new tests + full existing permissions suite passing, zero regressions); calendar-context decision is written down in ADR-0030. Full record: `docs/engineering/implementation-log.md`, 2026-07-25 entry.

**Phase 1 — Data model + domain skeleton, no UI, no delivery fan-out — RESOLVED 2026-07-25**
- `blueprint_action_items` + `blueprint_action_item_history` tables shipped, Blueprint-owned, immutable-after-decision pattern modeled on `blueprint_snapshots`/`teacher_reflections`. Full design record and schema: `docs/architecture/blueprint-action-plan-phase1.md`.
- `lib/learnerBlueprint/actionPlan/` domain shipped: propose (teacher-authored or system-generated via a deterministic candidate seam reusing `buildAdaptiveTask`), edit, approve/reject/defer, full history — no Compass/assignment creation, no evidence writes (proven by test).
- `composeRecommendedNextSteps` cutover implemented exactly per the "Preferred" approach: canonical-only once approved, stakeholder-visible items exist; unchanged legacy fallback otherwise; never both at once (tested).
- A pre-existing, previously-unknown RLS bug (`school_users`' own policy self-referentially recursive) was found and fixed as a required correction — see the Phase 1 doc §1.
- *Exit condition met:* a real authorized teacher can propose/edit/approve/reject/defer a persisted action item for a real learner via `lib/learnerBlueprint/actionPlan/`, verified with real signed-in Supabase sessions (28 tests, all passing); `composeRecommendedNextSteps` is redirected per the cutover rule, not silently duplicated.

**Phase 1.5 — `school_users` RLS Regression Audit — RESOLVED 2026-07-26**
- Dedicated regression audit of the Phase 1 recursion fix found and fixed a second, independent, pre-existing privilege-escalation defect in the same policy (any authenticated user could self-insert a `school_admin` row for any school) — fixed in `supabase/migrations/20260726090000_fix_school_users_self_escalation.sql`. Also identified (not fixed — out of scope) the same unrestricted-write shape recurring across 11 other tables. Full findings: `docs/architecture/school-users-rls-regression-audit.md`.
- 21 real-session tests added, all passing. Existing Phase 0/Phase 1 suites re-run with zero regressions.
- *Verdict:* Phase 2 may begin; the 11-table finding is a required near-term follow-up, not a Phase 2 blocker.

**Phase 2 — Delivery fan-out via existing canonical services only.** Split in practice into 2A (extraction), 2B (assignment delivery), and a not-yet-started 2C (Compass delivery) — narrower slices than originally scoped here, each with its own exit condition, rather than one combined phase.

**Phase 2A — Canonical Assignment Creation Service Extraction — RESOLVED 2026-07-25**
- Extracted assignment creation out of the inline route (`app/api/teacher/assignments/route.ts`) into `lib/assignments/create.ts` (`createAssignment`) + `lib/repositories/assignment.repository.ts`, fixing the pre-existing CLAUDE.md violation this audit flagged (§2 table, "Assignment/quiz creation" row) and giving Phase 2B something canonical to call. No Blueprint linkage yet in this sub-phase. Full record: `docs/architecture/assignment-creation-service-phase2a.md`.
- *Exit condition met:* the existing route calls the one canonical service; 38 pre-existing + 9 new tests passing, zero regressions.

**Phase 2B — Deliver an Approved Blueprint Action as an Assignment — RESOLVED 2026-07-25**
- Added the nullable `assignments.blueprint_action_item_id` linkage (database-enforced unique per action item) and a new coordination adapter, `lib/learnerBlueprint/actionPlan/delivery/assignment.ts` (`deliverBlueprintActionAsAssignment`), which calls `createAssignment()` with trusted, server-derived provenance — never a second writer. New route: `POST /api/teacher/blueprint/actions/[actionItemId]/deliver-assignment`. Class-wide delivery only (learner-specific targeting was audited and found unsafe to build without redesigning submission fan-out/grading/listing — see the Phase 2B doc §2), with mandatory explicit teacher confirmation. Full record: `docs/architecture/blueprint-assignment-delivery-phase2b.md`.
- *Exit condition met:* an approved action item can produce a real, traceably-linked assignment through the canonical service, idempotent under retry and concurrency (database-backed), with zero Compass/Evidence/notification side effects; 33 new tests passing, full Phase 0/1/1.5/1.6/2A regression suites re-run clean.

**Phase 2C — Deliver an Approved Blueprint Action to Learning Compass — RESOLVED 2026-07-25**
- Chose the queued-objective delivery model (Option A) over immediate session pre-creation: reused and extracted (from an inline route) the already-shipped `student_learning_context.compass_bridge` "teacher-suggested topic" mechanism, which `getNextSubject()` already read with highest priority — no new Compass session-creation capability was invented. New canonical service `lib/compass/objective.ts` (`setTeacherSuggestedTopic`), now called by both the pre-existing `PATCH /api/teacher/students/[studentId]/compass-topic` route and the new coordination adapter `lib/learnerBlueprint/actionPlan/delivery/compass.ts` (`deliverBlueprintActionToCompass`). New dedicated provenance table `blueprint_compass_deliveries` (not a nullable `compass_sessions` column — chosen because Option A never creates a session at delivery time and a single mutable JSON field can't hold durable provenance). New route: `POST /api/teacher/blueprint/actions/[actionItemId]/deliver-compass`. Zero model invocation anywhere in the delivery path — proven by a static source scan. Full record: `docs/architecture/blueprint-compass-delivery-phase2c.md`.
- *Exit condition met:* an approved action item can produce a real, traceably-linked, learner-specific Compass objective through the canonical setter, idempotent under retry and concurrency (database-backed), with zero session/Evidence/model-invocation side effects at delivery time; 33 new tests passing.

**Phase 2D — Blueprint Delivery Review Loop — RESOLVED 2026-07-26**
- Implemented Teacher Review, the final stage of the Blueprint execution cycle (Evidence → Projection → Blueprint → Teacher Approval → Blueprint Action → Delivery → Learner Interaction → New Evidence → Teacher Review). New canonical service `lib/learnerBlueprint/actionPlan/review.ts` (`reviewBlueprintAction` + `getBlueprintActionReviewSnapshot`) gathers — never recomputes — the latest Assignment completion state, Compass session summary, learner Evidence (via the pre-existing `getLearnerTimeline`), and Projection (via the pre-existing, non-recomputing `getPersistedProjections`), and records exactly one of five teacher-chosen decisions (`Complete`/`Needs Revision`/`Reopen`/`Defer`/`No Decision`) per call. New dedicated table `blueprint_action_reviews` (not a column on `blueprint_action_items` — that table's own decision-immutability trigger structurally forbids writing a review verdict onto an `approved` row; a review is also repeatable, unlike delivery, so no uniqueness constraint applies), with two unconditional DB-level immutability triggers (no UPDATE, no DELETE, ever, mirroring `blueprint_action_item_history`'s own precedent). `blueprint_action_items.status` is never mutated by review — it remains `approved` through every review, every reopen — proven directly, not assumed. New routes: `GET`/`POST /api/teacher/blueprint/actions/[actionItemId]/review`. The invariant this phase exists to enforce — automatic activity signals (assignment marking, Compass sessions, new Evidence, new Projections) never complete an action on their own — is now also permanently codified as `docs/architecture/adr-0031-educational-actions-require-human-review.md`. Full record: `docs/architecture/blueprint-review-loop-phase2d.md`.
- *Exit condition met:* a teacher can review a delivered, approved action item and record any of the five decisions, with Evidence/Projection/Assignment/Compass mutation guardrails proven both statically (source scans) and behaviorally (before/after row comparisons); 42 new tests passing, full Phase 2A/2B/2C regression suites (86 tests) re-run clean.

**Phase 2E — Blueprint Teacher Review Workspace — RESOLVED 2026-07-26**
- Built the teacher-facing UI over Phase 2D's canonical review service — no new educational logic, no change to Evidence/Projection/Assignment/Compass ownership, no change to the Blueprint action lifecycle. New learner-scoped route `/teacher/learners/[learnerId]/blueprint/review` (server component: auth + one read-model call) lets an authorized teacher see every approved action item for a learner, open one to inspect its Assignment/Compass activity, latest Evidence, current Projection, and full review history, and record any of the five Phase 2D decisions. New thin read model `lib/learnerBlueprint/actionPlan/reviewWorkspace.ts` (`listReviewableBlueprintActionsForLearner`) fills the one real gap the audit found — the Phase 2D snapshot throws on an undelivered action, correct for a single-action detail view but wrong for a list that must show "not yet delivered" as a normal state — without reimplementing `getBlueprintActionReviewSnapshot()`'s own gathering, and reads learner-scoped Evidence/Projection once per learner rather than once per action. A read-only, presentation-only "awaiting review" rule (`computeAwaitingReview`) flags actions needing attention from timestamp comparisons alone — never persisted, never a verdict. All writes still pass through the unmodified `reviewBlueprintAction()` via its existing route; the UI introduces no new writer anywhere. Full record: `docs/architecture/blueprint-teacher-review-workspace-phase2e.md`.
- *Exit condition met:* an authorized teacher can open one learner's workspace, see all relevant approved actions, inspect delivery/Evidence/Projection summaries through existing read boundaries, and submit all five review decisions with the approved action item remaining immutable throughout; 55 new tests passing, full Phase 2A/2B/2C/2D regression suites (86 + 42 = 128 tests) re-run clean.

**Phase 3A — Blueprint Execution Experience: Pilot-Ready Teacher Workflow — RESOLVED 2026-07-26**
- Not a domain-building phase — turned the existing Phase 1–2E architecture into one coherent, commercially demonstrable teacher workflow on the existing learner Blueprint page. New "Blueprint Action Plan" section (`components/blueprint/actionPlan/`) shows every approved action with its delivery/activity/review state (all derived, presentation-only, never persisted — `deriveActionCardPresentation`/`recommendNextAction`), and two focused delivery panels (`AssignmentDeliveryPanel`, `CompassDeliveryPanel`) calling the unmodified Phase 2B/2C endpoints directly — zero new writers, zero duplication of `createAssignment()`/`setTeacherSuggestedTopic()`. The Phase 2E Review Workspace gained an optional `?action=<id>` deep-link so a card's "Review progress" link lands on the exact action. `listReviewableBlueprintActionsForLearner()` (Phase 2E) gained four small additive DTO fields (`learnerAction`, `successIndicator`, `latestReviewNotes`, `assignmentId`) — no new endpoint. **A genuine, pre-existing usability blocker was found and fixed**: two independent gates (`proxy.ts` middleware and `app/student/layout.tsx`) unconditionally redirected every teacher away from `/student/blueprint/[learnerId]` before the page's own already-correct `requireLearnerAccess` check ever ran — meaning neither this phase's work nor Phase 2E's "Review Actions" link were ever reachable in production until this fix. Full record: `docs/architecture/blueprint-execution-experience-phase3a.md`.
- *Exit condition met:* the full teacher workflow (open Blueprint → inspect approved action → deliver → see status → open Review Workspace → inspect activity/Evidence/Projection → record judgement → return to Blueprint and see the result) is discoverable from one page and demonstrable end-to-end in five minutes on real data; 269 tests passing (33 new UI/logic + 3 new end-to-end HTTP + 233 full regression across Phases 2A–2E and the pre-existing student-routing suite), zero regressions.

**Phase 3 — Holiday-plan generalization**
- Bring Holiday Planner and Remedial Planner onto the same approval-gate standard (Remedial Planner currently has none); express holiday plans as one `context` value of the general model rather than a permanently separate table.
- *Exit condition:* a holiday plan and an in-term intervention for the same learner are both visible as action items in one place, with consistent approval semantics.

**Phase 4 — Presentation (stakeholder projections, PDF context adaptation)**
- Build the learner/parent/teacher projections over the one canonical action-plan table (Part C), draft-vs-published visibility enforced at the query layer, context-adaptive page-seven titles.
- *Exit condition:* PDF renders only approved, published data for parent/learner recipients; teacher view can see draft state; both are views over one table, not two.

**Phase 5 — Cross-feature dedup**
- Address the gap EILS used to cover: before proposing a new action item, check whether an existing open action item (from Remedial Planner-derived or Holiday-derived candidates) already targets the same evidence gap.
- *Exit condition:* documented + tested dedup behavior; this was explicitly out of scope for Phases 1-4 and should not block them.

---

## Files inspected (representative, not exhaustive — full list spans ~120 files across four research passes)

`lib/learnerBlueprint/*` (composeBlueprint.ts and all 18 composers, types.ts, snapshot.ts, pdfExport.ts, validation.ts), `lib/projection/recompute.ts`, `lib/intelligence/evidenceLifecycle.ts`, `lib/learnerRecord/timeline.ts`, `lib/core/permissions.ts`, `lib/core/school.ts`, `lib/holiday/{planner,return,notify}.ts`, `lib/remedial/{planner,interventionEvidence}.ts`, `lib/adaptiveLearning/recommend.ts`, `lib/compass/{session,summary,evidence,autoConfirm}.ts`, `lib/parentPulse/{builder,observationPipeline}.ts`, `lib/teacherWorkflow/nextAction.ts`, `lib/attentionFeed/panel.ts`, `_frozen/eils/*`, `_frozen/eir/*`, `app/api/teacher/assignments/route.ts`, `app/api/teacher/intervention-checkin/route.ts`, `app/api/teacher/monday-panel/route.ts`, `app/api/holiday/{generate,publish}/route.ts`, `app/api/cron/auto-publish-holiday-plans/route.ts`, `app/student/blueprint/[learnerId]/page.tsx`, relevant migrations under `supabase/migrations/` (core foundation, RLS policies, evidence RLS bypass fix, blueprint snapshots, teacher reflections, phase-C teacher remarks), and `docs/architecture/learner-record-layer-decisions.md`, `sprint-7b-learner-signal-consolidation-audit.md`, `sprint-12m-learning-compass-blueprint-integration.md`, `sprint-12s-parent-action-centre.md`.

## Proposed migrations, if any

None at the time this audit was written. Since applied, in phase order: Phase 1 introduced `blueprint_action_items` + `blueprint_action_item_history` (`supabase/migrations/20260725080553_blueprint_action_items.sql`). Phase 2B introduced the nullable `assignments.blueprint_action_item_id` linkage, its two partial indexes, and a widened `blueprint_action_item_history.event_type` CHECK admitting `'delivered'` (`supabase/migrations/20260725150000_assignment_blueprint_provenance.sql`). Phase 2C introduced the dedicated `blueprint_compass_deliveries` table (not a `compass_sessions` column, per its own design finding) and widened `event_type` again to admit `'delivered_to_compass'` (`supabase/migrations/20260725170600_blueprint_compass_delivery.sql`). Phase 2D introduced the dedicated, unconditionally-immutable `blueprint_action_reviews` table (not a column on `blueprint_action_items` — that table's decision-immutability trigger structurally forbids it) and widened `event_type` a third time to admit the five review outcomes (`supabase/migrations/20260726100000_blueprint_action_review.sql`). Phase 2E introduced no migration — it is UI and read-model only, over the schema Phase 2D already shipped. Phase 3A likewise introduced no migration — UI, a thin additive DTO extension, and a routing/authorization-carve-out fix (`proxy.ts` / `app/student/layout.tsx`), no schema change.

## Risks and deferred work

- **`learner_profiles` direct reads** in 4 feature-module files (`app/api/cron/term-readiness/route.ts`, `app/api/teacher/monday-panel/route.ts`, `app/api/whatsapp/inbound/route.ts`, `scripts/verify-topical-assessment.ts`) are a pre-existing, previously-acknowledged gap (tracked in the Ledger per `learner-record-layer-decisions.md` Decision 4), not new. The new action-plan engine must not add a fifth.
- **Two disconnected "current term" sources** (Core's DB-driven `terms.is_current` vs. Holiday Planner's hardcoded `KE_CBC.getCurrentTerm()` month-lookup) can disagree for a school on an atypical calendar — resolved by the Phase 0 decision, not urgent before then.
- **Teacher-private vs. parent-visible note distinction** does not exist anywhere yet and must be designed fresh in Phase 1, not assumed.
- **Cross-feature dedup** (§4, §7 Phase 5) is real but explicitly deferred — building Phases 1-4 without it is safe as long as Phase 5 is tracked, not silently dropped.
