# EduNexus — Implementation Wave 2 Report

**Educational Guidance Completion**
Date: 2026-07-12
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: implementation, following directly from Wave 1's deferred item and the Sprint 22–31 audit series. Wave 1 completed the canonical intelligence pipeline (Evidence → Projection → persistence/propagation). Wave 2 completes how that intelligence is presented — wiring the three career-guidance surfaces Wave 1 identified as ungated to a single, shared, Junior/Senior-aware guidance layer.

---

## 1. Executive Summary

All three deferred consumers — Career Explorer, Parent Career Intelligence, and the Career Intelligence Report — are now grade-gated using one shared helper (`familiesFromMatches()`) instead of three independent (or absent) gates. Junior (Grade 7–9) learners now receive broad category-level exploration guidance with no ranked prediction or percentage anywhere in the response; Senior (Grade 10–12) learners' existing specific-match behavior is unchanged. No new recommendation engine was created — every surface still calls the same `computeCapabilityMatches()` this platform has always used; the fix is entirely in how each grade's output is shaped and gated, reusing one extracted grouping function everywhere.

Live verification against synthetic Junior and Senior fixtures confirmed the Career Principle holds end-to-end. It also surfaced one real, pre-existing architectural gap this wave did **not** fix (§9) — flagged clearly rather than silently left implicit.

**Verdict: CONDITIONAL GO** — conditional on the one deferred item in §9, which is a pre-existing risk this wave made visible, not one it introduced.

---

## 2. Guidance Architecture

Before this wave, three surfaces called `computeCapabilityMatches()` directly and returned its 4-tier output (`primary`/`stretch`/`alternative`/`entrepreneurial`, each with a specific career title and alignment percentage) to every grade unconditionally. `buildCareerIntelligence()` (`lib/learnerIntelligence/careerIntelligence.ts`) already did this correctly for Holiday Planner, with its own private `buildJuniorFamilies()` grouping logic.

This wave:

1. **Extracted** `buildJuniorFamilies()`'s grouping logic into a standalone, exported pure function: `familiesFromMatches(matches: CapabilityCareerMatch[]): CareerFamilyInsight[]`. It takes already-computed matches and groups them into category-level `Insight`-wrapped families (observation, evidence, confidence, action) with no ranking or percentage — the one Junior-safe view every consumer now shares.
2. **Gated** all three deferred surfaces by grade, each computed from the exact same `computeCapabilityMatches()` call already in use — no parallel engine, no new matching logic:
   - **Career Explorer** (`app/api/career/capability-matches/route.ts`): Junior gets `{ mode: 'exploration', families: [...] }`; Senior's response is unchanged (`{ ...report, mode: 'planning' }`, additive field only).
   - **Parent Career Intelligence** (`app/api/parent/career-intelligence/route.ts` → `lib/career/parentIntelligence.ts`): `buildParentIntelligence()` now takes a `mode` parameter; Junior gets `career_families` (new optional field) and an empty `recommended_careers`; Senior is unchanged.
   - **Career Intelligence Report** (`lib/career/careerIntelligenceEngine.ts`): `buildOpportunityLandscape()` now branches on mode — Junior's `strong_fit_now` is family-grouped (via the same `familiesFromMatches()`), and `fit_after_improvement`/`unlikely_today` are deliberately left empty (judging a specific career as a "stretch" or "unlikely" is itself a prediction the Career Principle forbids at this stage). The AI narrative prompt now carries an explicit mode instruction so the DeepSeek-generated sections never use predictive/destiny language for Junior.
3. **Preserved every existing API contract for Senior** — no Senior-facing response shape changed. All new fields (`mode`, `career_families`) are additive.

## 3. Files Modified

