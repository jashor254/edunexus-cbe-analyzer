# EduNexus — Educational Intelligence Convergence Report

**Sprint 31 — Educational Intelligence Convergence**
Date: 2026-07-12
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: audit-only, no code changed. This is the capstone of the Sprint 24–30 audit series — it does not re-derive findings, it converges them into one final map, verifies nothing has drifted, closes the one remaining open question (orphan computations, Objective 11), and states the platform's overall convergence state plainly. Governed by both the Educational Constitution ([[Sprint 25]]) and the Educational Development Framework ([[Sprint 30]]).

**Baseline re-verified before writing this report**: none of the fixes recommended in Sprints 27–30 have been applied yet. The `learner_projections_projector_type_check` constraint still only permits the 7 V1 projector types (confirmed live, `pg_get_constraintdef`). `app/api/career/capability-matches/route.ts` and `app/api/parent/career-intelligence/route.ts` both still import and call `computeCapabilityMatches` directly, not `buildCareerIntelligence`. This report describes the platform exactly as Sprint 30 left it, plus one newly-found orphan (§8).

---

## 1. Executive Summary

Seven sprints of increasingly rigorous verification (22 through 30) converge on a consistent, coherent picture: **EduNexus's canonical intelligence design — Evidence Domain → Projection Engine → audience-specific explanation — is sound, and every genuine gap found is a specific, named, small-blast-radius deviation from it, not a design flaw.** No sprint in this series ever found a case where the *architecture* needed to change. Every fix identified across seven sprints is a threshold adjustment, a missing field, a stale-cache invalidation, or — most often — reusing a module that already exists correctly elsewhere. This sprint's job was to confirm that convergence claim holds under one more pass and to state, once and for all, exactly what remains.

Four items block full convergence, ranked by what actually reaches a real user today:

1. **The Projection Engine's persistence layer still throws for real students** (Sprint 27) — this is the only item in the whole series that produces *no* output rather than a wrong one, and it is upstream of everything else.
2. **Three career-facing surfaces still bypass the correctly-built `buildCareerIntelligence()` module** (Sprints 29–30) — the fix exists, is proven correct by its use in Holiday Planner, and is simply not wired to the Career Explorer, the Parent Career Intelligence panel, or the Career Intelligence Report.
3. **Two evidence-correction propagation gaps** (Parent Pulse's persisted `career_signals`, Monday Panel's timer-only cache — Sprint 30) mean a small number of surfaces can serve stale conclusions after a correction, though never a wrong-category conclusion.
4. **A newly-found orphan**: the Projection V2 layer (`capabilityV2`/`trendV2`/`knowledgeV2`) computes and attempts to persist three additional projections on every recompute, and nothing downstream reads any of them — and this orphan is the *literal cause* of finding #1's crash, since the CHECK constraint that blocks persistence exists specifically because these three types were added without a matching migration. Fixing #1 and #4 together may have a smaller, safer answer than Sprint 27 originally proposed (§9).

**Verdict: CONDITIONAL GO**, unchanged in substance from Sprint 30, now with a complete and final list — detail in §12.

---

## 2. Canonical Intelligence Map

Unchanged from Sprint 27's map, re-confirmed this sprint:

| Layer | Status |
|---|---|
| Evidence Domain | Canonical, uncontested, confirmed clean of SOW/lesson-plan/RoW contamination (Sprint 28) |
| Projection Engine (V1: academic/capability/knowledge/behaviour/growth/risk/completeness) | Canonical computation logic confirmed correct; **persistence broken for any student whose evidence also triggers a V2 projection** (Sprint 27, unresolved) |
| Projection Engine (V2: capabilityV2/trendV2/knowledgeV2) | Computed correctly, additive-by-design, **fully orphaned — zero downstream readers** (new, §8) |
| `buildCareerIntelligence()` | Canonical, correctly grade-gated, proven in production use (Holiday Planner) — **under-adopted**, not a design gap |
| Blueprint, Holiday Planner (excl. career note gating), Adaptive Learning | Fully canonical, uncontested across all seven sprints |
| `clinicReportBuilder.ts`, legacy `pathwayCalculator.ts`, legacy `academicClinic/` pipeline | Confirmed still live, still independent, still the platform's oldest and largest duplicate-truth surface (Sprint 24, 27) |

## 3. Consumer Convergence Audit (Objective 1, 2, 3)

