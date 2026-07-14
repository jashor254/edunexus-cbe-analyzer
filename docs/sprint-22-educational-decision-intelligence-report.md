# EduNexus — Educational Decision Intelligence Report

**Sprint 22 — Educational Decision Intelligence**
Date: 2026-07-12
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: Evidence Domain, Projection Engine, Blueprint, Career Intelligence, Holiday Planner, Parent Pulse, Attention Feed / Monday Panel

---

## Executive Summary

EduNexus's decision-making stack is, on the whole, **evidence-first by construction, not by convention**. The Projection Engine cannot emit a projection without at least one supporting evidence ID (the type system enforces `null` over fabrication), confidence is a real, threaded quantity that changes downstream language and prioritization, and the "missing evidence is not negative evidence" principle is honored consistently across every layer audited — including the two places most likely to violate it under time pressure (holiday auto-publish, attention-feed tiering with zero data).

The gaps that exist are concentrated in three places:

1. **One AI-narrative subsystem (`careerIntelligenceEngine.ts`) breaks the evidence-first discipline** that governs the rest of the career/blueprint stack — it lets DeepSeek invent "hidden strengths" and writes confident-sounding prose regardless of how sparse the underlying profile is.
2. **A second, independently-computed capability pipeline** (`learnerModel/updater.ts`, feeding `learner_profiles.capability_dimensions`) exists alongside the Projection-Engine-based pipeline that Blueprint and Career Intelligence use. They currently agree because they call the same formula, but they are not the same computation — this is the platform's single largest latent risk for contradictory recommendations about the same learner.
3. **One ungated career tier** (`qualifiesForEntrepreneurialTier`) can promote a very specific career claim off a single assessment, bypassing the confidence caps applied everywhere else in the career engine.

None of these are architectural — all are fixable within existing services, none require new reasoning engines or infrastructure, consistent with this sprint's constraints.

**Go / No-Go: GO**, with three deferred fix items tracked below (none pilot-blocking for 50 beta teachers).

---

## Decision Traceability Review

Every projector (`academicProjector`, `capabilityProjector`, `capabilityV2Projector`, `knowledgeProjector`, `knowledgeV2Projector`, `behaviourProjector`, `riskProjector`, `growthProjector`, `trendProjector`, `completenessProjector`) carries an explicit `evidenceIds`/`supportingEvidenceIds` field on its output — not merely re-derivable, actually stored. `AcademicValue.history` goes further, keeping per-datapoint `evidenceId`, `score`, and timestamp.

Downstream, Blueprint and Career Intelligence both route through the same `projectionAdapters.ts` → `extractCapabilityProfile` path, so their traceability is inherited from the Projection layer. Holiday Planner's `AdaptiveTask.observation` is rendered into the printable pack with an explicit "Why this" line tied to the evidence. Attention Feed's prerequisite-gap alerts carry the exact percentage/count of affected class members.

The one traceability soft spot: `recompute.ts` persists `supporting_evidence_ids` at the top level but nests richer sub-structure (e.g. per-flag `RiskFlag.evidenceIds`, per-dimension `CapabilityV2Score.evidenceIds`) inside an opaque JSON `value` column rather than a queryable join table. Fine for replay and UI rendering; weaker if we ever need cross-learner evidence-contribution analytics.

## Explainability Assessment

Strong: `RiskFlag.reason`, `Insight.evidence[]` (mandatory on every Blueprint/Career Intelligence claim), Holiday Planner's `observation` field, and the confidence-caveat sentences auto-appended in `capabilityMatchEngine.ts`.

Gap: no projector itself emits a "why"/"what would raise confidence" field — that synthesis happens once, well, in Blueprint (`blueprint.ts:232`), but Career Intelligence, Holiday Planner, and Parent Pulse each build their own explanatory text ad hoc rather than inheriting a shared explanation object from the Projection layer. This is a consistency risk, not a correctness bug — every consumer currently does produce an explanation, they just aren't guaranteed to by the type system the way `evidenceIds` is.

Career match tier decisions (`capabilityMatchEngine.ts:337`) have a second gap: the raw `alignment_score` vs. threshold arithmetic that actually determines "primary match" vs. "explore" is not itself included in the `evidence[]` array shown to the teacher — a teacher can't see "0.62 vs. 0.70 threshold" without separately inspecting `dimension_scores`.

## Educational Defensibility Review

Judged as a Kenyan CBC classroom teacher:

