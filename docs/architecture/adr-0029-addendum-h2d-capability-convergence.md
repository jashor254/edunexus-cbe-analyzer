# ADR-0029 Addendum — H2D Capability & Trend Convergence

**Depends on**: ADR-0029 (Canonical Learner Intelligence Architecture). This document does not revisit ADR-0029's constitution — it closes two specific, real gaps ADR-0029 itself named as deferred, and rules on one new question (trend vocabulary) ADR-0029 did not cover.

**Scope**: Decision A (canonical capability source for teacher-facing surfaces) and Decision B (trend semantics). Narrowly scoped per the H2D assurance phase's hard lock — no Career/Blueprint/Compass redesign, no pathway/KJSEA changes, no historical backfill, no database migration.

---

## Decision A — Canonical Capability Source

### The gap this closes

ADR-0029 §3.3 already ruled: *"`capability_dimensions` (6-dimension)... Owned by `capabilityExtractor.ts` (via the Projection-adapted shim for its approved callers), **not** by this raw `learner_profiles` field, which is a separately-maintained legacy copy the ledger already flags as untouched/deferred."*

That ruling was correct but not yet acted on for two real, user-facing readers:

- `app/api/teacher/monday-panel/route.ts` — read `learner_profiles.capability_dimensions` directly (twice: once building a lookup map, once inline in peer-pairing comparison).
- `lib/attentionFeed/panel.ts`'s `detectAccelerationCandidates()` — read the same raw column directly, with its own header comment explaining the gap as deliberate (ADR-0029, "no 6-dimension breakdown in Projection").

That raw column is written by `lib/learnerModel/updater.ts`'s `updateFromAssessment()`, which calls `computeCapabilityProfile()` — a read of the legacy `assessments` table with **no admissibility/correction lifecycle at all**. H2C (`INTEL-LEGACY-001`) proved this can produce a materially different capability level than the canonical, evidence-admissible path for the identical learner at the identical moment.

### Options considered

- **A1 — Projection/`learner_evidence` becomes canonical.** Chosen, narrowly.
- **A2 — `assessments` gains its own correction/admissibility lifecycle.** Rejected for this phase: out of the hard scope lock ("do not invent assessment correction semantics"), and the coverage audit (below) shows the `assessments` table is not close to being retired as a data source, so building a parallel lifecycle for it now would create a second correction system to maintain indefinitely.
- **A3 — Both remain intentionally separate but explicitly labeled.** Rejected as the primary answer for *teacher-facing current-state display* — ADR-0029 already named `capabilityExtractor.ts`'s Projection-adapted output as the owner; there is no legitimate reason for Monday Panel/Attention Feed to show a different "current capability" than Career Intelligence for the same learner. (A3 *is* the answer for Decision B — see below — because trend genuinely is two different questions; capability level is not.)

### Assessment → Evidence coverage (audited, not inferred)

**PARTIALLY BRIDGED.**

| Writer | Bridges to `learner_evidence`? |
|---|---|
| `app/dashboard/assessments/add/page.tsx` (both CBC and IGCSE insert sites) | Yes, indirectly — via `processAssessment()` → `POST /api/parent/assessments/process` → `recordReportCardAssessmentEvidence()`. Two silent-failure points (client-side fetch failure is logged, non-fatal; server-side write is fire-and-forget) — real but pre-existing risk, not introduced or fixed here. |
| `app/api/teacher/assessments/process/route.ts` (the trigger for `updateFromAssessment`) | Yes, same request also calls `recordReportCardAssessmentEvidence` |
| `app/api/assessments/create/route.ts` | **No** — confirmed by the function's own governing comment ("does not yet emit an Evidence Domain row"). Currently unreferenced in the UI (no caller found), so not a live risk to this decision today, but a real gap if it is ever wired up. |

**Because coverage is partial, Decision A is implemented as forward-only read-side convergence, not a claim that the legacy path is retired.** Per the H2D brief's own guidance (§9), the correct response to incomplete coverage is writer convergence *before* changing readers if the readers cannot tolerate the gap — but here, the readers (Monday Panel, Attention Feed) can tolerate it: a learner whose only capability signal exists in `assessments` and never made it to `learner_evidence` will now show "no capability data yet" instead of a legacy number, which is the *correct* behavior per the Evidence-First Mandate (missing evidence is not negative evidence, never fabricate), not a regression to route around.

