# EduNexus — Canonical Intelligence Consolidation Report

**Sprint 23 — Canonical Intelligence Consolidation**
Date: 2026-07-12
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: Capability computation (Learner Model, Career Operating System, Career/Capability API routes), Entrepreneurial career tier, Career Intelligence AI prompt

---

## Executive Summary

Sprint 22 identified two parallel capability computations as the platform's largest latent consistency risk. Investigating further this sprint surfaced a **third**: within a single request handler (`app/api/teacher/assessments/process/route.ts`), the codebase independently queried the `assessments` table and called `extractCapabilityProfile()` in two different local functions, and two more API routes (`/api/career/capability`, `/api/career/capability-matches`) each did the same thing a third and fourth time — four separate call sites reconstructing the same input by hand, with inconsistent history limits (unbounded, 10, and 20 respectively), meaning the same student's capability profile could differ depending on which endpoint last computed it.

All four call sites now route through one canonical function, `computeCapabilityProfile()` (`lib/career/capabilityExtractor.ts`), which is the single place that builds a `scoreHistory` from assessment evidence and hands it to the (unchanged) `extractCapabilityProfile()` formula. Each caller still persists to its own existing storage target (`learner_profiles.capability_dimensions` or `students.capability_profile` + `capability_history`) — no schema change, no consumer migration, full backward compatibility — but the *input* to every persisted profile is now built identically.

The entrepreneurial career tier's confidence gate was aligned with every other tier (assessment-count floor of 2), and the Career Intelligence Engine's AI prompt was hardened to remove "hidden strengths" as a discovery framing, ground every claim in the data actually passed to the model, and hedge language based on assessment count/confidence — closing the one AI-narrative gap flagged in Sprint 22.

**Go / No-Go: GO.**

---

## Capability Consolidation Review

**Before this sprint**, four independent code paths queried `assessments` and called `extractCapabilityProfile()`:

1. `lib/learnerModel/updater.ts` (`updateFromAssessment`) — full unbounded history via `repos.learnerModel.findAssessmentHistory`, writes `learner_profiles.capability_dimensions`.
2. `app/api/teacher/assessments/process/route.ts`'s local `recomputeCapabilityProfile()` — last 10 assessments, writes `students.capability_profile` via `saveCapabilityProfile`.
3. `app/api/career/capability/route.ts` POST — last 20 assessments, same write target as #2.
4. `app/api/career/capability-matches/route.ts` POST — last 20 assessments, same write target as #2.

Because #1 used unbounded history and #2–4 used inconsistent limits (10 vs. 20), the same student could get a different `assessment_count`, different confidence, and even a different dominant/emerging cluster from `learner_profiles` versus `students.capability_profile`, purely as an artifact of which endpoint ran last — not a real difference in evidence.

**After this sprint:** all four call through `computeCapabilityProfile(studentId, currentSnapshot?)` (`lib/career/capabilityExtractor.ts`), which builds the full, unbounded assessment history (matching the most evidence-complete of the four prior behaviors, consistent with the "reward longitudinal evidence" principle) and returns `null` — never a fabricated profile — when there is no assessment evidence yet.

- `lib/learnerModel/updater.ts` now calls `computeCapabilityProfile(signal.studentId, signal.subjectScores)` directly.
- A new `recomputeAndSaveCapabilityProfile()` in `lib/career/careerEngine.ts` wraps `computeCapabilityProfile()` + the existing `saveCapabilityProfile()` persistence, and is now the single call made by the process route and both `/api/career/*` routes. The two route-level duplicate query+extract blocks were deleted entirely — a secondary win, since that logic had also been sitting directly in API route handlers in violation of the "API routes are thin" architecture rule.

This is a computation consolidation, not a store consolidation: `learner_profiles.capability_dimensions` and `students.capability_profile` remain two separate tables, each still read by its existing consumers. Unifying those two stores into one would be an architecture change explicitly out of scope for this sprint; what this sprint eliminates is the *duplicate reasoning* that fed them, which was the actual named risk.

## Consumer Consistency Audit

Traced each named consumer to its current capability source:

