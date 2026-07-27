# Blueprint Delivery Review Loop — Phase 2D

**Date:** 2026-07-26
**Scope:** Implement the final stage of the Blueprint execution cycle — the teacher's structured review of a delivered educational action, after Assignment and/or Compass delivery (Phase 2B/2C) and learner interaction have already occurred. No changes to Evidence, Projection, Assignment creation, Compass tutoring, or Blueprint generation.

---

## 1. Executive verdict

**DONE — GO for the next Blueprint phase.**

`reviewBlueprintAction()` (`lib/learnerBlueprint/actionPlan/review.ts`) is now the sole mechanism by which a teacher records a professional judgement on a delivered Blueprint action item — `Complete`, `Needs Revision`, `Reopen`, `Defer`, or `No Decision`. It gathers (never recomputes) the latest Assignment completion state, Compass session summary, learner Evidence, and Projection, and inserts one new, immutable review row per call — a review is repeatable, never overwritten. The action item's own lifecycle `status` is never mutated by review, mirroring Phase 2B/2C's "delivery is an event, not a status transition" precedent exactly. New route: `GET`/`POST /api/teacher/blueprint/actions/[actionItemId]/review`. 17 pure unit tests + 19 lib-integration tests + 6 HTTP tests, all passing against a live database and real sessions; the full pre-existing Phase 2A/2B/2C regression suites (38 + 9 + 21 + 18 = 86 tests) re-run clean.

The architectural invariant this phase exists to enforce — "the system summarizes, the teacher concludes" — is now also permanently recorded as `docs/architecture/adr-0031-educational-actions-require-human-review.md`.

## 2. Audit findings (performed before any implementation, per the task brief)

**Blueprint action lifecycle** (`lib/learnerBlueprint/actionPlan/lifecycle.ts`, `blueprint_action_items`): statuses are `proposed | edited | approved | rejected | deferred` (implemented) plus `published | completed | reviewed` (reserved in the CHECK constraint since Phase 1, never reachable from application code). A DB trigger (`enforce_blueprint_action_item_decision_immutability`) rejects **any** UPDATE once `status IN ('approved', 'rejected')` — and `approved` is the only status a delivered, reviewable item can have. This single finding drove the entire schema decision below: **a review verdict structurally cannot be written onto `blueprint_action_items` without weakening a guarantee Phase 1/2B/2C all depend on.**

**Assignment delivery** (Phase 2B): `assignments.blueprint_action_item_id` (partial-unique) is the provenance link; `repos.assignments.findByBlueprintActionItemId()` is the existing "was this delivered" read. No existing function summarized *completion* of one assignment (`lib/gradebook/gradebook.ts`'s `buildGradebook` is class-scoped and needs a `teacherId` this phase doesn't naturally have) — a new, narrow, read-only method was needed.

**Compass delivery** (Phase 2C): `blueprint_compass_deliveries` (unique on `blueprint_action_item_id`) is the provenance link; its own `status` column (`available|started|completed|expired`) is reserved and never written by Phase 2C code — Compass's *real* session state lives in `compass_sessions`, which Blueprint has never read before this phase. No existing summarizer counted sessions for a learner+subject; a new, narrow, read-only method was needed.

**learner_evidence**: per CLAUDE.md, evidence must be read via canonical paths only. `lib/learnerRecord/timeline.ts`'s `getLearnerTimeline(studentId)` already merges confirmed/superseded/retracted Evidence with promotion history into one chronological sequence — reused directly, filtered to `kind: 'evidence'` entries, never reimplemented.

**learner_projections**: `lib/projection/recompute.ts` exposes two paths — `recomputeLearnerProjection()` (has a write side effect: it upserts `learner_projections`) and `getPersistedProjections()` (a pure read of `repos.projections.findProjectionsForLearner()`). Review uses **only** the latter — using the former would itself violate "review must never compute projections."

**Previous review history**: no prior art — this is Phase 2D's own new concept, and it needed a genuinely new table (see §4).

## 3. Where review lives, and why

