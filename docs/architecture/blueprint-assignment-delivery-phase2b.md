# Blueprint Assignment Delivery — Phase 2B

**Date:** 2026-07-25
**Scope:** Deliver an approved Blueprint action item as a real, class-wide assignment through the Phase 2A canonical assignment service. No Blueprint→assignment linkage schema existed before this phase; no Compass work; no holiday-plan generalization; no stakeholder PDF changes; Phase 2C not started.

---

## 1. Executive verdict

**DONE — GO for Phase 2C.**

An authorized teacher can now convert an approved Blueprint action item into a real assignment via `POST /api/teacher/blueprint/actions/[actionItemId]/deliver-assignment`, which calls a new coordination adapter (`lib/learnerBlueprint/actionPlan/delivery/assignment.ts`), which calls the Phase 2A canonical service (`lib/assignments/create.ts`) — never a second writer. Delivery requires an explicit teacher decision (`confirmClassWideDelivery: true`); the resulting assignment carries a traceable, database-enforced-unique link back to the action item (`assignments.blueprint_action_item_id`); repeated or concurrent delivery attempts are proven not to duplicate; and delivery has zero Compass/Evidence/notification side effects. 21 lib-level integration tests + 6 HTTP tests + 6 pure unit tests, all passing against a live database and real sessions; the full pre-existing Phase 2A (44/47, see §14 on the 3 transient failures), Phase 1 (41/41), and Phase 1.5/1.6 RLS (see §14) suites re-run clean.

## 2. Focused targeting audit

**The conflict:** Blueprint action items are learner-specific (`blueprint_action_items.learner_id` → Core `learners.id`). Assignments are class-targeted — `assignments.class_id`, with `assignment_submissions` fanned out to every current row in `class_students` for that class (Phase 2A, unchanged). There is no single-learner assignment-targeting model anywhere in the codebase: submission fan-out, grading, listing, quiz delivery, and parent/learner views all assume "this assignment belongs to a class," not "this assignment belongs to one learner within a class." Retrofitting a nullable `student_id`-scoped assignment would touch all of those, none of which this phase was authorized to redesign.

**Decision: the preferred smallest scope — class-wide delivery with explicit teacher confirmation.** The originating learner is provenance for the Blueprint action; the created assignment is intentionally, explicitly class-wide. The delivery command requires `confirmClassWideDelivery: true` — omitting it or passing `false` is a `ValidationError`, never a silent default. No code path infers a class from the learner's current enrollment; the teacher must always name `classId` explicitly (a UI could suggest one, but Phase 2B builds no UI).

**Identity bridge, not a conflict:** the same mechanism Phase 0 already established (`resolveLegacyStudentId`, `canManageLearnerRecordCore`) makes the Core-learner / legacy-class domains composable without inventing anything new: the delivery adapter authorizes the Blueprint side via `canManageLearnerRecordCore` (Core learner space) and the assignment side via `createAssignment`'s own `requireClassTeacher` (legacy class space) — two independent, already-canonical checks, both required, neither substituting for the other. No school-id cross-check was added between them, mirroring Phase 0's own documented reasoning: neither the legacy tables nor the RLS functions this composes carry a Core `schools.id` FK, and the relationship match itself (this specific teacher, this specific learner; this specific teacher, this specific class) is already the isolation boundary.

**Cardinality decisions:**
- One action item → **at most one** assignment delivery (enforced by a database partial unique index, not just application logic).
- One assignment → at most one originating action item (a single nullable FK column; structurally cannot reference two).
- Retry safety: keyed on the action item id alone via `assignments.blueprint_action_item_id`, never on title/date matching.

No material identity or targeting conflict blocked delivery — the audit found a safe, minimal, already-precedented path.

## 3. Assignment-provenance model

`assignments.blueprint_action_item_id` — nullable `uuid`, `REFERENCES blueprint_action_items(id) ON DELETE SET NULL`. `NULL` for every pre-existing and ordinary-route-created assignment. Set exactly once, at insert time, only by `createAssignment()` when called with server-derived `blueprintActionItemId` — the ordinary teacher-facing route has no request-schema field for it and always omits it (proven by a static-source-scan test, §11).