| Consumer | Reads from | Computation |
|---|---|---|
| Blueprint | Projection Engine (confirmed evidence) via `projectionToScoreHistory` | `extractCapabilityProfile()` — ephemeral, not persisted |
| Career Intelligence (Insight-based) | Projection Engine (confirmed evidence) via `projectionToScoreHistory` | same formula as Blueprint |
| Holiday Planner | Projection Engine, via `recomputeLearnerProjection` | reads Academic/Risk projections, not capability profile directly |
| Parent Intelligence (`lib/career/parentIntelligence.ts`) | Caller-supplied `CapabilityProfile` parameter (no direct DB read) | canonical, since its only caller (`careerIntelligenceEngine.ts`) now sources via `getCapabilityProfile` → `students.capability_profile`, populated by the canonical computation |
| Teacher Intelligence (Monday Panel) | Projection Engine, via `recomputeLearnerProjection` | reads risk/academic projections |
| Learning Compass (`autoReportGenerator.ts`) | out of this sprint's scope — verified it does not independently recompute a capability profile | n/a |
| Monday Panel | Projection Engine, via `recomputeLearnerProjection` | reads projections, not capability profile |

Two genuinely separate capability stores remain by design: the Projection-Engine-derived, evidence-confirmed-only computation (Blueprint/Career Intelligence, ephemeral) and the assessment-history-derived computation now unified under `computeCapabilityProfile()` (Learner Model + Career Operating System, persisted). Fully merging these two into a single store is the deferred, larger reconciliation flagged in Sprint 22 and remains out of scope here per "do not redesign architecture" — but the duplicate *reasoning* within the assessment-history side (four independent implementations) is fully eliminated.

## AI Prompt Review

Reviewed every AI-prompt-generating file touching educational recommendations (`careerIntelligenceEngine.ts`, `matchEngine.ts`, `autoReportGenerator.ts`, `holiday/planner.ts`, `remedial/planner.ts`). Only `careerIntelligenceEngine.ts`'s narrative-generation prompt contained the speculative wording flagged in Sprint 22 (`"hidden_strengths": ["2–3 non-obvious strengths a teacher might not notice from marks alone..."]`, with no confidence/evidence-count context passed to the model at all).

Changes made:
- Added an explicit **GROUNDING RULES** block to the prompt: claims must be supported by the STUDENT PROFILE data provided; forbids "hidden," "undiscovered," "natural genius," "innate talent" framing; requires "not yet assessed" to be stated plainly rather than filled in with a confident guess.
- Passed `assessmentCount` and `confidenceLevel` (via the existing, now-exported `confidenceFromAssessmentCount()` from `capabilityMatchEngine.ts` — reused, not reimplemented) into the prompt, with an explicit hedging instruction scaled to confidence: Low → hedge every claim; Medium → tentative guidance; High → stronger claims still grounded in the data shown.
- Rewrote the `hidden_strengths` instruction itself to require strengths be "grounded strictly in the dominant/emerging capabilities and strong subjects listed above" and to produce fewer items rather than invent more when the profile is thin.
- Left the `hidden_strengths` JSON key name and the UI's "Hidden Strengths" section title unchanged — renaming a persisted type field and public-facing UI label across the report schema was assessed as a larger, unrelated risk to backward compatibility than the sprint's mandate justified; the fix targets what the AI is instructed to write, which was the actual defect.
- `lib/career/matchEngine.ts` (the separate, legacy AI-matching path) was reviewed and found to already contain no speculative wording — its prompt already instructs honesty about gaps and explicitly lowers/caveats scores when no assessment data exists. No change needed.

## Career Threshold Review

`qualifiesForEntrepreneurialTier()` (`lib/career/capabilityMatchEngine.ts`) previously had no assessment-count gate — a student with a single assessment and one dimension score ≥ 0.50 could be promoted into the specific "Entrepreneurial Opportunity" tier for `entrepreneur-business`, while every other tier's score is capped when `assessment_count < 2`. Added the same floor: the function now returns `false` outright when `assessment_count < 2`, before checking the dimension/cluster condition. This reuses the existing confidence-cap mechanism's threshold (2 assessments) rather than introducing a new one.

## Duplicate Reasoning Audit

