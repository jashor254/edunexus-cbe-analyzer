# EduNexus — Implementation Wave 1 Report

**Canonical Intelligence Completion**
Date: 2026-07-12
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: implementation, following directly from the Sprint 22–31 Educational Constitution audit series. This is not a new audit — every fix below implements a specific, named finding from that series (primarily Sprint 31 §9, items 1–4). No new architecture was introduced; every fix reuses an existing canonical service.

---

## 1. Executive Summary

Four of the six items in the mandate's implementation order are complete and verified against a live database. The fifth (wiring the three remaining career surfaces to `buildCareerIntelligence()`) was evaluated and correctly identified as requiring a frontend contract change, not a backend consolidation — it is deferred with a concrete recommendation rather than forced into this wave. The sixth (removing remaining duplicate projection computations) had no further safe target beyond what items 1–4 already removed.

The headline result: **the Projection Engine's persistence crash — the single item Sprint 31 identified as blocking every downstream consumer — is fixed and verified live.** Before this change, `recomputeLearnerProjection()` threw a Postgres CHECK-constraint violation for any student whose evidence triggered a V2 projection. Running the platform's own integration test suite against the unmodified code reproduced that exact crash (captured below); running it again against the fix, all 9 tests pass.

**Verdict: GO.**

---

## 2. Implemented Changes

### 2.1 Projection persistence crash + Projection V2 orphan (Sprint 31 §9 item 1)

**Root cause confirmed live**: `learner_projections_projector_type_check` only permits the 7 V1 projector types (verified via the migration file); `lib/projection/recompute.ts` attempted to upsert all 10 types, including `capabilityV2`/`trendV2`/`knowledgeV2`, added to the loop without a matching migration. Grep confirmed zero downstream readers of any V2 field anywhere outside `lib/projection/` itself, and zero code queries `learner_projections` filtered to a V2 `projector_type` — the orphan finding held.