Indexes:
- `idx_assignments_blueprint_action_item_id` (partial, `WHERE ... IS NOT NULL`) — the provenance lookup the idempotency check runs.
- `uq_assignments_blueprint_action_item_id` (partial unique, same predicate) — the database-level backstop for "at most one assignment per action item."

`blueprint_action_item_history.event_type`'s CHECK constraint was widened (additively) to admit `'delivered'` alongside the Phase 1 set. No existing row's `event_type` value is affected.

Migration: `supabase/migrations/20260725150000_assignment_blueprint_provenance.sql`, applied to the live project (verified via `mcp__supabase__execute_sql` — column, both indexes, and the widened CHECK constraint all confirmed present post-apply). No existing `assignments` or `blueprint_action_item_history` row was altered.

## 4. Delivery ownership

`lib/learnerBlueprint/actionPlan/delivery/assignment.ts` — `deliverBlueprintActionAsAssignment(client, actionItemId, command)`. Coordinates:
- loading and validating the action item (`repos.blueprintActionItems`);
- authorization (`canManageLearnerRecordCore` for the learner side; `createAssignment`'s internal `requireClassTeacher` for the class side);
- deterministic content mapping (`mapActionToAssignmentDraft`, exported, pure, unit-tested independently);
- calling `createAssignment()` (Phase 2A) with trusted provenance;
- idempotency (existence check + DB-unique-violation fallback);
- appending a `'delivered'` history event (`repos.blueprintActionItemHistory`).

It owns none of the persistence itself — no `.from('assignments')` or `.from('blueprint_action_items')` write anywhere in this file; every write goes through an existing repository or the Phase 2A service.

## 5. Authorization intersection

Both of the following must hold; neither substitutes for the other:

1. **Learner authority** — `canManageLearnerRecordCore(client, action.school_id, action.learner_id)`. Denies: parent, the learner themself, an unrelated same-school teacher, a cross-school teacher, a teacher who only owns the target class but has no relationship to this learner.
2. **Class authority** — enforced inside `createAssignment()` via `requireClassTeacher`, unchanged from Phase 2A. Denies: a teacher who manages the learner but does not own the selected class.

Action `visibility` (`teacher_only`/`learner_visible`/`parent_visible`/`shared`) is never consulted for delivery authorization — it governs stakeholder *reads* (Phase 4, not yet built), not who may deliver. Confirmed by test: a `teacher_only` action's authorized teacher can still deliver (visibility never gates the actor who already passed both authority checks), and no visibility value alone grants delivery to someone who fails either check.

`ResourceOwnershipError` (403) for both authority failures; `UnauthorizedError` (401) for no session; `NotFoundError` (404) for an unknown action item id; `ConflictError` (409) for a non-`approved` status or a lost concurrency race; `ValidationError` (400) for a missing/false confirmation or an incomplete payload.

## 6. Deterministic content mapping

`mapActionToAssignmentDraft(action)`:
- `title` ← `action.title`, verbatim.
- `instructions` ← `action.learnerAction` (falls back to `action.intendedOutcome` if null) + `"Success looks like: " + action.successIndicator`.
- `dueDate` (suggestion only) ← `action.reviewDate`, or `null`.

Never reads `teacherNotes`, `evidenceBasis`, `parentSupport`, `teacherAction`, or `schoolSupport` — proven by a dedicated unit test that plants private-marker strings in all five fields and asserts none appear in the serialized draft. The delivery command accepts optional `title`/`instructions`/`dueDate` overrides (the teacher remains responsible for the final content); when omitted, the deterministic mapping is used. `subject`/`topic` are always teacher-supplied — the Blueprint domain has no reliable subject/topic data, and parsing the free-text `target_capability` field to invent them would violate "deterministic mapping only."

## 7. Atomicity behavior

Chosen approach (the task brief's preferred option 2): **the canonical assignment service accepts provenance linkage at creation time**, so the assignment row and its `blueprint_action_item_id` are written in the same `INSERT` — never a create-then-link two-step with a window for an untracked assignment. `CreateAssignmentCommand.blueprintActionItemId` is server-derived-only (see §3, §11).

The one write that happens *after* the assignment insert is the `'delivered'` history event. If that write fails, it is logged (`console.error`) and swallowed, not thrown — the delivery still returns success. This is deliberate, not an oversight: provenance itself is never at risk (it's already durably on the assignment row by the time history-writing runs), so a lost history-write failure loses only a convenience audit-log entry, recoverable at any time by re-deriving from `assignments.blueprint_action_item_id` directly. This mirrors the exact precedent Phase 2A already established for submission-fan-out failures (log, don't throw, since the primary write already succeeded).

## 8. Idempotency behavior

Keyed only on the action item id (`assignments.blueprint_action_item_id`), never on title/date matching:

1. **Fast path** — before validating or creating anything, `findByBlueprintActionItemId(actionItemId)` checks for a prior delivery. If found, it's returned immediately (`alreadyDelivered: true`), regardless of what the current call's `command` contains — a second delivery attempt is defined purely by "was this action item already delivered," not by whether the retry's parameters match the original.
2. **Race backstop** — if two calls both pass the fast-path check (a genuine concurrent race), the database's partial unique index lets exactly one `INSERT` succeed; the loser's Postgres `23505` is caught by the repository, re-thrown as a typed `ConflictError`, caught by the adapter, and resolved by re-fetching and returning the winner's row — never surfaced to the caller as a failure.

Proven by a real concurrent test (`Promise.all` of two simultaneous `deliverBlueprintActionAsAssignment` calls against the same action item) asserting both resolve to the same assignment id and exactly one row exists afterward, plus a sequential-retry test.

## 9. API surface

`POST /api/teacher/blueprint/actions/[actionItemId]/deliver-assignment`

Request body: `{ classId, confirmClassWideDelivery, subject, topic, title?, instructions?, dueDate?, type?, maxScore?, isQuiz? }`

Response: `{ assignment, alreadyDelivered }` — `201` on first delivery, `200` on idempotent replay.

The route is thin: parse (Zod), call the adapter, map errors to status. No orchestration logic lives in the route. No UI was built (per scope) — the route itself, exercised over real HTTP, is this phase's interface.

## 10. Tests and real-session verification

- `lib/learnerBlueprint/actionPlan/delivery/assignment.mapping.test.ts` — 6 pure unit tests, no DB.
- `lib/learnerBlueprint/actionPlan/delivery/assignment.integration.test.ts` — 21 real-session, real-database tests (no dev server needed — the adapter and `createAssignment` both take an arbitrary `SupabaseClient`): every lifecycle-status gate, the full authorization intersection matrix (8 distinct denial/success scenarios), every validation failure, the happy path (provenance, fan-out-to-correct-roster, history event, unchanged action status, zero Compass/Evidence side effects), roster-exclusion, sequential and concurrent idempotency, admin-tier behavior, and a static source-scan proving the ordinary route never references Blueprint provenance fields.
- `lib/learnerBlueprint/actionPlan/delivery/assignment.http.integration.test.ts` — 6 tests over real HTTP against a live `next dev` server: unauthenticated 401, missing-confirmation 400 (both Zod-shape and business-rule paths), not-found 404, success 201 then idempotent-replay 200, and proof the ordinary assignment route is unaffected (still 201, still `blueprint_action_item_id: null`).

All 33 new tests pass. Regression: Phase 1 (`lifecycle.integration.test.ts` + `projections.test.ts` + `composeRecommendedNextSteps.cutover.test.ts`) 41/41 pass, unmodified. Phase 2A (`lmsRoutes.http.integration.test.ts` + `create.http.integration.test.ts`) and Phase 1.5/1.6 RLS results are recorded in §14, including the transient-infrastructure distinction the task explicitly asked to preserve rather than hide.

## 11. Static writer/caller inventory

- `createAssignment()` (Phase 2A canonical service) callers: `app/api/teacher/assignments/route.ts` (ordinary route, unchanged, never sets provenance) and `lib/learnerBlueprint/actionPlan/delivery/assignment.ts` (new, second caller, always sets provenance after independent authorization). Confirmed via `grep -rn "createAssignment("` — no other caller exists.
- Live inserts into `assignments`: exactly one, `lib/repositories/assignment.repository.ts#createAssignmentRecord`, called only from `lib/assignments/create.ts`. No direct insert anywhere in the delivery adapter or the new route (grepped for `.from('assignments')` — zero hits outside the repository).
- Live writes to `assignments.blueprint_action_item_id`: only via the `createAssignmentRecord` insert above — never an `UPDATE`, anywhere.
- Blueprint delivery entry points: exactly one, `POST /api/teacher/blueprint/actions/[actionItemId]/deliver-assignment` → `deliverBlueprintActionAsAssignment`.
- Assignment-delivery history writer: `recordDeliveryHistory` inside the same adapter file, the only caller of `repos.blueprintActionItemHistory.record` with `event_type: 'delivered'`.

Desired end state achieved: one canonical assignment service, two authorized callers, one writer beneath it, no Blueprint caller bypassing authorization, no Compass caller anywhere in this phase.

## 12. Deferred work

- No prefill/preview UI (not built — out of scope; `mapActionToAssignmentDraft` is exported specifically so a future UI can call the same function rather than reimplementing the mapping).
- No single-learner assignment targeting (see §2 — the audit found no safe path to build this without redesigning submission fan-out/grading/listing).
- No transaction wraps the assignment insert and the history-event write (see §7) — an intentional, documented, low-risk gap, not an oversight.
- Delivery does not yet surface in any Blueprint or Teacher Workspace UI — a route exists, nothing calls it yet outside tests.
- Phase 2C (Compass-facing delivery, or any further action-plan delivery channel) — not started, not designed.

## 13. Explicit statement: Compass was not started

No file in this phase creates, reads, or references `compass_sessions`, `getOrCreateSession`, or any Compass module. Verified both by code review of every file touched (none import from `lib/compass/`) and by a passing automated test (`assignment.integration.test.ts`'s happy-path test queries `compass_sessions` for the delivering learner after delivery and asserts zero new rows).

## 14. Verification results, with transient infrastructure separated from real failures

This session's environment exhibited sustained, intermittent network flakiness reaching Supabase (both the Auth admin API and plain table writes) — the identical `TypeError: fetch failed` / `AggregateError [ETIMEDOUT]` signature recurred across multiple, unrelated files and processes throughout this phase, including inside the running `next dev` server process itself during a plain, unmodified-by-this-phase assignment insert. This is the same category of flake already documented in this codebase's own `lifecycle.integration.test.ts` header comment, predating this phase. Per the task's explicit instruction, this is reported honestly, not hidden or silently retried into a fabricated pass:

- **New Phase 2B suites**: 33/33 pass (6 unit + 21 lib-integration + 6 HTTP), across two clean full runs each for the integration/HTTP files after one `before()`-hook-level flake was cleared by a bounded setup retry (the standard pattern already used in 3+ other files in this codebase, added here to 2 files that were missing it: `lib/testing/lmsRoutes.http.integration.test.ts` and `lib/assignments/create.http.integration.test.ts`).
- **Phase 1 regression** (`lifecycle.integration.test.ts` + `projections.test.ts` + `composeRecommendedNextSteps.cutover.test.ts`): 41/41 pass, unmodified.
- **Phase 2A regression** (`lmsRoutes.http.integration.test.ts` + `create.http.integration.test.ts`): first attempt (before the retry-wrapper fix above) failed 3/47 with `500`s traced directly to `createAssignmentRecord: TypeError: fetch failed` in the live dev-server log — a network failure during the Supabase insert itself, unrelated to any Phase 2B code (these three tests create ordinary, non-Blueprint assignments; the schema change is purely additive). Re-run clean: **47/47 pass.**
- **Phase 1.5/1.6 RLS regression** (`coreAcademicRlsHardening.integration.test.ts` + `schoolUsersRlsRegression.integration.test.ts`): **44/44 pass**, unmodified — the hardened policies were not touched by this phase's migration.
- **TypeScript** (`tsc --noEmit`) and **ESLint**: clean on every new/touched file, checked after every edit in this phase, not only at the end.
- **Evidence/Projection guardrail**: unaffected — no file in this phase reads `repos.evidence.findByLearner`/`findConfirmedEvidenceForLearner`/`findPendingReview` or `learner_profiles` directly; the ESLint rule enforcing this was not touched and reports zero violations on the new files.

No authorization assertion was retried, and no unexecuted assertion was converted into a passing test anywhere in this phase — every retry described above was a bounded setup (user-provisioning) retry, applied before any assertion ran, matching the task's explicit instruction.