- `lib/learnerIntelligence/careerIntelligence.ts` — extracted and exported `familiesFromMatches()`.
- `app/api/career/capability-matches/route.ts` — added grade fetch + `shapeForGrade()` gate (GET and POST).
- `app/(student)/career/page.tsx` — added `CareerExplorationPanel`/`CareerFamilyCard`, branches on `mode`.
- `lib/career/parentIntelligence.ts` — `buildParentIntelligence()` takes `mode`; `career_families` populated for Junior; `buildRedFlags()` wording adapted per mode.
- `lib/career/types.ts` — `ParentIntelligenceReport.career_families` (optional) and `.mode`; `CareerIntelligenceReport.mode` (both additive).
- `app/api/parent/career-intelligence/route.ts` — fetches `grade`, computes `mode`, passes through.
- `app/(parent)/career-intelligence/page.tsx` — added `CareerFamilyCard`, branches the "Career Matches" section on `report.mode`.
- `lib/career/careerIntelligenceEngine.ts` — `buildOpportunityLandscape()` and `generateNarrativeSections()` take `mode`; `topMatchTitles` for Junior sourced from family labels, not specific career titles.
- `app/(parent)/career-intelligence-report/page.tsx` — added a mode badge ("Exploring Possibilities" / "Career Planning") to the report header.

No migrations. No changes to `computeCapabilityMatches()` itself or any scoring formula.

## 4. Consumer Migration Summary

| Consumer | Before | After (Junior) | After (Senior) |
|---|---|---|---|
| Career Explorer | Ungated, all grades got ranked % matches | `families[]`, no ranking/%, `mode: 'exploration'` | Unchanged, `mode: 'planning'` added |
| Parent Career Intelligence | Ungated | `career_families[]`, `recommended_careers: []` | Unchanged |
| Career Intelligence Report | Ungated, self-contradictory prompt (Sprint 30) | Family-grouped `strong_fit_now`, no stretch/unlikely tiers, mode-aware AI prompt | Unchanged |
| Holiday Planner (`buildCareerIntelligence`) | Already correctly gated | No change — same `familiesFromMatches()` now shared | No change |

## 5. Confidence Verification