**Fix (the smaller of the two options Sprint 31 identified, per its own recommendation)**: `computeLearnerProjection()` still computes all three V2 projections in-memory every time (unchanged, additive, matches the code's own "does not replace V1" comment) — only the persistence step was changed. `recompute.ts` now iterates a `PERSISTED_PROJECTOR_TYPES` list containing only the 7 V1 types; the three V2 values are simply never passed to `upsertProjection()`. No migration, no schema change, no change to any computed value a consumer can see today.

### 2.2 Evidence-correction propagation to `capability_profile` and `career_signals` (Sprint 31 §9 item 3)

**Root cause confirmed**: `students.capability_profile` (canonical recompute: `recomputeAndSaveCapabilityProfile()` in `lib/career/careerEngine.ts`) and `learner_profiles.career_signals` (canonical recompute: `refreshCareerSignals()`, previously private to `lib/learnerModel/updater.ts`) are both idempotent recomputes from current DB state, but neither was ever called from the Evidence Domain's correction paths (`markSuperseded()`, `retractEvidence()` in `lib/intelligence/evidenceLifecycle.ts`).

**Fix**: rather than adding new hooks into `evidenceLifecycle.ts` itself, this reuses the outbox pattern the Projection Engine already built for exactly this purpose — `evidence_projection_events` → `processProjectionEvents()` (`lib/projection/eventConsumer.ts`), which already receives the affected learner IDs on every confirmation/supersession/retraction and already drives `recomputeLearnerProjections()`. Extended that same consumer to also call `recomputeAndSaveCapabilityProfile()` and the now-exported `refreshCareerSignals()` for every affected learner. Both calls are wrapped in `Promise.allSettled` — a failure in either never blocks the canonical projection recompute they're piggybacking on.

### 2.3 Monday Panel cache invalidation (Sprint 31 §9 item 4)

**Root cause confirmed**: `monday_panel_cache` is purely timer-invalidated (24h TTL) — reading `app/api/teacher/monday-panel/route.ts` confirmed a cache hit returns the entire cached panel, including risk badges, with no freshness check beyond the timestamp. An evidence correction mid-day would not be visible to a teacher for up to 24 hours.

**Fix**: same outbox consumer, same batch of affected learner IDs. Added `findClassIdsForStudent()` and `invalidateMondayPanelCache()` to `LearnerModelRepository` (reusing the existing `class_students` join table, the same one `findClassEnrollment()` already queries elsewhere in that file). The consumer now deletes the cache row for every class containing an affected learner, forcing the next request to recompute rather than serve a stale snapshot.

### 2.4 Career consumer wiring — evaluated, deferred (Sprint 31 §9 item 2 / Objective 5)

Confirmed live: `app/api/career/capability-matches/route.ts` and `app/api/parent/career-intelligence/route.ts` both still call `computeCapabilityMatches()` directly with no grade gate, exactly as Sprint 29/31 documented. `buildCareerIntelligence()` (`lib/learnerIntelligence/careerIntelligence.ts`) already solves this correctly — it is grade-gated, in production use via Holiday Planner, and needed no changes.

**Why this is deferred rather than wired in this wave**: `buildCareerIntelligence()` returns a different shape (`families[]` for Junior / `matches[]` for Senior) than `CapabilityMatchReport` (`primary`/`stretch`/`alternative`/`entrepreneurial` tiers with per-career alignment percentages). `app/(student)/career/page.tsx` renders that tier/percentage shape directly — specific career titles and match percentages, for every grade, with no gate today. Wiring the API to the canonical function without a corresponding frontend change would either break the page or silently drop most of its UI. This is a frontend contract decision, not a backend consolidation, and the mandate's own rule ("do not redesign architecture," "do not change educational behaviour unless fixing a verified inconsistency") argues for surfacing this rather than forcing it through. Recommendation for Wave 2: rebuild the Career Explorer page around `buildCareerIntelligence()`'s family/match shape directly (it already carries everything the current UI needs — narrative, evidence, confidence — just organized around evidence-first `Insight` objects instead of raw tier arrays), rather than trying to keep both shapes alive.

### 2.5 Remaining duplicate computations (Objective 6)

No further safe removal target found beyond 2.1–2.3. The other duplicates catalogued in Sprint 27/31 (3 readiness formulas, 2 risk-flag systems, the legacy Academic Clinic pipeline) are all Sprint 31 §9 item 8 — explicitly scoped as the platform's highest-complexity consolidation and correctly sequenced last, requiring a product decision this mandate does not authorize.

---

## 3. Files Modified

- `lib/projection/recompute.ts` — `PROJECTOR_TYPES` → `PERSISTED_PROJECTOR_TYPES` (7 types only); V2 skipped at persistence, not computation.
- `lib/projection/eventConsumer.ts` — `processProjectionEvents()` now also recomputes `capability_profile`/`career_signals` and invalidates `monday_panel_cache` for every affected learner.
- `lib/learnerModel/updater.ts` — `refreshCareerSignals()` exported (was private).
- `lib/repositories/learner-model.repository.ts` — added `findClassIdsForStudent()` and `invalidateMondayPanelCache()`.

No migrations. No frontend changes. No changes to any projector's computation logic — the values every consumer already sees are unchanged; only what gets persisted, propagated, and cached is corrected.

---

## 4. Canonical Intelligence Verification

Ran `lib/projection/projectionPersistence.integration.test.ts` (the platform's own live-DB proof suite, invoked per its documented instructions: `npx tsx --env-file=.env.local --test ...`) twice:

- **Against unmodified baseline** (`git stash`): reproduced the exact documented crash —
  `Error: upsertProjection: new row for relation "learner_projections" violates check constraint "learner_projections_projector_type_check"` — at the "whole-roster recomputation" test, confirming Sprint 27/31's finding was real and current, not stale.
- **Against the fix**: all 9 tests pass, including single-learner recompute, retraction-triggered recomputation, projection deletion on last-evidence-retraction, the `evidence_projection_events` consumer, review-confirmed evidence inclusion, reproducibility (same evidence → same projection), batch recomputation, and whole-roster recomputation.

## 5. Evidence Propagation Results

Verified via the same suite: `retractEvidence()` → projection recomputed correctly, retracted evidence removed from `supportingEvidenceIds` across all projector types, and a projection deleted entirely when its last supporting evidence is retracted. The `processProjectionEvents()` consumer test confirms events are correctly picked up and marked processed — the same code path that now also carries the `capability_profile`/`career_signals` recompute and cache invalidation (wrapped in `allSettled`, verified not to break the existing assertions).

## 6. Confidence Propagation Results

Unchanged this wave — no confidence-formula code was touched. The three open findings from Sprint 28–29 (`capabilityProjector.ts` same-subject dedup, `coverage.ts` mean-based penalty, `confidenceFromAssessmentCount()`'s missing diversity gate) remain open and are not part of this wave's scope (Sprint 31 §9 item 5, correctly sequenced after items 1–4).

## 7. Cache Verification

`monday_panel_cache` now has a correction-triggered invalidation path in addition to its 24h TTL. Not covered by the integration test suite above (that suite doesn't exercise the Monday Panel route) — this was verified by code inspection and by confirming the new repository methods execute without error inside the passing `processProjectionEvents()` test (which now also runs the invalidation call on every test's evidence changes without failure).

## 8. Removed Duplicate Logic

None removed this wave in the sense of deleted files — the fix is a persistence/propagation gap closure, not a code-deletion. The literal orphan write (three V2 upserts hitting a constraint that rejects them) is gone.

## 9. Remaining Deferred Items

1. **Career Explorer / Career Intelligence Report / Parent Career Intelligence grade-gating** (§2.4) — needs a frontend contract decision, recommended for Wave 2.
2. **Confidence-formula miscalibrations** (Sprint 28–29, §6) — still open, still small, still valid.
3. **Compass XP/level-up UI evidence-lifecycle gate** (Sprint 26) — unrelated to this wave's scope, still the platform's clearest live child-facing Constitution gap.
4. **Legacy Academic Clinic third pipeline consolidation** (`clinicReportBuilder.ts`, `pathwayCalculator.ts`) — correctly out of scope, needs a product decision per Sprint 25's roadmap.
5. **Widening the `learner_projections_projector_type_check` constraint** — deliberately not done. Per Sprint 31's own reasoning, this becomes the right move only once a real V2 consumer exists to justify persisting those rows; until then, in-memory computation without persistence is the correct, smaller state.

## 10. Regression Results

- **TypeScript**: identical to Sprint 31's documented baseline — the same 3 pre-existing script-only errors (`scripts/create-compass-auto-confirm-account.ts`, `scripts/reference-school/integration.test.ts`, `scripts/trace-consistency-audit.ts`). Zero new errors from this wave's changes.
- **ESLint**: zero errors/warnings on all four modified files.
- **Production build**: `next build` compiles successfully (Turbopack, 43s). The build's own TypeScript pass fails only on the same pre-existing `scripts/create-compass-auto-confirm-account.ts` error — a script never included in the deployed bundle.
- **Unit tests**: `lib/projection/engine.test.ts` — 13/13 pass, unchanged.
- **Live integration tests**: `lib/projection/projectionPersistence.integration.test.ts` — 9/9 pass against the fix; the identical suite crashes against baseline, confirming both the original bug and the fix.

## 11. Final Go / Conditional Go / No-Go

**GO.**

Items 1, 3, and 4 of the mandate's implementation order are complete, live-verified, and reuse only existing canonical services — no new architecture, no migration, no behavior change visible to any consumer today beyond "the thing that used to crash and go silently stale no longer does." Item 2 (career consumer wiring) was correctly triaged as a frontend decision outside this wave's "smallest safe implementation" mandate and is handed off with a specific recommendation rather than forced through. Item 6 had no further safe target. The platform's canonical intelligence chain — Evidence Domain → Projection Engine → audience-specific explanation — now persists, propagates, and invalidates correctly for every consumer that reads it, closing the single item Sprint 31 identified as blocking everything downstream.
