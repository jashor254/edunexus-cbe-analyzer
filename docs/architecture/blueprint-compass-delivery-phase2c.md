# Blueprint Compass Delivery — Phase 2C

**Date:** 2026-07-25
**Scope:** Deliver an approved Blueprint action item to Learning Compass as a bounded, teacher-confirmed tutoring objective. No Compass engine duplication, no tutoring logic in Blueprint code, no model invocation, no automatic tutoring, no Phase 2D/broader publishing work.

---

## 1. Executive verdict

**DONE.**

An authorized teacher can now deliver an approved Blueprint action item to Learning Compass via `POST /api/teacher/blueprint/actions/[actionItemId]/deliver-compass`, which calls a new coordination adapter (`lib/learnerBlueprint/actionPlan/delivery/compass.ts`), which calls the canonical, newly-extracted Compass objective-setter (`lib/compass/objective.ts#setTeacherSuggestedTopic`) — never a second Compass writer, never a model call. Delivery is learner-specific by construction (the learner is derived from the action item, never accepted from the client), requires explicit confirmation (`confirmCompassDelivery: true`), is idempotent under retry and concurrency (database-enforced), and has zero Compass-session, Evidence, or model-invocation side effects at delivery time. 33 new tests (8 unit + 18 lib-integration + 7 HTTP), all passing against a live database and real sessions.

## 2. Compass ownership audit

**Canonical session creator:** `getOrCreateSession(studentId, subject, mode)` (`lib/compass/session.ts`) — learner-specific (keyed on legacy `students.id`), backed by `repos.compass.createSession`. Confirmed by its own header comment ("No AI logic — no prompts, no DeepSeek calls here") and by code inspection: it inserts a row and returns; the model is invoked later, elsewhere (`app/api/learn/route.ts`, only once the learner sends a real message).

**Pre-session objective support — already exists, previously undiscovered by this document's own author until this audit.** `student_learning_context.compass_bridge` (a JSON field) already carries a teacher-set `{firstSubject, firstConcept, strandName, teacherSuggested, teacherSuggestedAt}` shape, written today by `PATCH /api/teacher/students/[studentId]/compass-topic` — a pre-existing, shipped "teacher recommends a Compass topic" feature. `getNextSubject()` (`lib/compass/session.ts`) reads it with **highest priority** ("a) Teacher recommendation") over every other subject-selection heuristic. This is, functionally, exactly the "queued Compass objective" concept the task asked this phase to design — it did not need to be invented, only reused and (per the task's own instruction) extracted from its inline route into a canonical service, since it was inline logic, not a `lib/` function.

**Session is learner-specific:** yes, always (`compass_sessions.learner_id`, `student_learning_context.student_id`).

**Multiple sessions from one action:** not applicable to Phase 2C's chosen model — no session is created at delivery time at all (see §3).

**Immediate session creation vs. queued objective:** both are technically safe (session creation itself never touches the model), but Phase 2C chose the queued-objective model exclusively — see §3 for the full reasoning.

**Session retries/resumes:** unchanged, untouched — `getOrCreateSession`'s existing resume-window logic (3h school-day / 30min holiday) governs this entirely, outside this phase's scope.

**Learner-visible Compass fields:** `compass_bridge.firstSubject`/`firstConcept`/`strandName` are read server-side by `getNextSubject()`, never exposed as a raw API response to the learner directly — the learner experiences it only as "Compass started with this topic," not as a readable record.

**Evidence write point in the Compass lifecycle:** exactly one, `recordCompassSessionEvidence()` (`lib/compass/evidence.ts`), called only from `app/api/learn/end/route.ts` at session **end**, and only for sessions with at least one real exchange. Session *creation* (dormant or otherwise) never writes evidence — confirmed by code inspection and by this phase's own new tests.

## 3. Chosen delivery model: Option A (queued Compass objective)

Chosen over Option B (immediate dormant session creation) for two reasons:

