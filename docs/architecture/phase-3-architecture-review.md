# Phase 3 Architecture Review — Learner Intelligence Projection Engine

Status: Validated 2026-07-08. Recommendation below.

Depends on: [Evidence Domain Model](evidence-domain-model.md) (frozen),
[Intelligence Ingestion Engine](intelligence-ingestion-engine.md),
[Learner Intelligence Engineering Principles](learner-intelligence-engineering-principles.md),
[The EduNexus Engineering Constitution](../engineering-constitution.md).

---

## What Was Built

- **`lib/projection/types.ts`** — the shared `Projection<T>` contract (current
  value, supporting evidence IDs, confidence, coverage, last computed,
  version) and the composite `LearnerIntelligenceProjection`.
- **7 composable projectors**, each a pure function of evidence alone, no
  knowledge of each other or of any consumer: Academic (per-subject trend),
  Capability (normalized current-state level, superseding
  `capabilityExtractor.ts`'s role in principle — see Remaining Risks),
  Knowledge (subject-level current mastery snapshot), Behaviour
  (behavioural-source evidence only), Growth (holistic trajectory across
  all subjects), Risk (deterministic, rule-based flags), Completeness (a
  meta-projection about the evidence itself).
- **`engine.ts`** — pure orchestration, zero database access. This is what
  makes reproducibility a structural guarantee rather than a policy.
- **`recompute.ts` / `batch.ts` / `eventConsumer.ts`** — the persistence
  layer: upserts/deletes `learner_projections` rows to match computed
  output, batch and whole-roster recomputation with bounded concurrency,
  and the consumer for Phase 2's `evidence_projection_events` outbox
  (built in Phase 2 specifically as an unconsumed hook — now consumed).
- **`lib/repositories/projection.repository.ts`** and
  `evidence.repository.ts`'s new `findConfirmedEvidenceForLearner` — the
  exact query that defines "all confirmed educational evidence available
  today."
- **Schema**: `learner_projections` (one row per learner × projector type,
  upsertable — the deliberate, documented contrast with Evidence's
  immutability).
- **45 tests**, all passing: 27 carried over from Phase 1/2 (regression
  check, still green), 18 new — 13 pure engine tests, 5 DB-backed
  integration tests added specifically to satisfy validation items 5–7
  against real persisted data rather than relying on the pure-function
  test alone.

---

## What Was Proven

Each numbered validation item from the request, with the specific test
that proves it:

1. **Migration applied** — `learner_projections` table confirmed present
   with all 15 columns, indexes, and RLS policy.
2. **Complete integration suite** — 45/45 passing, including full Phase 2
   regression (no Evidence Domain behavior broke).
3. **Projection events trigger recomputation** — *"the projection_events
   consumer recomputes only affected learners and marks events
   processed"* — proven against a real ingestion run's emitted event.
4. **Projection persistence** — *"recomputing a learner... persists
   projections queryable independently of the computation call"* —
   proven by fetching via a separate `getPersistedProjections` call, not
   just inspecting the return value of the compute call itself.
5. **Reproducibility from Evidence alone** — proven twice: the pure
   `engine.test.ts` test (synthetic evidence, identical output) and,
   added specifically for this validation, *"recomputing the same learner
   twice from persisted Evidence produces an identical projection"*
   against real database-fetched evidence, not just in-memory fixtures.
6. **Batch recomputation** — *"batch recomputation computes projections
   for multiple learners in one call"* — 3 synthetic learners, verified
   each independently.
7. **Whole-school recomputation** — *"whole-roster recomputation
   (`recomputeForTeacher`) covers every student on the roster"* — verified
   learner count matches roster size and every learner has persisted
   output.
8. **No architectural regressions** — checked against all 10 Evidence
   Domain Model invariants and the relevant Constitution principles;
   detail below.

---

## Deviations From Design

None that weaken the spec. Three interpretive decisions worth recording,
since a future engineer should know they were decisions, not accidents:

1. **Risk Projector consumes Evidence directly, not other projectors'
   output.** The spec listed Risk alongside Academic/Growth without fully
   specifying whether cross-projector dependencies were intended. Read
   literally — "each projector consumes Evidence, produces one
   projection" — Risk was built evidence-only, duplicating a small amount
   of trend logic already in Academic Projector rather than depending on
   it. This keeps every projector independently testable and reorderable,
   at the cost of ~15 lines of duplicated trend detection. Judged
   worthwhile; flagged so it can be revisited if the duplication grows.
2. **Knowledge Projector is subject-level, not topic/strand-level.**
   Today's evidence (CSV-sourced) carries no strand/topic granularity —
   building topic-level output would mean fabricating detail the evidence
   doesn't support, which the domain model explicitly forbids ("no
   projection may exist without supporting evidence"). The shape extends
   naturally to topic-level once a source with that granularity exists.
3. **Batch/whole-roster recomputation is honestly scoped to "a few
   hundred," not "district/national."** `batch.ts`'s own comment states
   this — true higher-scale execution needs queue/worker infrastructure
   per Constitution Principle 14, deliberately not built here rather than
   overclaimed.

---

## Performance Observations

- Bounded-concurrency (20) worker pools are used for both claim-key
  prefetching (Phase 2) and batch/whole-roster recomputation (Phase 3) —
  the same pattern reused, not reinvented.
- Full suite runtime: ~33s for 45 tests, dominated by real network round
  trips (auth user creation, DB round trips) rather than computation —
  the pure engine itself computes in low single-digit milliseconds per
  learner in every test.
- No N+1 pattern was introduced: `recomputeLearnerProjection` issues one
  evidence fetch, then one upsert per non-null projector (≤7), regardless
  of evidence volume for that learner.
- Not measured, and worth flagging as unmeasured rather than assumed
  fine: behavior at evidence volumes larger than this test suite's (tens
  of evidence rows per learner). The claim-key/coverage computations are
  O(n) in evidence count per learner, which should hold up, but this is
  an assumption, not a measurement.