Every subsystem named in this sprint's Objective 3, cross-referenced against the full audit series:

| Consumer | Derives from canonical chain? | Source |
|---|---|---|
| Blueprint | Yes | Sprints 24, 26–28 |
| Career Explorer | **No** — ungated `computeCapabilityMatches()` | Sprints 29–30 |
| Career Intelligence Report | **No** — same function, self-contradictory prompt | Sprint 30 |
| Parent Career Intelligence | **No** — same function | Sprint 30 |
| Holiday Planner | Yes, including its career note (correctly gated via `buildCareerIntelligence()`) | Sprints 26–28, 30 |
| Parent Pulse | Yes for academic/risk content; **No** for its career line specifically (persisted `career_signals`) | Sprints 26, 30 |
| Monday Panel | **Split** — risk badge canonical, flag-detail text legacy Learner Model, both discarding confidence/evidence IDs before response; cache is timer-only | Sprints 24, 26, 30 |
| Progress / Reports | **No** — `clinicReportBuilder.ts`/`pathwayCalculator.ts` remain a fully independent third pipeline | Sprints 24, 27 |
| Compass | Durable evidence chain: Yes. Immediate XP/level-up UI: **No** — bypasses evidence review entirely | Sprint 26–27 |
| Adaptive Learning | Yes — the series' reference implementation, unchanged across every sprint that checked it | Sprints 26–29 |

Six of ten consumers are fully canonical. Four have a specific, named gap — none of the four gaps require new architecture to close.

## 4. Developmental Consistency Matrix (Objectives 4, 5, 6)

| Requirement | Status |
|---|---|
| Junior School never receives occupation-first guidance (Objective 5) | **Violated** on 3 of 13 career consumers (Sprint 30 census) — Career Explorer, Parent Career Intelligence, Career Intelligence Report |
| Senior School progressively increases specificity using existing rules (Objective 6) | Held where `buildCareerIntelligence()`/`clinicReportBuilder.ts`/`reportGenerator.ts` are the source (their Senior paths are genuinely graduated); **not tested** where the ungated function is the source, since it has no developmental staging at all to progress through |
| Developmental stage respected consistently platform-wide (Objective 4) | **Not consistent** — 2 of 10 subsystems checked in Sprint 30 (the legacy Academic Clinic report generator and `buildCareerIntelligence()`) vary tone by grade; the other 8 use grade only for data filtering |

The Sprint 30 staged Grade 7–12 model (reusing `dominant_cluster`, assessment-count/diversity gates, and the existing Junior/Senior split) remains the recommended target shape — this sprint found no reason to revise it, only confirmed which consumers still need to be wired to it.

## 5. Evidence Propagation Verification (Objective 7)

| Path | Propagates correctly on correction? |
|---|---|
| Blueprint, Holiday Planner, Parent Career Intelligence (Projection half), Adaptive Learning, Monday Panel (risk-badge half) | **Yes** — all call `recomputeLearnerProjection()` fresh per request |
| Career Explorer, Career Intelligence Report, Parent Career Intelligence (capability half) | **No** — `getCapabilityProfile()` reads a persisted `students.capability_profile` row; `markSuperseded()` has ~20 call sites, none touch it (Sprint 29) |
| Parent Pulse's career line | **No** — reads persisted `learner_profiles.career_signals`; same gap, different field (Sprint 30) |
| Monday Panel's batch/cache path | **Partial** — the live risk badge is fresh, but the cached payload (24h TTL) has no explicit correction-triggered invalidation (Sprint 30) |

## 6. Confidence Propagation Verification (Objective 9, confidence half)

Reconfirms Sprint 28–29's formula findings without new testing this sprint: `capabilityProjector.ts`'s same-subject dedup starves confidence on repeat evidence; `coverage.ts`'s mean-based formula can *drop* confidence when diverse, legitimate lower-trust-tier evidence is added; `confidenceFromAssessmentCount()`'s Low→High jump at count=3 has no cross-subject diversity requirement. All three remain open. No subsystem was found in any sprint fabricating false certainty from thin evidence in the *conclusion* itself (the "Hidden Strengths" bug from Sprint 27b, `raw_score < 0.35` missing the exact `0.35` fallback value, is the one exception — a confidence-blind conclusion, not a confidence-miscalibration).

## 7. Cache and Persistence Audit (Objective 8)