Every family and match object already carries a `confidence: ConfidenceLevel` (`Insight`'s Low/Medium/High, or `CapabilityCareerMatch.confidence`, both derived from the same `confidenceFromAssessmentCount()`/assessment-count thresholds — no new confidence scheme introduced). Live verification (§8) confirmed a Junior fixture's family confidence and a Senior fixture's match confidence were both populated and non-null in every response checked.

## 6. Evidence Traceability

`CareerFamilyInsight.insight.evidence` and `CapabilityCareerMatch.strengths`/`.gaps` (each carrying a `.narrative`) already provide an evidence summary per recommendation — unchanged by this wave, now surfaced consistently to Junior via the shared `familiesFromMatches()` helper instead of only to Senior.

Evidence-correction propagation itself was Wave 1's fix (the `evidence_projection_events` outbox now recomputes `students.capability_profile` for every affected learner). All three consumers wired in this wave read that same persisted, now-fresh `capability_profile` — no additional propagation work was needed here.

## 7. Constitution Compliance

- **Article X (career guidance is possibility, not destiny)** — the series' most-violated Article — is now held across Career Explorer, Parent Career Intelligence, and the Career Intelligence Report, not just Holiday Planner.
- **Career Principle** ("Junior learners are exploring possibilities. They are never being predicted.") — verified live: zero ranked/percentage output reached a Junior fixture on any of the three surfaces.
- **Reality Principle** (exam-only evidence must still produce guidance) — unaffected; no change to the minimum-evidence gating already in `computeCapabilityMatches()`.

## 8. User-visible Consistency Verification

Ran a live throwaway script (`tsx --env-file=.env.local`, synthetic Junior grade-8 and Senior grade-11 fixtures with real `assessments` rows, cleaned up after) exercising all three consumers' underlying logic directly:

```
=== Junior (grade 8) ===
[Career Explorer] mode = exploration, families: 4 (no % or ranked single career)
[Parent] mode = exploration, recommended_careers: 0, career_families: 4
OK — no contradictory guidance, Career Principle held

=== Senior (grade 11) ===
[Career Explorer] mode = planning, primary matches: 5 (specific % as expected)
[Parent] mode = planning, recommended_careers: 2, career_families: 0
OK — no contradictory guidance, Career Principle held
```

Junior received zero ranked/percentage career claims on any surface; Senior's existing behavior was unchanged. Confidence was populated and non-null in every case checked.

## 9. Remaining Deferred Items

1. **A real, confirmed two-pipeline divergence between `buildCareerIntelligence()` and the three consumers wired this wave.** The same live verification run also called `buildCareerIntelligence()` (Holiday Planner's canonical source) against the identical fixtures and found it returned **zero** families/matches for both grades — because it sources capability data via `recomputeLearnerProjection()` → the Evidence Domain, while `capability-matches`/`parent-career-intelligence`/`careerIntelligenceEngine` all source via `getCapabilityProfile()` → the legacy `assessments`-table-backed `students.capability_profile` (kept fresh by Wave 1's outbox consumer, but fed by a different upstream table). The fixture's data only reached the legacy `assessments` table, not Evidence. This is the "2 parallel capability pipelines" risk Sprint 22 first flagged and is **pre-existing — not introduced by this wave** — but this wave's unification work makes it more visible: three of four career surfaces now agree with each other, and disagree with the fourth (Holiday Planner) whenever a school's evidence hasn't reached the Evidence Domain pipeline. Given the Reality Principle (most schools today are exam-only, entering marks through the legacy `assessments` flow), this is a live, not theoretical, risk. **Recommendation for Wave 3**: pick one canonical profile source for career guidance — either migrate `capability-matches`/`parent-career-intelligence`/`careerIntelligenceEngine` onto the Projection-sourced path `buildCareerIntelligence()` already uses (the `projectionAdapters.ts` shim already lists `parent/career-intelligence` as an "approved caller," suggesting this was the intended direction), or confirm Evidence Domain ingestion now covers 100% of the legacy `assessments` write path so both sources agree by construction. This needs verification against real school data before either change, not a guess.
2. **The legacy Academic Clinic third pipeline** (`clinicReportBuilder.ts`, used inside `careerIntelligenceEngine.ts`) remains untouched — correctly out of scope per Sprint 25's roadmap, unrelated to this wave's grade-gating fix.
3. **Confidence-formula miscalibrations** (Sprint 28–29) — still open, unrelated to this wave.
4. **Compass XP/level-up UI evidence-lifecycle gate** (Sprint 26) — still open, unrelated to this wave.

## 10. Regression Results

- **TypeScript**: identical to Wave 1's baseline — the same 3 pre-existing script-only errors. Zero new errors from this wave's changes.
- **ESLint**: zero new errors across all 9 modified files (one pre-existing, unrelated warning in `app/(parent)/career-intelligence/page.tsx` on a line this wave did not touch).
- **Production build**: compiles successfully (Turbopack, 36.5s); the build's TypeScript pass fails only on the same pre-existing `scripts/create-compass-auto-confirm-account.ts` error.
- **Unit tests**: `lib/projection/engine.test.ts` — 13/13 pass, unaffected (this wave touched no projection code).
- **Live verification**: synthetic Junior/Senior fixtures, all three consumers exercised directly — Career Principle held in every case; the one architectural gap in §9 was discovered, not hidden.

## 11. Final Go / Conditional Go / No-Go

**CONDITIONAL GO.**

The three surfaces this wave was commissioned to wire are wired, grade-gated, live-verified, and share one grouping function instead of three independent (or absent) gates — Article X now holds platform-wide for the surfaces checked. The condition is item 1 in §9: a real, evidence-based divergence between the Evidence-Domain-sourced canonical path and the legacy-assessments-sourced path this wave's three consumers use, which existed before this wave and was made visible, not created, by it. It should be resolved with a verified decision (not a guess) before declaring the guidance layer fully convergent — the same discipline Sprint 27–31 applied to the Projection Engine itself.