- Blueprint and Career Intelligence (Insight-based path) text is grounded — e.g. `"mathematics: 3/4"`, `"Prioritise remedial time on {gaps[0]} before introducing dependent content"` — a teacher can act on this immediately.
- `careerIntelligenceEngine.ts`'s `DIM_HIDDEN_STRENGTH_DESC` strings ("Quietly strong at breaking complex problems into smaller, manageable steps — a skill most people only develop much later") are static per-dimension prose that reads as personalized but isn't — any two students with the same dominant dimension get identical "hidden strength" text. A teacher who sees this for two different students in the same week will notice the templating and lose trust in the "hidden strength" framing specifically.
- The DeepSeek prompt in the same file explicitly instructs the AI to invent "2-3 non-obvious strengths a teacher might not notice from marks alone" — this is the one place in the entire audited surface where capability claims are AI-hallucinated rather than evidence-templated. It directly contradicts the evidence-first mandate that governs every other consumer.
- Parent-facing copy is uniformly defensible — warm, concrete, appropriately hedged (see Parent Communication Review below).

## Recommendation Consistency

Blueprint and Career Intelligence (proper, Insight-based path) cannot contradict each other by construction: both call `extractCapabilityProfile` off the same `projectionToScoreHistory` output.

However, `lib/learnerModel/updater.ts`'s `updateFromAssessment` computes `scoreHistory` from a **separate** query (`findAssessmentHistory` against the raw assessments table) and writes to `learner_profiles.capability_dimensions`, which is read independently by `growthEngine.ts`, `parentIntelligence.ts`, and `careerIntelligenceEngine.ts`'s `getCapabilityProfile`. This is a second, parallel capability pipeline. It currently agrees with the Projection-based pipeline because both apply the same downstream formula, but they consume potentially different underlying evidence sets (different filtering, different completeness windows). This is the platform's most plausible path to a Blueprint saying "growing in numeracy" while Career/Parent Intelligence says something else about the same dimension for the same student in the same week. **This should be reconciled onto one pipeline** — not by building a new engine, but by pointing `updateFromAssessment` at the same Projection Engine output Blueprint/Career Intelligence already use.

## Intervention Review

Holiday Planner intervention scaling is proportional but coarse:
- Session count is binary (1 vs. 2) gated only on `confidence === 'Low'` — Medium and High confidence gaps get identical intensity.
- `priorityGaps.slice(0, 2)` hardcodes exactly two topic-weeks regardless of how many gaps exist or how severe they are — a student with 5 severe gaps and a student with 1 mild gap get the same-shaped plan.
- Week-2 parent action text does not re-check confidence the way Week-1 does — an inconsistency in hedging discipline within the same planner.

None of these produce an incorrect or unsafe recommendation — they produce a plan that's less finely graduated to evidence severity than the confidence-aware language elsewhere would suggest is possible. Reasonable to defer.

Attention Feed / Monday Panel tiering is properly evidence-quantity-gated (`tier.ts` thresholds on assessment count / weeks-of-signal) — a teacher literally cannot reach a richer tier without the evidence to back it. `panel.ts`'s `suggestAction` falls back to substring-matching `topFlag.reason.includes('declining')` rather than reading a structured flag type — brittle, but not incorrect today.

## Parent Communication Review

Judged as a Kenyan parent without education-jargon background — overall strong:

- Good: `"Ask ${firstName} to explain ${topic} in their own words — even 5 minutes counts."` — warm, concrete, actionable.
- Good: `"Current evidence is limited here — ask ${studentName} to explain ${topic} in their own words, just to see how it lands. No pressure."` — appropriately hedged, non-alarmist.
- Good: `"Thank you for supporting ${firstName} this holiday!"`
- Borderline: `"Please speak with ${firstName}'s teacher this week — we have flagged some areas that need attention."` — "flagged" is mild jargon but acceptable given the seriousness of a critical-risk case.
- Weakest: Parent Pulse's bare `"Needs attention: ${concern}"` line is terse and clinical relative to the warmth applied elsewhere in the same message builder — worth a copy pass, not a redesign.

Critical-risk parent messaging is intentionally **not** softened by confidence level (a documented, deliberate choice in `parentPulse/builder.ts`) — defensible, since corroborated risk flags already require multiple evidence sources before they reach "critical."

## Career Decision Review

Career maturity is mostly sound: Junior grades (7-9) receive broad families, never a ranked single career at the top level, and confidence-based score caps (`< 2 assessments → max 0.65`, `< 3 → max 0.80`) prevent sparse evidence from reaching "primary match" tier (0.70+).