| Cache/persisted store | Correction-aware? |
|---|---|
| `students.capability_profile` | No (§5) |
| `learner_profiles.career_signals` | No (§5) |
| `monday_panel_cache` (24h TTL) | No, timer-only (§5) |
| `learner_projections` (the persisted Projection table) | **Currently cannot be written to at all** for V2-triggering students (Sprint 27) — a correction can't propagate to a table that never successfully receives the original computation either |
| Blueprint, Holiday Planner, Parent Pulse (non-career fields) | N/A — no cache, computed live every request |

## 8. Remaining Duplicate Computations & Orphans (Objectives 1, 11)

**Duplicates** (full detail in Sprint 27's inventory, unchanged, listed here only as a final tally): 3 readiness formulas, 2 risk-flag systems, the legacy Academic Clinic third capability pipeline, Remedial-vs-Adaptive subject-level divergence. Zero new duplicates found this sprint.

**Orphans — final sweep, one new finding**:

- Previously known (Sprints 24, 27–30): dead `CareerSignals.readiness_scores` field, inert `compass_sessions.ending_level` write path, dead `generateParentSummary()`, dormant `student_learning_context.top_careers` column.
- **New this sprint: the Projection V2 layer (`capabilityV2Projector.ts`, `trendV2Projector.ts`, `knowledgeV2Projector.ts`) is a write-into-the-void.** It is correctly wired into `computeLearnerProjection()` and computes real substrand-level data on every recompute — but grep confirms zero downstream code anywhere outside `lib/projection/` reads `.capabilityV2`, `.trendV2`, or `.knowledgeV2` off the projection result, and nothing queries `learner_projections` filtered to those `projector_type` values. The code's own header comments describe this as deliberate additive staging for a future substrand-level upgrade, not a mistake — but it has been running, computing, and attempting to persist on every evidence-writing path across the entire platform with no consumer since it shipped.

**This orphan is the direct cause of Sprint 27's persistence crash.** The `learner_projections_projector_type_check` CHECK constraint blocks exactly these three `projector_type` values — they were added to `PROJECTOR_TYPES` in `lib/projection/recompute.ts` without a corresponding migration. This reframes Sprint 27's recommended fix (§9).

## 9. Recommended Final Consolidations (Objective 12)

Every item below reuses existing code; none require new architecture. Reordered one final time by what actually blocks a real user today:

1. **Resolve the Projection V2 orphan and the persistence crash together, and reconsider which fix is actually smallest.** Sprint 27 recommended widening the CHECK constraint (a migration) to let V2 projections persist. Given §8's finding that nothing reads V2 projections yet, an equally valid — and arguably smaller and safer — alternative is: **stop attempting to persist `capabilityV2`/`trendV2`/`knowledgeV2` rows until a real consumer exists**, i.e. compute them in-memory as already happens (harmless, additive, matches the code's own "does not replace V1" comment) but skip the `upsertProjection()` call for those three types specifically. This fixes the live crash with a code change instead of a schema migration, and removes the write-into-the-void until the substrand-level feature they were built for actually ships. Recommend this as the primary path; widening the constraint remains the right move only once a real V2 consumer is ready to be built.
2. **Wire the Career Explorer, Career Intelligence Report, and Parent Career Intelligence panel to `buildCareerIntelligence()`** (Sprint 30, unchanged) — still the single highest-value fix for closing the Junior-safety gap, independent of item 1.
3. **Extend the evidence-supersession invalidation pattern to `students.capability_profile` and `learner_profiles.career_signals`** (Sprints 29–30) — same fix, two fields.
4. **Address `monday_panel_cache`'s correction-blindness** — either a lightweight invalidation hook or, cheaper, excluding the lower-stakes career-related content from the cached payload specifically (Sprint 30).
5. **Fix the confidence-formula gaps** (`capabilityProjector.ts` dedup, `coverage.ts` mean-based penalty, `confidenceFromAssessmentCount()`'s missing diversity gate, the `raw_score < 0.35` boundary miss) — Sprints 28–29, still open, still valid, still small.
6. **Gate Compass's XP/level-up feedback behind evidence lifecycle state** — Sprint 26's original finding, still the platform's clearest live child-facing Constitution gap, unrelated to and not blocked by any of the above.
7. **Clean up the now-complete orphan list** (§8) in one small pass once a decision is made on each: delete the dead field/write-paths, or explicitly document `student_learning_context.top_careers` as intentionally reserved for a future feature so nobody accidentally wires a write path to it without the grade gate Sprint 30 recommended.
8. **The legacy Academic Clinic third pipeline** (`clinicReportBuilder.ts`, `pathwayCalculator.ts`) remains the series' largest single piece of unconsolidated legacy code — Sprint 25's roadmap already scoped this as the highest-engineering-complexity item, correctly sequenced last across every sprint that has touched it since.

## 10. Constitution Compliance Matrix — final tally across the series

| Article | Final status |
|---|---|
| I — No projection without evidence | Held in computation; **blocked at persistence** for V2-triggering students (§8/§9 item 1) |
| II — Missing evidence ≠ poor performance | Held everywhere tested, all seven sprints, no exception ever found |
| III — Confidence ≠ ability, shown separately | Held in principle; **miscalibrated** in three named formulas (§6) |
| IV — Growth over isolated performance | Held everywhere in the canonical chain; **not held** in the three legacy readiness formulas |
| V — Risk predicts support, not worth | Held in labeling; weakened by Monday Panel's untraceable flag text and the `term-readiness` cron's stale field (Sprint 27) |
| VI — AI explains, never invents | Held at the prompt level everywhere checked; **undermined by the deterministic layer** feeding it fabricated/ungated content upstream (Sprint 27b's Hidden Strengths bug, Sprint 30's Career Report self-contradiction) |
| VII — Evidence needs corroboration | Held in the durable record; **violated** in Compass's immediate XP/level-up UI (§9 item 6) |
| VIII — Teacher approves before parent sees | Held, unchanged across every sprint that re-checked it |
| IX — Every recommendation traceable | Held in the canonical chain (Blueprint, Adaptive Learning); **not held** in Monday Panel, Remedial Planner, Career Report, Parent Pulse's structural trace |
| X — Career guidance is possibility, not destiny | **The series' most-violated Article** — Sprint 28's over-specialization bug, Sprint 29's missing Junior grade gate, Sprint 30's three ungated consumer surfaces are all instances of this one Article failing in different places |
| XI — A number without a name is not neutral | The self-critical Article that correctly predicted this entire series' shape: most findings across seven sprints are exactly this — a real, correctly-computed number that reaches an inconsistent, untraceable, or ungated audience |

## 11. Regression Results

- **TypeScript**: same 3 pre-existing errors carried since Sprint 27 (2 long-standing, 1 in this sprint series' own throwaway trace script), all script-only. Zero new errors.
- **ESLint**: zero errors/warnings across every audited directory this series has touched (`lib/projection`, `lib/intelligence`, `lib/learnerIntelligence`, `lib/career`, `lib/holiday`, `lib/parentPulse`, `lib/attentionFeed`, `lib/compass`, `lib/remedial`, `lib/adaptiveLearning`, `lib/learnerModel`, `lib/core/report-cards.ts`, `lib/academicClinic`, `lib/sow`, `lib/lessonPlan`, `lib/row`, `lib/teachingIntelligence`, plus the relevant `app/api/` routes).
- **Production build**: compiles successfully; type-check step fails only on the same pre-existing `scripts/` file.
- No code has changed at any point in this seven-sprint series (22–31). Every regression check across all seven sprints has returned the identical baseline, confirming no drift.

## 12. Final Go / Conditional Go / No-Go

**CONDITIONAL GO.**

Across seven sprints, this series never found a reason to redesign EduNexus's intelligence architecture, and this final convergence pass confirms that conclusion holds. What it found instead is a short, complete, well-understood list of specific gaps — most of them solvable by wiring an already-correct module to a surface that doesn't yet call it, not by building anything new. That is the definition of a platform whose design is sound and whose implementation has caught up to it in most, not yet all, places.

The condition for full convergence is the four items in §9 ranked 1–4: fix the Projection persistence crash (preferably via the smaller in-memory-only V2 fix identified this sprint, §9 item 1), wire the three remaining career consumers to `buildCareerIntelligence()`, close the two evidence-correction propagation gaps, and address Monday Panel's cache staleness. None of these four require a product decision the way the legacy Academic Clinic consolidation (§9 item 8) does — they are ready to implement now. Once they land, re-run this series' verification pattern (live-data tracing, not just static reading — the technique that found every serious bug in Sprints 27–30) once more before declaring convergence complete rather than conditional.