`lib/learnerBlueprint/actionPlan/review.ts` — a sibling of `lifecycle.ts` and `delivery/{assignment,compass}.ts` in the same domain module, not a new top-level module. It:

- Is the only file that imports `BlueprintActionReviewRepository`.
- Never imports an Evidence writer (`persistEvidenceBatch`, `confirmReview`, `rejectReview`, `retractEvidence`, `eraseEvidence`), a Projection writer (`recomputeLearnerProjection`, `upsertProjection`), a Compass session/objective writer (`setTeacherSuggestedTopic`, `getOrCreateSession`, `createSession`), or the DeepSeek client — proven by a static source scan, not just code review (`review.mapping.test.ts`).
- Contains zero `.from(<table>).insert/update/upsert/delete(...)` calls of its own — every write goes through `repos.blueprintActionReviews.insert()` (the new repository) or `repos.blueprintActionItemHistory.record()` (the pre-existing, already-append-only history writer).

## 4. Canonical review service

```
lib/learnerBlueprint/actionPlan/review.ts
  getBlueprintActionReviewSnapshot(client, actionItemId): Promise<BlueprintActionReviewSnapshot>
  reviewBlueprintAction(client, actionItemId, command): Promise<ReviewBlueprintActionResult>

lib/repositories/blueprintActionReview.repository.ts
  BlueprintActionReviewRepository
    insert(input): Promise<BlueprintActionReviewRow>
    listForActionItem(actionItemId): Promise<BlueprintActionReviewRow[]>   // newest first
```

`getBlueprintActionReviewSnapshot()` is the read-only half — safe to call as often as needed (e.g. to render the review screen before a teacher decides) and used both by the new `GET` route and internally by `reviewBlueprintAction()`, so there is exactly one snapshot-gathering code path, never two. `reviewBlueprintAction()` calls it, then inserts one review row on top — **the only place in the codebase allowed to finalize a Blueprint action's review state.** No route updates review state directly; both routes call into this module only.

**Schema decision — a new, dedicated, append-only table, not a column on `blueprint_action_items`:**

1. **Structurally forced**, not merely preferred (see §2) — the immutability trigger makes writing onto the action item impossible for any `approved` row without weakening that guarantee.
2. **A review is repeatable, not a one-time transition.** A teacher may review the same action item more than once (after further Compass sessions, a resubmission, a "Reopen" cycle). `blueprint_action_reviews` has **no** uniqueness constraint on `blueprint_action_item_id` — unlike `blueprint_compass_deliveries`, every review is a new row; "the latest review" is `ORDER BY created_at DESC LIMIT 1`, never an update to a prior one.

Migration: `supabase/migrations/20260726100000_blueprint_action_review.sql`, applied to the live project (verified via `mcp__supabase__execute_sql`: table, indexes, RLS policy, both immutability triggers, and the widened `blueprint_action_item_history.event_type` CHECK all confirmed present post-apply). Purely additive — no existing `blueprint_action_items`, `assignments`, `compass_sessions`, or `blueprint_action_item_history` row was altered.

## 5. Authorization model

Identical shape to Phase 2B/2C's own gate — one check, reused, never a second weaker one: `canManageLearnerRecordCore(client, action.school_id, action.learner_id)` (`lib/core/permissions.ts`). Denies parent, the learner themself, an unrelated same-school teacher, a cross-school teacher — the same matrix already proven for delivery. `UnauthorizedError` (401) for no session; `ResourceOwnershipError` (403) for the authority failure; `NotFoundError` (404) for an unknown action item id; `ConflictError` (409) for a non-`approved` status or an action that has never been delivered to Assignment or Compass.

No separate class-authority check was added: unlike assignment *delivery* (which creates a new class-wide artifact and therefore needs `requireClassTeacher`), review only *reads* Assignment/Compass state already gated by delivery's own authorization — the learner-authority check alone is sufficient here, and adding a redundant second check would only reject a legitimate reviewer with no additional safety benefit.

## 6. Lifecycle changes

