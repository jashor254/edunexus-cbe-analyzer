# EduNexus — Educational Intelligence Convergence Report

**Sprint type:** Educational Intelligence Convergence (implementation sprint, building directly on the Sprint 20 Verification Report's findings)
**Date:** 2026-07-12
**Core principle enforced:** One learner. One evidence timeline. One educational interpretation. Many views.

---

## Executive Summary

Sprint 20 verified the platform's educational reasoning and found a well-designed Evidence Domain / Projection Engine undermined by drift at the edges: a live data-corruption bug in pathway readiness, a legacy career-reasoning path still reaching parents in parallel with the canonical engine, and confidence/staleness/conflict infrastructure that was built but never actually read by the consumers that needed it. This sprint closes those gaps without redesigning anything — every fix reuses a value, table column, or helper function that already existed.

Six intelligence consumers (Blueprint, Holiday Planner, Career Intelligence, Parent Pulse, Monday Panel/Teacher Intelligence, and the Evidence Domain's own conflict/confidence infrastructure) now read from the same underlying signals and speak in the same hedged, evidence-aware language. Pathway readiness no longer treats an unassessed subject as a failing one. Conflicting evidence is detected and surfaced as an explicit "review this" flag instead of being silently resolved by whichever record arrived last. The legacy career-reasoning path still exists (removing it outright was judged too risky for this pass — see Deferred Items) but its language and evidence-count discipline are now aligned with the canonical engine, closing the practical risk of a parent seeing two contradictory claims.

TypeScript, ESLint, and the Next.js production build all pass with no regressions introduced by this sprint — the only remaining failures are two pre-existing, unrelated script-file errors confirmed via `git diff` to predate this sprint entirely.

---

## Educational Consistency Audit

Traced one learner's evidence through the full chain: **Assessment → Evidence → Projection → Blueprint → Career → Holiday Planner → Parent → Teacher → Compass.**

| Stage | Source of truth | Consistent with Projection Engine? |
|---|---|---|
| Assessment → Evidence | `lib/intelligence/evidenceLifecycle.ts` | Yes — the one ingestion path every producer (CSV, topical checks, Compass, holiday returns) funnels through |
| Evidence → Projection | `lib/projection/*Projector.ts` via `recomputeLearnerProjection` | Canonical, deterministic, evidence-only |
| Projection → Blueprint | `lib/learnerIntelligence/blueprint.ts` | Yes — reads Projection directly |
| Projection → Career Intelligence | `lib/career/capabilityMatchEngine.ts` via `capabilityExtractor` | Yes — reads Projection via `projectionToScoreHistory` |
| Projection → Holiday Planner | `lib/holiday/planner.ts` | Yes — reads Projection + reuses `buildCareerIntelligence` + `buildAdaptiveTask`, no bespoke computation |
| Projection → Parent Pulse | `lib/parentPulse/builder.ts` | Yes — reads the same Projection, only selects what to say |
| Projection → Monday Panel | `lib/attentionFeed/panel.ts` | Yes for risk/attention list (documented partial migration — mastery heatmap and peer-helper *content* still read legacy `learner_profiles`, a known, documented engine gap, not silent drift) |
| Projection → Compass | `lib/compass/session.ts`'s `getNextSubject` | **No — reads legacy `student_learning_context.subject_tiers`, written by the old `academicClinic/assessmentPipeline.ts`, not Projection.** This function is currently unused dead code (zero callers found), so it presents no live inconsistency today, but it is the one remaining place in the codebase where "different reasoning" would resurface if it were ever wired up. Flagged as a deferred item, not fixed in this pass — fixing it means re-plumbing the same legacy write path targeted in the Career Intelligence consolidation below. |

**Verdict:** every consumer that is actually live and reachable by a user now reasons from the same evidence timeline and the same Projection Engine output. The one exception (`getNextSubject`) is inert. Different presentation, same interpretation — the mandate holds.

---

## Pathway Readiness Verification

**Fixed.** `refreshPathwayReadiness()` (`lib/learnerModel/updater.ts`) previously recomputed all four pathway scores (STEM, Social Sciences, Arts & Sports, Technical/TVET) from only the current signal's subjects, defaulting every other subject to `norm(0) = -33` and hard-overwriting the stored state. Since a topical check — the platform's highest-volume real workflow — only ever supplies one subject, this meant pathway readiness was routinely dragged toward large negative contributions from subjects that simply weren't part of that check, not subjects the learner was failing.

The fix:
- `pick()` now returns `null`, not `0`, for any subject absent from the current signal.
- Each pathway's weighted formula (`weighted()`) renormalizes over only the subjects actually present, so a pathway touched by one of its three inputs is scored from that one input, not diluted by phantom zeros.
- A pathway with **zero** contributing subjects in this signal is left at its prior `{ score, trend, last_updated }` entirely untouched — not recomputed, not even trend-checked against itself.

Verified via direct code trace (not just the fix, the original bug too) — all three call sites (`lib/assessments/mutations.ts`, `lib/assessments/topical.ts`, `app/api/teacher/assessments/process/route.ts`) confirmed to pass exactly the subjects present in that assessment event, so this bug was live on every one of them, most severely on topical checks.

*(A related, smaller `?? 0` fallback flagged during Sprint 20 research, at `updater.ts:60`'s per-substrand mark, was independently re-verified this sprint against all three call sites and confirmed unreachable dead code today — every caller already guarantees the subject key it iterates is present in `subjectMarks`. Left as-is; not a live bug, and changing it risks touching code that currently behaves correctly.)*

---

## Career Intelligence Consolidation

**Not removed — hedged, evidence-count-disciplined, and explicitly marked as non-canonical.** Full retirement of `lib/academicClinic/careerEngine.ts` was judged too large and risky for this sprint: its `matchCareers()` output (career catalog, `matchRequirements`, `cbeReadiness`) still directly powers `generateSeniorGuidance()` in `reportGenerator.ts`, which is embedded in the PDF report emailed/WhatsApp'd to parents on every Grade 10+ assessment submission (`lib/academicClinic/assessmentPipeline.ts`). Swapping that catalog for the canonical engine's is a data-migration-sized change, not a hardening fix — attempting it this sprint would have violated "do not redesign architecture."

What was done instead:
1. **Language alignment.** `generateSeniorGuidance()`'s `honestAssessment`, `whyItFits`, and `keyGap` templates were rewritten from assertive claims ("represent realistic and well-matched pathways," "genuinely achievable") to the same evidence-aware phrasing the canonical engine uses ("Based on available evidence...", "Confidence is moderate because...").
2. **Evidence-count discipline.** A career match can no longer read as `STRONG` off fewer than 3 assessed subjects — the same corroboration threshold `capabilityMatchEngine.ts` already enforced was ported in as a one-line cap (`if (matchStrength === 'STRONG' && evidenceCount < 3) matchStrength = 'GOOD'`), not a new scoring scheme.
3. **`careerEngine.ts`'s `buildParentSummary()`** language ("an excellent match," "Booming — excellent future") was hedged too, for consistency, even though tracing its actual call graph confirmed this specific output (`oneLine`/`parentSummary` inside `analyze()`'s enriched results) is **never read by any caller** — `assessmentPipeline.ts` only destructures `compassBridge` from `analyze()`'s return value. Not a live risk, fixed anyway since it was cheap and prevents the same risk resurfacing if a future caller reads more of that return value.
4. **A permanent doc comment** now marks `careerEngine.ts` as scoped to the legacy report only, naming `lib/career/capabilityMatchEngine.ts` as the sole canonical source for any new career-recommendation UI.

**Net effect:** a parent can no longer see two career narratives with meaningfully different confidence framing for the same child — both paths now agree on how certain they are, even though they still compute from different catalogs. Full consolidation onto one catalog is the correct next step and is listed under Deferred Items.

---

## Confidence Integration Review

Reused `lib/learnerIntelligence/insight.ts`'s `ConfidenceLevel` (`Low`/`Medium`/`High`) and `confidenceFromScore()` everywhere — no new scoring was invented anywhere in this sprint.

| Consumer | Before | After |
|---|---|---|
| **Blueprint** | Per-Insight confidence existed; no whole-Blueprint evidence summary | Added `evidenceSummary` (evidence used, confidence, freshness, missing evidence, recommended next evidence) to the data shape *and* the PDF, reusing the previously-orphaned `completenessProjector` output |
| **Holiday Planner** | `AdaptiveTask.confidence` was computed by `buildAdaptiveTask` and silently discarded by the planner | Now read: workload intensity (1 vs 2 Compass sessions/week) and parent-message tone scale with it; `HolidayPlanData.evidence_confidence` added to the output shape |
| **Career Intelligence** | `matchToInsight()` derived confidence from `alignment_score` (a fit measure, not an evidence-quality measure) | `CapabilityCareerMatch.confidence` added, computed from `assessment_count` using the exact thresholds `scoreCareer()` already used to cap scores — Insight confidence now answers "how much evidence," not "how good a fit" |
| **Parent Pulse** | No confidence-aware phrasing | "Needs attention" / "Ask X to explain Y" now soften to "worth keeping an eye on" / a casual check-in when `projection.knowledge.confidence` is Low — teacher risk flags (which already require corroboration) are never softened |
| **Monday Panel / Teacher Intelligence** | `StudentAttentionItem` had no confidence field | Added, sourced from `projection.risk.confidence` |
| **Compass** | Evidence emission (`lib/compass/evidence.ts`) already correctly trust-tier-capped (`compass_session` = tier 1, confidence ≤ 60) | Verified correct, unchanged. `getNextSubject`'s reasoning layer confirmed dead code — see Consistency Audit above |

---

## Evidence Freshness Review

`coverage.freshnessDays` was computed correctly since Sprint 20 but only consumed by `completenessProjector`, which itself had **zero downstream readers** — a fully-built, fully-persisted signal nobody ever looked at. This sprint:

- Wired `projection.completeness` into Blueprint's new `evidenceSummary.freshnessDays`, with hedged copy ("ageing... a fresh assessment would confirm it still holds") when evidence is over 60 days old.
- Wired the same signal into Career Intelligence's new `evidenceFreshnessDays` field.
- Left the confidence *formula* itself (`computeProjectionConfidence`) freshness-blind by design for this pass — folding freshness into the core formula would change every projection's score platform-wide, a bigger behavioral change than "surface what's already computed." Surfacing freshness as an accompanying fact (not a score multiplier) was judged the lower-risk convergence move; using it as a multiplier is listed under Deferred Items if the product wants that stronger behavior.

---

## Conflict Detection Review

`verification_state: 'contradicted'` and `repos.evidence.updateVerificationState()` existed since before Sprint 20 and were never called by anything. This sprint wired them in:

1. **Detection.** `lib/intelligence/evidenceLifecycle.ts`'s `flagContradictionIfAny()` runs at both points where one confirmed piece of evidence supersedes another for the same claim (`learnerId:subject:assessmentType:academicYear:term`) — `persistEvidenceBatch` and `confirmReview`. A CBC-level disagreement of 2 or more between the two triggers `verification_state = 'contradicted'` on both rows, plus a `verification_updated` audit event recording what conflicted with what.
2. **Confidence impact.** `computeProjectionConfidence` (`lib/projection/coverage.ts`) now halves its result when any supporting evidence carries `verification_state === 'contradicted'` — every projector (academic, capability, knowledge, risk) inherits this automatically since they all call the same shared function.
3. **Explicit surfacing.** `riskProjector.ts` now emits a dedicated `watch`-severity flag ("Conflicting evidence for {subject} — two confirmed sources disagree; a teacher should review before relying on this") whenever a subject's evidence includes a contradicted row. This is the one risk flag type that isn't a performance judgment at all — it's a flag about the evidence itself.
4. **Language.** Blueprint's `buildParentAction` now special-cases a conflict-flag as the top risk flag: confidence is forced to `Low` (never `High`, unlike a corroborated risk claim) and the action becomes "ask the teacher to review the conflicting records," not "check in about this concern."

This directly satisfies "surface educational uncertainty instead of silently averaging" — a genuine disagreement between two trusted sources for the same claim is now a visible, actionable signal instead of a silent "latest wins."

---

## Blueprint Consistency

Blueprint now explicitly answers all four things the sprint mandated:
- **Evidence used** — `evidenceSummary.evidenceUsed` (subjects with confirmed evidence, from `completeness.value.subjectsCovered`)
- **Confidence** — `evidenceSummary.confidence`, plus per-Insight confidence as before
- **Missing evidence** — `evidenceSummary.missingEvidence` (capability dimensions with zero supporting evidence)
- **Recommended next evidence** — `evidenceSummary.recommendedNextEvidence`, a single hedged sentence naming what would sharpen the Blueprint next

This is now visible in the actual PDF (`pdfGenerator.tsx`), not just the data shape — a teacher or parent reading page 1 sees an evidence-summary box before any claim, matching the "no sentence without its evidence" principle the file already documented but didn't fully deliver on for the Blueprint as a whole (only per-Insight, previously).

---

## Holiday Planner Consistency

Workload now scales with the confidence behind the priority gap it's built from, not just the raw CBC level:
- `sessionsPerTask()` reduces from 2 Compass sessions/week to 1 when `AdaptiveTask.confidence === 'Low'`.
- Parent-facing action text and the WhatsApp/dashboard summary soften from declarative ("has room to grow in X") to hedged ("may benefit from more practice in X, though this is based on limited evidence so far") under the same condition.
- `HolidayPlanData.evidence_confidence` is now part of the persisted plan shape, so any future consumer (printable pack, API response) can read it without recomputing anything.

The three Sprint-19-era Holiday Planner bugs (term/year not passed, batch response misparsed, nonexistent `students.first_name` column) were re-verified this sprint and remain fixed — no regression.

---

## Recommendation Language Review

Swept every consumer touched this sprint for absolute/contradictory phrasing (`grep` for "guaranteed," "will excel," "the best," "100% match," "genuinely achievable," "excellent," "must," "certainly," etc. across `lib/learnerIntelligence`, `lib/holiday`, `lib/parentPulse`, `lib/career`, `lib/attentionFeed`, `lib/compass`, `lib/projection`). Remaining hits were code comments, not user-facing strings. Every rewritten sentence in this sprint (Career Intelligence's two engines, Holiday Planner, Parent Pulse) now uses one of the mandate's suggested frames: "Current evidence suggests...", "Based on available evidence...", "Confidence is [level] because...".

---

## Regression Validation

- **TypeScript** (`npx tsc --noEmit`): 2 errors, both in `scripts/` (unrelated to this sprint's `lib/`/`app/` changes) — confirmed via `git diff --stat HEAD` to be byte-identical to the last commit, i.e. pre-existing and untouched.
- **ESLint** (`--quiet` across every directory touched this sprint: `learnerModel`, `learnerIntelligence`, `parentPulse`, `holiday`, `projection`, `career`, `intelligence`, `attentionFeed`, `compass`, `academicClinic`): zero errors.
- **Production build** (`npm run build`, Turbopack): compiles successfully. The build's own typecheck gate fails on the same pre-existing `scripts/create-compass-auto-confirm-account.ts` error above — not a regression from this sprint (verified the file is untouched; a stash-based baseline check also confirmed the *uncommitted* pre-sprint tree had its own, different, larger set of unrelated issues, none of which this sprint's changes caused or interact with).
- No literal-object construction sites were broken by the new required fields added to `LearnerBlueprint`, `HolidayPlanData`, `CapabilityCareerMatch`, `CareerIntelligence`, or `StudentAttentionItem` — grepped for every consumer of each type; all are read-only consumers, none construct literals outside the one function each type belongs to.

---

## Engineering Confidence: **High**

Every change in this sprint reused an existing field, table column, helper function, or threshold — no new scoring formulas, no new infrastructure, no new AI calls. The riskiest change (pathway readiness) was verified against all three real call sites before and after the fix. The riskiest deferred decision (full career-engine consolidation) was correctly *not* attempted given its blast radius on a live parent-facing notification path.

## Educational Confidence: **High** (up from Medium in Sprint 20)

The specific finding that drove Sprint 20's Medium rating — pathway readiness corrupted on the platform's dominant real-world workflow — is fixed and verified. The platform's central promise, "missing evidence is not negative evidence," now holds structurally in the one place it was previously being violated at scale, and is reinforced everywhere else evidence is thin: Holiday Planner hedges its workload, Career Intelligence hedges its match language, Parent Pulse hedges its concern framing, and Blueprint now says outright what evidence it's missing rather than leaving that implicit.

## Remaining Deferred Items

1. **Full Career Intelligence consolidation** — retire `lib/academicClinic/careerEngine.ts`'s catalog entirely in favor of `lib/career/capabilityMatchEngine.ts`, once product has signed off on the PDF/report redesign this requires. Language and evidence-count discipline are now aligned in the meantime.
2. **`getNextSubject` in `lib/compass/session.ts`** — dead code, reads legacy `student_learning_context` instead of Projection. Either wire it to Projection before it's ever called from a real route, or remove it; leaving inert legacy-reasoning code in the tree is a latent risk if someone wires it up without noticing.
3. **Freshness as a confidence multiplier** — currently surfaced as an accompanying fact (Blueprint, Career Intelligence) rather than folded into `computeProjectionConfidence` itself. Folding it in would be a stronger, platform-wide behavioral change and needs a product decision on the decay curve, not just an engineering call.
4. **Misconception history** (Sprint 20 finding, unchanged this sprint) — `SubstrandMastery.root_cause` is still a single string overwritten on every update, with no history of what was flagged or how it resolved.
5. **UI surfacing** — the new confidence fields (`StudentAttentionItem.confidence`, `HolidayPlanData.evidence_confidence`, `CareerIntelligence.evidenceFreshnessDays`) are wired at the data layer and consumed where cheap to do so (Blueprint PDF, Holiday Planner's own message text), but a full sweep of every teacher/parent-facing page to visually surface these new fields was out of scope for this pass — the "many views" the data now supports haven't all been built yet.

## Final Go / No-Go: **Go**

The platform's core educational guarantee is now structurally correct where Sprint 20 found it broken, every live consumer reasons from one evidence timeline, and no regression was introduced. The remaining deferred items are real but bounded, none are safety-critical, and the riskiest one (full career-engine consolidation) was correctly deferred rather than rushed.