### What changed

Both `app/api/teacher/monday-panel/route.ts` and `lib/attentionFeed/panel.ts` now derive capability via one shared function, `lib/learnerIntelligence/canonicalCapability.ts`'s `canonicalCapabilityFor(projection)` — the same `extractCapabilityProfile()` formula every other canonical consumer (Career Intelligence) already uses, fed via the same sanctioned Projection adapter (`projectionToScoreHistory`). Both surfaces already recompute `LearnerIntelligenceProjection` per student in the same request (for risk data) — this reuses that in-memory value, so the change is **read-side only, zero extra database cost, no new recompute**.

### What did NOT change

- `lib/learnerModel/updater.ts`'s `updateFromAssessment()` — still writes `learner_profiles.capability_dimensions`/`capability_history` from the legacy `assessments`-table path. Not touched: out of scope, and `capability_history` still backs `/api/career/growth`'s trend view (a different, still-legitimate consumer).
- The `assessments` table itself — not migrated, not given new lifecycle columns, not deleted.
- `app/api/assessments/create/route.ts` — the one confirmed non-bridged writer. Flagged, not fixed (currently unreferenced in the UI).

### `learner_profiles.capability_dimensions` / `capability_history` — final classification

**LEGACY COMPATIBILITY.** Not canonical, not deleted, not purged. Still written (by `updateFromAssessment`), still has at least one legitimate remaining reader (`capability_history` for `/api/career/growth`'s trend view — not audited further in this phase), but no longer read by any surface that claims to show a learner's *current* capability to a teacher.

---

## Decision B — Trend Semantics

### The landscape (fuller than the two-algorithm framing)

A global trace found **seven** independent trend computations, not two:

1. `academicProjector.computeTrend` (Projection v1) — first-vs-last
2. `capabilityV2Projector.computeTrend` (Projection v2, unused by any live consumer)
3. `growthProjector`'s aggregate trend — rolls up per-subject trends
4. `trendProjector` (Projection v2) — richer vocabulary (`recovering`/`momentum`/`plateau`/`regression`), also unused
5. `capabilityExtractor.detectTrend` — first-half vs second-half average
6. A **SQL-persisted** trend (`substrand_health.trend`, `20260628_eios_foundation.sql`) — a class/lesson-level signal, ADR-0029 §3.8 already ruled this is a *different concept* ("how did this lesson go," not a learner trend) and scoped it out of any convergence
7. `lib/adaptiveLearning.ts`'s `calculateLearningVelocity` — dead code, zero callers

Of these, only #1 and #5 are the pair H2C proved actually disagree on identical input for the identical educational question teachers/Career see. #6 is already correctly scoped as unrelated by ADR-0029. #2, #4, #7 have no live consumers and are out of scope. #3 is a rollup of #1, not an independent concept.

### Options considered

- **B1 — one universal trend algorithm.** Rejected. Evaluated against 8 representative histories (see below): the two algorithms answer genuinely different, both-legitimate educational questions. Collapsing them would delete a real signal (momentum), not just resolve a naming collision.
- **B2 — keep both, name them differently.** **Chosen.**
- **B3 — one canonical trend plus a secondary signal.** Considered and rejected as a false economy: it would still require picking one algorithm as "primary," reintroducing exactly the "which one is really the trend" ambiguity B2 avoids by naming both as first-class, differently-scoped concepts.

### Representative histories (both algorithms compared)

| History | netTrend (`computeTrend`, first vs last) | momentumTrend (`detectTrend`, half-avg) | Question each answers |
|---|---|---|---|
| 1 → 2 → 3 | improving | growing | Net: yes. Momentum: yes — both agree here. |
| 3 → 2 → 1 | declining | declining | Both agree. |
| 1 → 4 → 1 | **stable** | **accelerating** | Net: no change. Momentum: recent half stronger. **The proven divergence.** |
| 4 → 1 → 4 | **stable** | **accelerating** (symmetric case) | Same shape as above, mirrored. |
| 2 → 2 → 2 | stable | stable | Both agree — no information either way. |
| 1 → 1 → 3 | improving | growing/accelerating (weight-dependent) | Both agree on direction, may differ on strength label. |
| 4 → 4 → 3 | declining | stable/declining (weight-dependent) | Broadly consistent. |
| 1 → 3 → 3 | improving | stable-to-growing | Broadly consistent — the "already arrived, holding" case. |

The divergence is concentrated exactly where H2C found it: histories with a **mid-series extremum that returns near the start**. Everywhere else, the two algorithms substantively agree.

### The names

- **netTrend** — Projection's `computeTrend()`: *"What is the learner's net change from their earliest to their latest confirmed evidence?"* Answers "did they end up better or worse than where they started."
- **momentumTrend** — capabilityExtractor's `detectTrend()`: *"Is the learner's recent half of history stronger or weaker than their earlier half?"* Answers "what direction are they moving in right now," independent of where they started.

Both are correct, real, useful signals. A learner can legitimately be `netTrend: stable` (no overall change) and `momentumTrend: accelerating` (currently on an upswing) at once — this is not a contradiction to resolve, it's two different questions with two different true answers.

### Why no rename, no migration

`trend` is:
- **Persisted** inside `learner_profiles.capability_dimensions`'s JSONB shape (per-dimension), read directly by `attentionFeed/panel.ts` (now via `canonicalCapabilityFor`, see Decision A) and `lib/learnerModel/updater.ts`.
- Rendered as literal UI text in exactly one place: `app/dashboard/clinic/reports/[studentId]/page.tsx:302` (`Trend: {subject.trend}`) — reading Projection's `academicProjector` value (netTrend), unaffected by this decision.
- Otherwise rendered only as icons/arrows keyed on the enum value, not literal text.

Renaming the field itself (`trend` → `netTrend`/`momentumTrend`) would touch a persisted JSONB shape with no schema enforcement and no migration mechanism, plus a SQL-persisted, unrelated `substrand_health.trend` column. Per the hard scope lock ("prefer NO DATABASE CHANGE... no migration purely to rename a computed trend concept if code/API changes are sufficient"), this addendum implements Decision B as a **documentation-and-code-comment-level convergence**: both `computeTrend()` and `detectTrend()` now carry explicit JSDoc naming and cross-referencing the netTrend/momentumTrend distinction, and this document is the canonical vocabulary reference. **No field, column, or JSON key was renamed.** A future phase may choose to do the actual rename with a proper migration if the vocabulary proves worth enforcing in the type system — not scheduled here.

### INTEL-TREND-001 (updated)

H2C's test now asserts the *accepted* shape of the 1→4→1 fixture — `bpMath.trend === 'stable'` (netTrend) and `careerProfile.analytical_reasoning.trend === 'accelerating'` (momentumTrend) both hold, and the test documents why disagreeing is correct rather than treating it as an open finding.

---

## Invariants

- **INTEL-CAP-001** — every user-facing learner capability conclusion (Monday Panel, Attention Feed) must derive from the canonical admissibility-aware intelligence state. Proven in `lib/learnerIntelligence/canonicalCapability.integration.test.ts` against the real function both surfaces call: a conflicting legacy `assessments` row cannot leak through, retracted evidence cannot leak through, zero evidence produces no fabricated profile.
- **INTEL-TREND-001** (updated from H2C) — no surface may claim netTrend and momentumTrend are the same concept or that either is a "corrected" version of the other. Proven in `lib/intelligence/crossSurfaceConsistency.integration.test.ts`.

---

## Backfill decision

**NO BACKFILL REQUIRED. Forward-only convergence.** Historical `assessments` rows with no `learner_evidence` counterpart are not migrated. Learners affected will show sparse/no capability data on Monday Panel/Attention Feed going forward where they previously showed a legacy-cache number — this is the intended, correct behavior (real absence of admissible evidence, not withheld data), not a defect.

## Database impact

**NONE.** No migration, no schema change, no new column, no backfill.