**None to `blueprint_action_items` itself.** `status` remains `approved` through every review, every decision, every reopen — exactly as Phase 2B/2C left it unchanged through delivery. A review verdict is recorded as a fact about what a teacher observed and decided, never a mutation of the original decision record. This was verified directly: `repos.blueprintActionItems.findById(actionId)` is re-fetched and asserted `status === 'approved'` after every review-decision test in `review.integration.test.ts`, including immediately after a `'complete'` verdict.

## 7. History model

`blueprint_action_item_history.event_type` was widened a third time (Phase 1 → Phase 2B `'delivered'` → Phase 2C `'delivered_to_compass'` → Phase 2D, this migration) to admit five new, purely additive values, one per decision — a clean 1:1 mapping:

| Decision | History event |
|---|---|
| `complete` | `review_completed` |
| `needs_revision` | `review_revision_requested` |
| `reopen` | `review_reopened` |
| `defer` | `review_deferred` |
| `no_decision` | `review_no_decision` |

Deliberately **not** using a separate `review_started` event (an example in the task brief's illustrative list, not a requirement): `reviewBlueprintAction()` is a single atomic operation, never a two-step "open then decide" flow, so there is no distinct moment for a "started" event to represent. `resulting_status` on every review history row equals `previous_status` (both `'approved'`) — proven by `review.integration.test.ts`'s history test.

`blueprint_action_reviews` rows are immutable at the database level — `enforce_blueprint_action_reviews_immutability` rejects **any** UPDATE or DELETE, unconditionally, even from the service-role client, mirroring `blueprint_action_item_history`'s own trigger exactly. Proven directly: `review.integration.test.ts`'s "a review row itself is immutable" test attempts both an UPDATE and a DELETE via the service-role client and asserts both are rejected.

## 8. Review snapshot model

```ts
type BlueprintActionReviewSnapshot = {
  actionItem: BlueprintActionItemRow
  assignment: { delivered: false } | { delivered: true, assignmentId, status, completionLabel, total, pending, submitted, marked, averageScore }
  compass: { delivered: false } | { delivered: true, deliveryId, subject, sessionCount, activeCount, completedCount, abandonedCount, lastActivityAt }
  evidence: { count, latestAt, latestSummary }
  projection: { projections: [{ projectorType, confidence, freshnessDays, lastComputed }], trend }
  previousReviews: BlueprintActionReviewRow[]
  latestDecision: ReviewDecision | 'awaiting_review'
}
```

`completionLabel` (`no_roster | not_started | in_progress | completed`) and `projection.trend` (`increased | decreased | unchanged | no_prior_review | no_projection`) are the only two derived values in the whole snapshot, and both are deterministic renderings of already-computed numbers, never a new judgement:

- `completionLabel` is a pure function of submission-status counts already read from `assignment_submissions` (`review.mapping.test.ts`'s `summarizeAssignment` tests cover all four labels).
- `trend` compares the current persisted Projection confidence for the "primary" projector (highest `evidence_count`) against the confidence recorded in the **previous review's own stored snapshot** — a diff of two already-computed numbers, never a recomputation, and only ever produced when a prior review exists to compare against (`review.mapping.test.ts`'s `deriveProjectionTrend` tests cover all five outcomes, including the "no matching projector in the prior snapshot" case, which correctly falls back to `no_prior_review` rather than fabricating a trend).

## 9. Evidence guardrail

Review never writes evidence — only `getLearnerTimeline()` is called, a pre-existing read-only merge. Proven by `review.integration.test.ts`'s dedicated test: `learner_evidence` row count for the learner is identical before and after a `reviewBlueprintAction()` call.

## 10. Projection guardrail

Review never computes projections — only `getPersistedProjections()` is called (a plain `repos.projections.findProjectionsForLearner()` read), never `recomputeLearnerProjection()`. Proven both statically (`review.mapping.test.ts` scans the import list for `recomputeLearnerProjection`/`upsertProjection` and asserts neither is imported) and behaviorally (`review.integration.test.ts`: `learner_projections` rows, including `last_computed`, are byte-identical before and after a review call).

## 11. Assignment / Compass guardrails

Review never mutates `assignments`, `assignment_submissions`, or `compass_sessions` — proven behaviorally in `review.integration.test.ts` (full-row `deepEqual` comparisons before/after a `reviewBlueprintAction()` call for all three) and statically (no `.from('assignments')`/`.from('assignment_submissions')`/`.from('compass_sessions')` write pattern exists anywhere in `review.ts`).

## 12. Automatic completion is forbidden — how this is actually true, not just asserted

Nothing in this phase (or anywhere else in the codebase) can set a review decision except an explicit `reviewBlueprintAction()` call with a teacher-supplied `decision`. This was proven, not assumed, by driving the exact scenarios the task brief named:

- **Assignment completion alone does not complete the action** — every `assignment_submissions` row for a delivered assignment was marked `'marked'` directly; the snapshot's `completionLabel` correctly read `'completed'`, but `latestDecision` remained `'awaiting_review'` and the action item's own `status` stayed `'approved'`.
- **Compass completion alone does not complete the action** — a `compass_sessions` row was inserted directly with `status: 'completed'`; the snapshot correctly reflected it, but nothing advanced the review state.
- **New evidence alone does not complete the action** — two real `learner_evidence` rows were persisted via `persistEvidenceBatch`; the snapshot's `evidence.latestSummary` correctly reflected the newer, higher-scoring entry, but review state was untouched.
- **New projection alone does not complete the action** — `recomputeLearnerProjection()` was run for real (the actual engine, not a stub); the snapshot's projection entries matched the freshly-persisted `learner_projections` rows exactly, but review state was untouched.

Only the subsequent, explicit `reviewBlueprintAction(client, actionId, { decision: 'complete' })` call changed `latestDecision` — and even then, never `blueprint_action_items.status` itself (§6).

This is also the operative case behind ADR-0031 (`docs/architecture/adr-0031-educational-actions-require-human-review.md`), written and accepted in this same phase — the general, permanent version of the rule this section proves for the specific Blueprint case.

## 13. Files changed

**New:**
- `supabase/migrations/20260726100000_blueprint_action_review.sql`
- `lib/repositories/blueprintActionReview.repository.ts`
- `lib/learnerBlueprint/actionPlan/review.ts`
- `lib/learnerBlueprint/actionPlan/review.mapping.test.ts` (17 tests, including 3 static guardrail scans)
- `lib/learnerBlueprint/actionPlan/review.integration.test.ts` (19 tests)
- `lib/learnerBlueprint/actionPlan/review.http.integration.test.ts` (6 tests)
- `app/api/teacher/blueprint/actions/[actionItemId]/review/route.ts` (GET + POST)
- `docs/architecture/adr-0031-educational-actions-require-human-review.md`
- `docs/architecture/blueprint-review-loop-phase2d.md` (this document)

**Modified (additive only — no existing behavior changed):**
- `lib/repositories/index.ts` — registered `blueprintActionReviews`.
- `lib/repositories/blueprintActionItemHistory.repository.ts` — widened `BlueprintActionHistoryEventType` with the five review event types.
- `lib/repositories/assignment.repository.ts` — added `getSubmissionSummary()`, a new read-only method; no existing method touched.
- `lib/repositories/compass.repository.ts` — added `summarizeSessionsForSubject()`, a new read-only method; no existing method touched.
- `docs/architecture/blueprint-living-action-plan-audit.md` — Phase 2D entry added to the implementation plan.
- `docs/engineering/implementation-log.md` — new entry.

**Untouched, as required:** `lib/intelligence/evidenceLifecycle.ts`, `lib/projection/recompute.ts` / `engine.ts`, `lib/assignments/create.ts`, `lib/compass/session.ts` / `objective.ts`, every Blueprint composer (`lib/learnerBlueprint/compose*.ts`), and Phase 2B/2C's own delivery adapters — confirmed both by `git diff` scope and by the static import scan in `review.mapping.test.ts`.

## 14. Migrations

One: `supabase/migrations/20260726100000_blueprint_action_review.sql` — creates `blueprint_action_reviews` (RLS enabled, staff-read-only policy, two unconditional immutability triggers, three indexes) and widens `blueprint_action_item_history.event_type`'s CHECK constraint. Applied to the live project via `mcp__supabase__apply_migration`; verified post-apply via direct SQL inspection of `information_schema.columns` and `pg_constraint`.

## 15. Test results

| Suite | Result |
|---|---|
| `review.mapping.test.ts` (pure + static scans) | 17/17 |
| `review.integration.test.ts` (real session, real DB) | 19/19 |
| `review.http.integration.test.ts` (real HTTP) | 6/6 |
| **Phase 2D total** | **42/42** |
| `lib/testing/lmsRoutes.http.integration.test.ts` (Phase 2A regression) | 38/38 |
| `lib/assignments/create.http.integration.test.ts` (Phase 2A regression) | 9/9 |
| `lib/learnerBlueprint/actionPlan/delivery/assignment.integration.test.ts` (Phase 2B regression) | 21/21 |
| `lib/learnerBlueprint/actionPlan/delivery/compass.integration.test.ts` (Phase 2C regression) | 18/18 |
| `npx tsc --noEmit` | clean |
| `npx eslint .` (targeted + full-repo baseline unchanged) | 0 errors |

No connectivity issues this session — no `ETIMEDOUT`/`fetch failed`/`429` encountered; no infrastructure retry was needed.

## 16. Residual risks and deferred work

- **No UI was built.** Both routes exist and are fully tested over real HTTP; nothing in the Teacher Workspace calls them yet — matching Phase 2B/2C's own "route exists, nothing calls it yet outside tests" precedent.
- **`blueprint_action_items.status` never reaches `'completed'`/`'reviewed'`** (still-reserved CHECK values from Phase 1). This phase deliberately did not wire a derived "the action item itself looks done" status, for the exact reason in §2/§4 — doing so would require either weakening the decision-immutability trigger or inventing a second, parallel completion concept. If a future phase wants a single-glance "is this item done" list view, it should compute that by reading `blueprintActionReviews.listForActionItem()`'s latest decision at query time, not by adding a write path onto the frozen action item row.
- **`projection.trend` only ever compares against the immediately preceding review**, not a longer trend line — a deliberate minimal scope (comparing two numbers, never inventing a multi-point trend algorithm this phase wasn't asked to build).
- **Synthetic test data**: `review.integration.test.ts`/`review.http.integration.test.ts` create their own `blueprint_action_items` and `blueprint_action_reviews` rows, both immutable once `approved`/inserted — these are left as accepted test debt in `after()`, identical to every prior Blueprint phase's own integration tests (none of them delete `blueprint_action_items` or `blueprint_action_item_history` either). This adds to, but does not create, the pre-existing `SYNTHETIC_`-data-hygiene item tracked since Phase 2C — still not attempted here, per this phase's own scope.

## 17. GO / NO-GO

**GO.** The review loop closes the Blueprint execution cycle exactly as specified — Evidence → Projection → Blueprint → Teacher Approval → Blueprint Action → Delivery → Learner Interaction → New Evidence → Teacher Review — with the "system summarizes, teacher concludes" invariant proven, not merely asserted, and now permanently codified in ADR-0031.

## 18. Update — 2026-07-26: Phase 2E built the UI over this service

§16's "No UI was built" residual risk is now addressed by Phase 2E (`docs/architecture/blueprint-teacher-review-workspace-phase2e.md`) — a learner-scoped Teacher Review Workspace (`/teacher/learners/[learnerId]/blueprint/review`) consuming `getBlueprintActionReviewSnapshot()` and `reviewBlueprintAction()` exactly as designed here, through no new writer. `getBlueprintActionReviewSnapshot()` gained no new callers beyond what this document already listed (the route, and internally `reviewBlueprintAction()`) — the UI reaches it only through the existing route. `reviewBlueprintAction()` likewise remains single-callered (the same route). Everything else in this document — the schema, the guardrails, the five-decision vocabulary, the append-only history — is unchanged by Phase 2E.