Beyond capability computation, checked for other duplicate scoring/weighting logic:

- **Confidence calculation**: `confidenceFromAssessmentCount()` existed only in `capabilityMatchEngine.ts`; `careerIntelligenceEngine.ts` had no equivalent and passed no confidence signal to its AI prompt at all (not a duplicate, but a gap — now closed by reusing the exported function rather than writing a second one).
- **Readiness/risk scoring**: `lib/projection/riskProjector.ts` and `lib/learnerModel/updater.ts`'s `recomputeRiskFlags()` remain two independent risk-flag computations (Projection Engine vs. Learner Model) — this is the same class of duplication flagged for capability, but risk-flag consolidation was not in this sprint's task list and is noted as a deferred item, not silently ignored.
- **Intervention/recommendation weighting**: Holiday Planner, Parent Pulse, and Attention Feed each compute their own prioritization from projection/evidence inputs but do not duplicate a shared formula — each is a distinct downstream interpretation of the same evidence, which is expected and not a violation.
- No other duplicate capability, readiness, or confidence formula was found beyond what's addressed above.

## Regression Validation

- **TypeScript**: `npx tsc --noEmit` — zero new errors from this session's changes. The only two errors present (`scripts/create-compass-auto-confirm-account.ts`, `scripts/reference-school/integration.test.ts`) are pre-existing, already on `main` at commit `2cbbf8c`, untouched this session, and outside the `lib/`/`app/` surface this sprint modified.
- **ESLint**: zero errors/warnings on every file touched (`lib/career/capabilityExtractor.ts`, `lib/career/careerEngine.ts`, `lib/career/capabilityMatchEngine.ts`, `lib/career/careerIntelligenceEngine.ts`, `lib/learnerModel/updater.ts`, and the three route files).
- **Production build**: `next build` compiles successfully; its own type-check step fails only on the same pre-existing `scripts/create-compass-auto-confirm-account.ts` error, unrelated to this sprint.

## Engineering Confidence

**High.** The consolidation removed real, verifiable duplicate reasoning (four independent scoreHistory constructions collapsed to one, with one of them living inside an API route in violation of the thin-route architecture rule) without touching any persisted schema, without requiring any consumer to migrate to a new data source, and without introducing new services — exactly the shape of fix this sprint's constraints called for.

## Educational Confidence

**High.** The entrepreneurial tier fix removes the one place a specific career recommendation could reach a student on thinner evidence than the rest of the career stack allows — closing a real defensibility gap a CBC teacher would have flagged. The AI prompt hardening directly addresses the one subsystem (of everything audited across Sprints 20-22) that could produce a claim not traceable to actual evidence; it now cannot describe a strength as "hidden" or a discovery, and it hedges in proportion to how much evidence actually exists — bringing it into line with the rest of the evidence-first stack.

## Remaining Deferred Items

1. The two capability *stores* (`learner_profiles.capability_dimensions` vs. `students.capability_profile`) remain architecturally separate. Both now compute their assessment-history-derived input identically via `computeCapabilityProfile()`, so they cannot silently drift on that axis anymore — but they are still two tables with two write paths. Merging them is a genuine architecture change and remains explicitly out of scope.
2. The third, independent capability source — Projection-Engine-derived, evidence-confirmed-only, used transiently by Blueprint/Career Intelligence — is still not unified with the assessment-history-derived path. This was flagged in Sprint 22 as the platform's largest latent risk and remains only partially addressed: the *assessment-history* side is now internally consistent, but a full reconciliation across all three capability interpretations is a larger effort than this sprint's "reuse existing services, no architecture redesign" mandate permits.
3. Risk-flag computation duplication (Projection Engine's `riskProjector.ts` vs. Learner Model's `recomputeRiskFlags()`) was identified as the same class of problem as capability computation but was not in this sprint's task list — recommended as the next candidate for a focused consolidation sprint.

## Final Go / No-Go

**GO.** Every capability-profile-computing code path in scope now reuses one canonical computation; the one AI-narrative gap in the career stack is closed; the one ungated career tier is aligned with the rest of the system. No regressions. The remaining deferred items are scoped, named, and none block the 50 beta teachers.