Two gaps:
1. Junior family output still surfaces 1-3 named `exampleCareerTitles` drawn from the top-scoring match under the hood — framed as "explore examples," but the underlying selection is still ranked and personalized, softly undercutting "never surfaces a ranked recommendation for Junior."
2. `qualifiesForEntrepreneurialTier` triggers on `raw_score >= 0.50` OR cluster membership with **no assessment-count gate at all** — a student with exactly one assessment and one high creative-thinking score can be promoted into a specific "Entrepreneurial Opportunity" career tier, bypassing the confidence caps that govern every other tier. This is the one place in the career stack where a specific career claim can surface on genuinely thin evidence, for both Junior and Senior students.

## Confidence Integration Review

Confidence is a real, load-bearing quantity, not decorative:
- `lib/intelligence/confidence.ts` computes confidence as min(identity-match, field-validation, trust-tier ceiling) — AI-inferred/self-report sources can never auto-confirm past 60%.
- `coverage.ts` confidence = mean(evidence confidence) × count-factor × conflict-factor (halved on contradiction).
- Blueprint, Career Intelligence, Holiday Planner, and Parent Pulse all branch on confidence in observable ways — contradicted risks get downgraded to "Low" confidence explicitly rather than hidden; `capabilityMatchEngine.ts` appends a plain-language confidence caveat sentence whenever confidence isn't High.

One real gap: projection-level confidence in `coverage.ts` does not multiply in evidence **freshness** — it's reported as a separate `freshnessDays` field alongside confidence rather than folded into it. Two projections built from the same count/quality of evidence, one from last week and one from two years ago, currently report identical confidence. Freshness does affect Holiday Planner language qualitatively but not the numeric confidence score itself.

The one subsystem where confidence-awareness is absent: `careerIntelligenceEngine.ts`'s DeepSeek narrative prompt has no instruction to hedge based on assessment count, and generates full-confidence-sounding prose even when the capability profile passed in is `null`.

## Regression Validation

- **TypeScript**: `npx tsc --noEmit` shows 2 pre-existing errors, both in `scripts/` (a one-off account-creation script and a reference-school test fixture), both already present on `main` at commit `2cbbf8c` and untouched by anything relevant to this sprint. No errors in any audited `lib/` path.
- **ESLint**: Zero errors/warnings across `lib/projection`, `lib/intelligence`, `lib/learnerIntelligence`, `lib/career`, `lib/holiday`, `lib/parentPulse`, `lib/attentionFeed`, `lib/learnerModel`.
- **Production build**: `next build` compiles successfully; the build's own type-check step fails only on the same pre-existing `scripts/create-compass-auto-confirm-account.ts` error noted above — a build script issue unrelated to any app/lib code path or to this sprint's scope, not a regression introduced during this audit (no files were modified in this session).

No code was changed during this sprint — this was an audit-only pass per the mission constraints (no new reasoning engines, no architecture changes).

## Engineering Confidence

**High.** The Evidence Domain and Projection Engine are deterministic, pure, evidence-gated by the type system itself, and already threading confidence through every downstream consumer that was audited. The gaps found are narrow and named, not systemic.

## Educational Confidence

**High, with one reservation.** As a CBC educator, the Insight-based Blueprint/Career Intelligence/Holiday Planner/Parent Pulse stack would earn a teacher's trust — recommendations are concrete, appropriately hedged, and traceable. The reservation is `careerIntelligenceEngine.ts`'s AI-narrative layer, which — if a teacher or parent ever sees the same "hidden strength" sentence for two different students — will visibly undermine confidence in the whole career feature, even though the rest of the stack doesn't have this problem.

## Remaining Deferred Items

1. Reconcile `learnerModel/updater.ts`'s independent capability computation onto the same Projection-Engine-derived score history that Blueprint/Career Intelligence already use, eliminating the two-pipeline consistency risk.
2. Bring `careerIntelligenceEngine.ts`'s DeepSeek narrative layer (hidden-strengths prompt, confidence-blind tone) into line with the evidence-templated, confidence-hedged discipline used elsewhere — either ground its claims in the same `Insight.evidence[]` structure or retire the free-form prompt in favor of the existing Insight-based engine.
3. Add an assessment-count gate to `qualifiesForEntrepreneurialTier` consistent with the caps applied to every other career tier.
4. (Lower priority) Fold evidence freshness into `coverage.ts` confidence numerically rather than reporting it as a separate field; graduate Holiday Planner session/topic-count scaling beyond its current binary/fixed-2 buckets; replace `panel.ts`'s `reason.includes('declining')` string-matching with a structured flag-type check.

None of these are pilot-blocking for the 50 beta teachers; all are addressable within existing services with no new infrastructure.

## Final Go / No-Go

**GO.** EduNexus's decision-intelligence layer meets the bar: explainable, evidence-backed, confidence-aware, and practical for real Kenyan CBC classrooms. The deferred items above are tracked improvements, not blockers.