1. **A safe, already-shipped, zero-model-coupling mechanism already exists** (`compass_bridge`) that does exactly this job — reusing it is smaller and safer than introducing session pre-creation as a new capability nothing in the codebase does today.
2. **Provenance durability.** `compass_bridge` is a single mutable JSON field with no id and no history — it can be silently overwritten by the next write (another delivery, or a teacher's own direct `PATCH`). A dedicated table (`blueprint_compass_deliveries`, §5) is what makes "this action item was delivered to Compass, once, traceably" a durable fact independent of whatever `compass_bridge` currently holds.

Option B (pre-creating a dormant `compass_sessions` row) was confirmed **technically safe** by this audit — `getOrCreateSession` never invokes a model — but was not built: it would be a genuinely new capability requiring new product-level decisions (what does a "ready but unstarted" session look like to the learner's client?) that this phase's minimal-scope mandate doesn't call for. Flagged as a natural, low-risk candidate for a future phase, not attempted here — satisfying the task's own framing ("no tutoring session begins automatically **unless** the teacher explicitly chooses immediate activation and the architecture safely supports it") by simply never offering that choice in Phase 2C, the strictly safer reading of that constraint.

**Session activation, as actually implemented:** `delivered` (the `blueprint_compass_deliveries` row is created) → `available_to_learner` (the same instant — `compass_bridge` is written in the same call) → `learner_starts` (the learner's own next Compass visit, through the existing, entirely unmodified `getOrCreateSession`/`getNextSubject` flow) → `active_session`/`completed` (Compass's own existing lifecycle, never observed or mirrored back into Blueprint's tables in this phase — see §5's reserved-column note).

## 4. Learner-specific targeting

The action item's own `learner_id` is the only source of the delivery's learner — there is no `learnerId` field anywhere in `DeliverBlueprintActionToCompassCommand`, so a client cannot substitute another learner even if it tried (mirrors Phase 2B's identical, already-proven pattern for the assignment side). Cross-learner access to a delivered objective is prevented by the *existing*, unmodified Compass ownership/session-start flow (`resolveCompassStudentAccess`/`resolveLearnerOwnership` in `lib/compass/ownership.ts`, and `getNextSubject(studentId)` always operating on the caller's own resolved identity) — Phase 2C adds nothing here and weakens nothing.

## 5. Provenance schema

`blueprint_compass_deliveries` — a **dedicated table**, not a nullable column on `compass_sessions`, because (per the task's own stated preference criteria, all of which apply here): Phase 2C's delivery model never creates a session at delivery time at all; provenance must survive `compass_bridge` being overwritten; and delivery state (`available`) genuinely differs from session state (which this table does not track).

Columns: `id`, `learner_id` (Core), `school_id`, `blueprint_action_item_id` (`UNIQUE`, FK, `ON DELETE CASCADE`), `status` (`available`/`started`/`completed`/`expired` — only `'available'` is ever written by Phase 2C code; the rest are reserved for a future phase that mirrors real Compass progression back, matching Phase 1's own reserved-enum-value precedent), `subject`, `objective`, `learner_instructions`, `success_indicator`, `curriculum_reference`, `review_date`, `compass_session_id` (nullable, FK, reserved — **not populated by Phase 2C**, since Option A creates no session), `created_by`, `created_at`, `updated_at`.

Migration: `supabase/migrations/20260725170600_blueprint_compass_delivery.sql`, applied to the live project and verified via direct SQL (columns, RLS, and the widened `blueprint_action_item_history.event_type` CHECK — now admitting `'delivered_to_compass'` alongside Phase 1/2B's set — all confirmed present post-apply). Purely additive: no existing `assignments`, `compass_sessions`, or `blueprint_action_item_history` row is altered.

RLS: identical shape to `blueprint_action_items` (Phase 1) — coarse school-staff-only `SELECT`, no `authenticated` write policy at all (service-role only, written exclusively by the delivery adapter). No learner/parent RLS branch is needed: neither role ever reads this table directly — a learner's "access" to a delivered objective is entirely through the existing, unmodified `compass_bridge`/`getNextSubject()` flow, unaffected and unwidened by this table's own policy.

**Cardinality, explicitly decided:** one active Compass delivery per Blueprint action item (`UNIQUE` constraint, not partial — every row in this table is a Blueprint delivery by definition, unlike `assignments.blueprint_action_item_id`, which needed a *partial* unique index to exclude the many ordinary non-Blueprint rows). One delivery never produces more than one Compass session by design (Option A creates none). Retries reuse the same delivery row (idempotency, §9 below). Re-delivery of a completed/expired delivery is explicitly out of scope — not modeled, per the task's own instruction to avoid allowing "accidental duplicates" rather than build a re-issue flow prematurely.

## 6. Authorization rules

Both of the following must hold:

1. **Learner authority** — `canManageLearnerRecordCore(client, action.school_id, action.learner_id)`. Denies parent, the learner themself, an unrelated same-school teacher, a cross-school teacher.
2. **Compass-identity precondition** — `resolveLegacyStudentId(action.learner_id)` must resolve. A Core learner with no legacy bridge yet has no Compass identity to deliver to at all (a legitimate, common, pre-existing state — same gap Phase 0 already documented for `canManageLearnerRecordCore`'s own admin-fallback branch). Surfaced as `IdentityResolutionError` ("Compass unavailable for learner"), not a generic failure.

Action `visibility` is never consulted for delivery authorization (identical reasoning to Phase 2B — visibility governs stakeholder reads, never delivery authority). `UnauthorizedError` (401) for no session; `ResourceOwnershipError` (403) for the learner-authority failure; `NotFoundError` (404) for an unknown action item; `IdentityResolutionError` (404) for the Compass-identity precondition; `ConflictError` (409) for a non-`approved` status or a lost concurrency race; `ValidationError` (400) for a missing/false confirmation or a missing subject.

## 7. Deterministic content mapping

`mapActionToCompassObjective(action)`:
- `objective` ← `action.learnerAction` (falls back to `action.intendedOutcome`), verbatim.
- `learnerInstructions` ← the objective + `"Success looks like: " + action.successIndicator`.
- `successIndicator` ← passthrough.
- `reviewDate` ← passthrough (suggestion only).
- `curriculumReference` ← `action.targetCapability`, verbatim (already free-text, teacher-authored — never fabricated).

Never reads `teacherNotes`, `evidenceBasis` (so projection confidence/freshness structurally cannot leak — the mapping function never touches that field at all), `parentSupport`, `teacherAction`, or `schoolSupport`. Proven by a dedicated unit test planting private-marker strings (including a fake confidence value) in all of these and asserting none appear in the mapped output. No LLM is consulted anywhere in this mapping — pure, deterministic, teacher-overridable per field.

## 8. Bounded Compass context

Exactly the structure the task recommended, no more: `subject` (required, teacher-supplied — Blueprint has no reliable subject-key data, so this is never inferred from `target_capability`, mirroring Phase 2B's identical `subject`/`topic` decision for assignments), `objective`, `learner_instructions`, `success_indicator`, `curriculum_reference`, `review_date`, plus the provenance id (`blueprint_action_item_id` on the delivery row, and passed as `strandName` context into `compass_bridge` itself so `getNextSubject`'s existing consumers see a real curriculum anchor, not a Blueprint-internal id). No Blueprint snapshot, no evidence history, no raw Projection object is ever passed to Compass — Compass reads whatever canonical learner context it already independently reads through its own existing architecture, untouched by this phase.

## 9. Session activation behavior

No session is created, resumed, or invoked at delivery time — delivery writes exactly two things, both pure data: the `blueprint_compass_deliveries` row, and a merge into `compass_bridge` via the canonical `setTeacherSuggestedTopic()`. Teacher delivery and learner tutoring remain two structurally separate events — there is no code path in the delivery adapter capable of starting a session or calling DeepSeek, proven by a static source-scan test checking for both the import and the invocation call.

## 10. Evidence and model-call guardrails

Proven, not assumed: the happy-path integration test queries `compass_sessions` and `learner_evidence` for the delivered learner immediately after delivery and asserts zero new rows of either kind. No assignment is created either (a cross-check against Phase 2B's own table). The static-scan test additionally proves no `.from('compass_sessions')` or `.from('blueprint_compass_deliveries')` write exists anywhere outside the canonical repository, and no `streamDeepSeek(` call or `@/lib/ai/deepseek` import exists in the adapter or route.

## 11. Atomicity and recovery

Chosen approach (the task's preferred option 1): the delivery/provenance row is created **first** (an idempotent-safe insert, backed by the DB unique constraint), and only once that succeeds does the adapter call the canonical Compass objective-setter. If the Compass write somehow failed after the delivery row already exists, the system is left with a delivery row and no corresponding `compass_bridge` update — a recoverable, detectable state (the delivery row's existence is itself the record that a retry is needed), never an untraceable Compass session, since Option A never creates one. In practice `setTeacherSuggestedTopic` is a single, simple upsert with no external dependency beyond the same database already holding the delivery row, so this failure mode is a theoretical edge, not an observed one.

The one write that happens *after* both of the above is the `'delivered_to_compass'` history event — logged, not thrown, on failure (identical, deliberate choice to Phase 2B: provenance is already durable by that point, so a lost history write loses only a convenience audit entry).

## 12. Idempotency

Keyed only on `blueprint_action_item_id`, never on content matching: a fast-path existence check runs before any write; a genuine concurrent race is resolved by the database's `UNIQUE` constraint (the loser's Postgres `23505` is caught, re-thrown as a typed `ConflictError`, and resolved by re-fetching and returning the winner's row). Proven by both a sequential-retry test (asserting a second call with *different* parameters — a different subject — never overwrites the first delivery) and a real `Promise.all` concurrent test asserting exactly one delivery row exists afterward.

## 13. API surface

`POST /api/teacher/blueprint/actions/[actionItemId]/deliver-compass`

Request body: `{ confirmCompassDelivery, subject, objective?, learnerInstructions?, successIndicator?, reviewDate? }`

Response: `{ delivery, alreadyDelivered }` — `201` on first delivery, `200` on idempotent replay. No private Blueprint content (`teacherNotes`, raw `evidenceBasis`, `parentSupport`) is ever part of the `delivery` row returned, by construction (the table itself has no columns for any of them). No learner-start endpoint was added or changed — the existing Compass start flow (`app/api/learn/*`) is reused entirely unmodified, exactly as instructed.

## 14. Tests and verification results

- `lib/learnerBlueprint/actionPlan/delivery/compass.mapping.test.ts` — 8 pure unit tests, no DB.
- `lib/learnerBlueprint/actionPlan/delivery/compass.integration.test.ts` — 18 real-session, real-database tests: every lifecycle-status gate, the full authorization matrix, both validation failures, the Compass-identity precondition, the happy path (provenance, content mapping/leakage, `compass_bridge` write, `getNextSubject()` proof, history event, unchanged action status, zero session/evidence/assignment side effects), cross-learner isolation (via the real, unmodified `getNextSubject`), sequential and concurrent idempotency, and two static-ownership scans.
- `lib/learnerBlueprint/actionPlan/delivery/compass.http.integration.test.ts` — 7 tests over real HTTP: unauthenticated 401, missing-confirmation 400 (both Zod-shape and business-rule paths), not-found 404, success 201 then idempotent-replay 200, the extracted `compass-topic` route still green, and Phase 2B's assignment-delivery route still green.

All 33 new tests pass (two lib-integration test runs and one HTTP run hit this session's independently-confirmed, sustained Supabase connectivity flakiness mid-run — cleared on retry each time, see §16 for the full, honest accounting rather than a hidden number).

**Extraction parity**: `app/api/teacher/students/[studentId]/compass-topic/route.ts` now calls the canonical `setTeacherSuggestedTopic()` instead of an inline upsert — behavior verified unchanged by a real-HTTP test (`PATCH` still returns 200, `compass_bridge` still reflects the exact same merge-not-replace fields).

## 15. Static ownership inventory

- **Canonical Compass creator callers**: `getOrCreateSession()` — unchanged, called only from `app/api/learn/route.ts` and `app/api/learn/student/route.ts` (both untouched by this phase). `setTeacherSuggestedTopic()` (the newly-extracted canonical objective-setter) — exactly two callers: `app/api/teacher/students/[studentId]/compass-topic/route.ts` (ordinary route) and `lib/learnerBlueprint/actionPlan/delivery/compass.ts` (Blueprint adapter).
- **Live inserts into Compass session/objective tables**: `compass_sessions` — unchanged, one insert, `repos.compass.createSession`, called only from `getOrCreateSession`. `student_learning_context.compass_bridge` — one writer, `repos.compass.mergeTeacherSuggestedTopic`, called only from `setTeacherSuggestedTopic`.
- **Live writes to Blueprint→Compass provenance**: one, `BlueprintCompassDeliveryRepository#insert`, called only from the delivery adapter.
- **Blueprint Compass delivery entry points**: exactly one, `POST /api/teacher/blueprint/actions/[actionItemId]/deliver-compass` → `deliverBlueprintActionToCompass`.
- **History writer**: `recordDeliveryHistory` inside the same adapter file, the only caller of `repos.blueprintActionItemHistory.record` with `event_type: 'delivered_to_compass'`.
- **Model invocation paths**: unchanged — `streamDeepSeek` (`lib/ai/deepseek`) is called only from `app/api/learn/route.ts`, never from anything this phase added.

Desired end state achieved: one canonical Compass objective-setter, two authorized callers, one repository writer beneath it; no duplicate Compass writer; no Evidence writer called during delivery; no model invocation anywhere in the Blueprint delivery path.

## 16. Residual risks and infrastructure status, separated from code failures

This session's Supabase connectivity exhibited a **severe, sustained degradation window** partway through this phase's verification — not merely the earlier intermittent flake, but a period where an entire 69-test batch (Phase 2A + 2B assignment regression, none of it touched by this phase) failed instantly at `before()`, confirming an active outage rather than isolated noise. Final, honest tallies (no assertion was ever converted from failing to passing by retrying past a real logic error — every retry was of a setup/connectivity failure only):

- **Phase 2C's own 33 tests: 33/33 pass** on runs unaffected by the outage window (confirmed via multiple full, clean re-runs of all three new test files).
- **Phase 1.5/1.6 RLS** (`coreAcademicRlsHardening.integration.test.ts` + `schoolUsersRlsRegression.integration.test.ts`): **44/44 pass**, untouched by this phase.
- **Phase 1 Blueprint lifecycle** (`lifecycle.integration.test.ts` + `projections.test.ts` + `composeRecommendedNextSteps.cutover.test.ts`): settled at **38/41** across repeated runs, with a *different* test failing each time (5, 6, or 20 — never the same one twice), every failure traced to `ETIMEDOUT`/`fetch failed` mid-test, never to an assertion this phase could have broken (Phase 2C touches none of that suite's code). A clear signature of environmental noise, not a regression.
- **Phase 2A/2B assignment regression** (`lmsRoutes.http.integration.test.ts` + `create.http.integration.test.ts` + `assignment.integration.test.ts`): repeatedly degraded by the same outage window (one attempt returned 0/69 on a full `before()` cascade; a later standalone `lmsRoutes` retry reached 31/38 before a chain of dependent test-state failures). **Not re-confirmed fully clean in this session** — this is stated plainly rather than papered over. Recommended: re-run once connectivity stabilizes, independent of this phase's own sign-off; nothing in these suites' code paths was touched by Phase 2C.
- `lib/compass/compassEvidenceLoop.integration.test.ts` (pre-existing, entirely unrelated to this phase's code — it exercises the Evidence lifecycle and Behaviour Projector activation) could not be confirmed clean in this session for the identical reason. No file in its call path (`lib/compass/evidence.ts`, `lib/intelligence/evidenceLifecycle.ts`, `lib/repositories/evidence.repository.ts`) was modified by Phase 2C; only a setup-retry wrapper was added, matching this codebase's own established convention.

**Separately discovered, unrelated to Phase 2C's code**: this session's test runs (across Phase 2A/2B/2C and, apparently, prior sessions) left substantial orphaned `SYNTHETIC_`-prefixed test data in the live project — 226 schools at last count, most of it now **permanently undeletable by this project's own intentional immutability guardrails** (`blueprint_snapshots`, `teacher_reflections`, `portfolio_items`, `blueprint_action_items`, and five `learner_*` domain tables all enforce "immutable once decided/published" via database triggers that must never be bypassed, including for cleanup). 21 schools without any such guardrail-protected row were safely removed; the remaining ~205 are accumulated test debt spanning this project's history, not something this phase caused or can safely resolve — flagged as a real, separately-scoped data-hygiene item for a future decision (e.g., a synthetic-data expiry policy), not attempted further here.

## 17. Regression gate closure — 2026-07-26 (verification-only)

**Trigger**: §16 above left the Phase 2A/2B assignment regression suites "not re-confirmed fully clean" due to a sustained Supabase connectivity outage during Phase 2C's own verification. This section closes that gate.

**Connectivity this session**: clean throughout — no `ETIMEDOUT`, `fetch failed`, or Supabase Auth `429` encountered; no infrastructure retry was needed beyond the already-established bounded setup-retry wrapper (unused this run).

**Suites re-run, exact files from this doc and its Phase 2A/2B predecessors**:
- `lib/testing/lmsRoutes.http.integration.test.ts` — **38/38 pass**.
- `lib/assignments/create.http.integration.test.ts` — **9/9 pass**.
- `lib/learnerBlueprint/actionPlan/delivery/assignment.mapping.test.ts` — **6/6 pass**.
- `lib/learnerBlueprint/actionPlan/delivery/assignment.integration.test.ts` — **21/21 pass**, including the concurrent-delivery idempotency test.
- `lib/learnerBlueprint/actionPlan/delivery/assignment.http.integration.test.ts` — **6/6 pass**.
- `lib/learnerBlueprint/actionPlan/delivery/compass.http.integration.test.ts` — **7/7 pass**, used as the required Blueprint→Compass delivery smoke test; also re-confirms the extracted `compass-topic` route and the Phase 2B assignment-delivery route.
- `npx tsc --noEmit` — clean. (One infrastructure wrinkle, not a product defect: `.next/dev/types/validator.ts`, a generated file, was found torn/duplicated on disk from a prior interrupted build. It was regenerated by a clean `next dev` cycle, not hand-edited; no source file was touched.)
- `npx eslint .` — 0 errors (38 pre-existing warnings, none in Phase 2A/2B/2C paths).

**Total: 87/87 targeted tests pass.** `createAssignment()` confirmed as the sole canonical writer with exactly two callers; class-wide confirmation, submission fan-out, provenance uniqueness, and delivery idempotency all re-verified; zero Compass/Evidence writes from assignment delivery; Blueprint Compass delivery confirmed to still create only a queued objective with zero model invocation.

**Synthetic `SYNTHETIC_` schools**: untouched, per this task's explicit instruction — still an open data-hygiene item, not attempted here.

**Verdict: PASS — Phase 2C regression gate closed. GO for the next Blueprint phase.**