---

## Remaining Architectural Risks

1. **LI-1 tension, not newly introduced but not resolved.** This engine
   is now a *third* independent computation of learner capability,
   alongside `lib/career/capabilityExtractor.ts` (legacy `assessments`
   data) and `lib/learnerModel/updater.ts`'s own `capability_dimensions`
   patching (also legacy data). This was flagged explicitly before this
   phase began and remains true after it: nothing in Phase 3 touched or
   retired either legacy computation. The risk doesn't grow from having
   three instead of two, but it doesn't shrink either — this is the
   single most important unresolved item for whoever plans Phase 4's
   Blueprint migration, since that migration is what finally makes
   retiring the legacy computations possible.
2. **Test-process interruption can leave orphaned synthetic rows.**
   Discovered during this validation: an earlier test run, interrupted
   mid-execution by external Supabase connectivity loss, left 4 orphaned
   synthetic student rows (with attached projections) that its own
   `after()` cleanup never reached. Found and removed manually during this
   review — not a defect in the Evidence or Projection domain models
   themselves, but a real gap in test hygiene under process interruption.
   Worth a documented cleanup script or a `SYNTHETIC_*`-tagged sweep job
   if this becomes a recurring nuisance.
3. **Unmeasured performance at realistic evidence volume**, per above —
   not a known problem, but not a proven non-problem either.
4. **Behaviour Projector is currently dormant for every learner** (no
   behavioural evidence source is wired up yet). Correct behavior per the
   domain model, but worth remembering it's silent-by-design, not
   silently broken, the next time someone notices it's always null.

---

## Verdict

**Recommend Architecture Freeze v1.0 for Phase 3.**

Every requested validation passed against real, persisted data — not
inferred from design intent. No Evidence Domain Model invariant was
violated: the engine reads confirmed evidence only, writes exclusively to
its own new, explicitly-disposable store, and never touches
`learner_evidence` or legacy learner state. Reproducibility from Evidence
alone is proven twice, at two different levels (pure computation and
full persisted round-trip). The one real architectural debt — three
parallel capability computations — is pre-existing, explicitly named
here rather than hidden, and does not block freezing *this* engine's
correctness; it blocks calling the platform's Learner Intelligence
architecture *unified*, which was never Phase 3's job to fix.

Freezing Phase 3 means: no redesign of the Projection Engine's shape, its
persistence rules, or its projector contracts without the same review
process this document represents. Phase 4 planning (Blueprint/Compass/
Career Intelligence migration) may begin only once this freeze is
acknowledged — per the standing instruction, that planning has not
started and does not start with this document.
