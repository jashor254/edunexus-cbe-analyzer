# EduNexus — Educational Explainability & Traceability Audit

**Sprint 26 — Educational Explainability & Traceability**
Date: 2026-07-12
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: audit-only, no code changed, no new scoring/intelligence introduced. Governed entirely by the Educational Constitution ([[Sprint 25]], `docs/sprint-25-educational-constitution-and-migration-strategy.md`) — every finding below is graded against specific Articles, not general code quality.

---

## 1. Explainability Audit

Traced every user-facing recommendation across eight subsystems, file:line verified. Full per-subsystem trace detail is in the research appendix below (§12); this section summarizes what was found.

**Blueprint** is the platform's strongest explainability surface. Every claim is an `Insight` (`observation`/`evidence`/`confidence`/`action`), confidence is genuinely returned, and `BlueprintEvidenceSummary` (`lib/learnerIntelligence/blueprint.ts:211-238`) is the one place in the platform that explicitly states evidence used, freshness, and *what's still missing* — a direct, structural implementation of Article II. Its one gap: `Insight.evidence` is human-readable text, not queryable evidence-record IDs, everywhere except the risk-flag path (`blueprint.ts:163`).

**Career Intelligence** is two subsystems wearing one name, with opposite explainability grades. `/api/career/capability-matches` returns real confidence per match and is Article IX compliant. `/api/career/intelligence-report` computes `assessmentCount`/`confidenceLevel` specifically to ground its AI prompt (`careerIntelligenceEngine.ts:589-590`) — then **never returns either field**, so the AI-authored narrative a parent reads has no attached, verifiable confidence at all. This is the clearest confirmed instance of "grounding computed, then discarded before reaching the reader" in the audit.

**Holiday Planner** surfaces a real `evidence_confidence` field, correctly distinguishing null (no gaps) from Low (Article II compliant) — but the underlying evidence IDs are computed one function call away (`lib/adaptiveLearning/recommend.ts:190`) and never threaded into what the API returns. Its AI enrichment step (`enrichPlanWithAI`, `holiday/planner.ts:378-427`) is not told the evidence volume/confidence behind the gap it's writing about, and can silently overwrite an already-correctly-hedged deterministic sentence with an ungrounded one — a live Article VI risk.

**Parent Pulse** computes real confidence (`builder.ts:46`, from Projection) and uses it correctly to choose between hedged/unhedged sentence templates — a genuine, if invisible, Article III implementation. But the function returns a bare `string`; nothing structured ever reaches an API response, so there is no code path by which a teacher could inspect why a given Pulse message said what it said.

**Monday Panel** is the audit's most significant finding. Its API response mixes two independently-formulated risk systems in the same payload: Projection's `overallRiskLevel` (badge) and Learner Model's `risk_flags` (detail text) — a contradiction already named in Sprint 24. This sprint adds the sharper finding: **neither half is actually traceable even on its own terms.** `riskProjector.ts` computes real `confidence` and per-flag `evidenceIds`, but `route.ts:82` discards everything except the bare risk-level string before it reaches the response. The Learner-Model half is worse — its `RiskFlag` type (`learnerModel/types.ts:19-26`) has no evidence-id field *at all*, so it cannot be made traceable without a schema change, not just a code fix.

**Learning Compass**'s durable evidence chain is exemplary — trust-tier capping, a hard `throw` against auto-confirming a mastery claim (`compass/autoConfirm.ts:56`), lifecycle-gated review. But this sprint found a **live gap the durable chain doesn't cover**: the immediate gamification feedback shown to the student — XP and "level up" — is computed directly from the AI's own uncorroborated self-assessment (`app/api/learn/end/route.ts`) and shown to the child in the same session, with zero confidence or hedge, before any teacher review. The platform's most disciplined Article VII enforcement (Compass evidence) and its least disciplined (Compass rewards) live in the same feature.

**Interventions** split cleanly along the fault line Sprint 24 already named: Adaptive Learning (`lib/adaptiveLearning/recommend.ts`) is the audit's best example of Constitution-compliant code — real evidence IDs, real confidence, `insufficientEvidenceInsight()` instead of fabrication — while Remedial Planner's types (`lib/remedial/types.ts`) carry no confidence or evidence-id field whatsoever.

**Progress summaries** are internally inconsistent in the expected way: raw school report cards (`lib/core/report-cards.ts`) need no confidence concept since they're literal fact aggregation; the legacy Academic Clinic report uses genuinely good hedged prose but is built on a non-canonical readiness formula (Constitution Article XI's already-named gap) and surfaces no evidence IDs; Parent Pulse (counted here too) hedges well in text but, as above, has no structural trace.

---

## 2. Traceability Matrix

| Subsystem | Evidence IDs surfaced | Projection or Learner Model used | Confidence surfaced | Teacher-inspectable | Plain language | Fact vs. interpretation split | States uncertainty when thin |
|---|---|---|---|---|---|---|---|
| Blueprint | Partial (risk-flag path only) | Projection | Yes | Mostly | Yes | Yes | Yes |
| Career: capability-matches | No (descriptive text) | Projection-fed | Yes | Partial | Yes | Yes | Yes |
| Career: intelligence-report | No | Projection-fed, computed then dropped | **No** | **No** | Mixed (AI text good, structure absent) | Partial | Not verifiable by reader |
| Holiday Planner | **No** (computed, not threaded) | Projection | Yes | Partial | Yes | Yes | Yes (deterministic path); no (AI enrichment path) |
| Parent Pulse | No | Projection | Internal only (shapes text, not returned) | **No** | Yes | Yes | Yes (in text) |
| Monday Panel (batch) | **No** | Both, mixed, unreconciled | **No** | **No** | Yes | No | No |
| Attention Feed (live path) | No (reason text only) | Projection | Yes | Partial | Yes | Partial | No |
| Learning Compass — durable evidence | Yes | Evidence Domain | Yes (trust-tier capped) | Yes | N/A (backend) | Yes | Yes (lifecycle-gated) |
| Learning Compass — XP/level-up UI | **No** | Neither — raw AI self-assessment | **No** | **No** | Yes (but misleading) | **No** | **No** |
| Adaptive Learning | Yes | Projection | Yes | Yes | Yes | Yes | Yes |
| Remedial Planner | **No** | Raw marks (bypasses Projection except critical-gate) | **No** | **No** | Partial | Partial | No |
| Report cards (core) | N/A (raw fact) | N/A | N/A | Yes (by construction) | Yes | Fact-only | N/A |
| Academic Clinic report (legacy) | No | Legacy `pathwayCalculator.ts` (non-canonical) | Yes | Partial | Yes | Yes (hedged prose) | Yes |

**Bolded No/None cells are the audit's confirmed "cannot answer 'why am I seeing this'" list**: Career Intelligence Report, Holiday Planner's evidence-ID trace, Parent Pulse's structural trace, Monday Panel (both the batch response and the underlying Learner-Model `RiskFlag` type), Compass's immediate reward UI, and Remedial Planner.

---

## 3. Constitution Compliance Report

| Article | Status platform-wide | Confirmed violations this sprint |
|---|---|---|
| I — No projection without evidence | **Upheld** at the canonical layer (Projection Engine, Adaptive Learning, Blueprint) | None new; legacy formulas (Academic Clinic, `pathwayCalculator.ts`) remain outside this guarantee, per Sprint 25 §4 |
| II — Missing evidence ≠ poor performance | **Upheld** everywhere checked (`isPlaceholder`, `insufficientEvidenceInsight`, Holiday Planner's null-not-zero `evidence_confidence`) | None found |
| III — Confidence ≠ ability, shown separately | **Inconsistent.** Computed correctly almost everywhere; *returned* to the reader in fewer than half of surfaces | Career Intelligence Report, Parent Pulse (structural), Monday Panel, Remedial Planner all compute confidence-equivalent signals internally and drop them before the response |
| IV — Growth over isolated performance | **Upheld** in every trend-claiming code path checked (`detectTrend()`, corroboration requirements) | None found |
| V — Risk predicts support, not worth | **Upheld** in labeling (`watch`/`at_risk`/`critical`, action-oriented text) | Monday Panel's flag text ("X's performance is declining") reads as settled fact with no confidence attached — not a worth-judgment violation, but a confidence-transparency one that weakens Article V's intent |
| VI — AI explains, never invents | **Mostly upheld** at the prompt-engineering level (grounding rules in `careerIntelligenceEngine.ts:466`) | **New finding**: `holiday/planner.ts`'s `enrichPlanWithAI()` sends no evidence-volume signal to the model at all — the one AI call in the audit with no grounding-rule pattern applied, unlike Career Intelligence's hardened prompt |
| VII — Evidence needs corroboration before claimable truth | **Upheld** in the durable Evidence Domain chain | **New finding, most significant of this sprint**: Compass's immediate XP/level-up feedback bypasses this entirely — a single AI self-assessment becomes a reward-bearing claim shown to the student in the same session, with no confidence, no hedge, and no relationship to the trust-tiered evidence record building in parallel |
| VIII — Teacher approves before parent sees | **Upheld** (Holiday Planner publish gate unchanged since Sprint 25, confirmed still in place) | None found |
| IX — Every recommendation traceable to evidence | **Partially upheld.** Strong in Blueprint/Adaptive Learning; absent in Monday Panel, Remedial Planner, Career Intelligence Report, Parent Pulse | See Traceability Matrix bolded cells |
| X — Career guidance is possibility, not destiny | **Upheld** in framing language; not undermined by this sprint's findings | None found |
| XI (self-critical) — a number without a name is not neutral | **Reaffirmed and extended.** Sprint 25 named three disagreeing readiness formulas and two risk-flag systems as the platform's live Article XI gap. This sprint adds: even where only *one* formula is in play, dropping its confidence/evidence before the response is the same violation in miniature — a single, correctly-computed number presented with no way to check it is still "a number without a name" | Monday Panel, Career Intelligence Report, Remedial Planner |

---

## 4. Teacher Explainability Score

**48 / 100 — Medium-Low.**

Scored on structural traceability (can a teacher inspect evidence IDs/confidence from what the API actually returns), since teachers are the audience most likely to need to defend a recommendation to a parent or act on it professionally. Blueprint and Adaptive Learning score near-full marks individually, but the two surfaces a teacher opens most often for triage — **Monday Panel and Remedial Planner** — are the audit's weakest, with no evidence-id or confidence field reaching either response. A teacher today can confidently explain a Blueprint insight or an Adaptive Learning task; a teacher cannot currently explain *why* Monday Panel flagged a specific student, or *why* Remedial Planner grouped a student into a given intervention band, beyond re-deriving it by hand from raw marks.

## 5. Parent Explainability Score

**62 / 100 — Medium.**

Scored on plain-language and hedged-prose quality, since parents consume WhatsApp messages and PDF reports, not API responses — raw evidence IDs are the wrong deliverable for this audience. Blueprint's parent action, Holiday Planner's parent summary, and Parent Pulse all correctly translate confidence into hedged, honest language ("worth keeping an eye on... based on limited evidence so far"). The one confirmed parent-facing failure is the Career Intelligence Report: its AI-authored narrative sections read as confident, personalized prose with no relationship — visible or otherwise — to how much evidence backs them, which is exactly the failure mode Article VI was hardened against in Sprint 23, just one layer further from the prompt than that fix reached.

## 6. Student Explainability Score

**40 / 100 — Low-Medium.**

Scored on whether a learner-facing claim is honest about its own certainty, since children are the most trust-vulnerable audience in the platform. Blueprint's learner action is fine. The score is dragged down by a single, concentrated finding: **Compass's XP/level-up feedback is the most learner-facing recommendation surface in the entire platform, and it currently makes unhedged mastery-shaped claims to children off one AI self-assessment**, in direct tension with Article VII, which the same subsystem otherwise enforces rigorously in its durable record. A student cannot distinguish "the AI thinks you improved" from "your teacher confirmed you improved" — the platform can, internally, but does not say so on screen.

---

## 7. Missing Evidence Paths

Concrete instances where evidence/confidence is **computed but not returned** — the fix in every case is threading an existing value through, not computing anything new:

1. `careerIntelligenceEngine.ts:589-590` computes `assessmentCount`/`confidenceLevel`, uses them to build the DeepSeek prompt (`:452-456`, `:481`), never adds them to `CareerIntelligenceReport` (`career/types.ts:583-630`).
2. `careerIntelligenceEngine.ts`'s `buildOpportunityLandscape()` (`:288-332`) maps `CapabilityCareerMatch.confidence` into `OpportunityEntry`/`StretchOpportunityEntry` and silently drops the confidence field in the transformation.
3. `lib/adaptiveLearning/recommend.ts:190` computes real `evidence: projection.academic!.supportingEvidenceIds` inside `buildAdaptiveTask()`; `lib/holiday/planner.ts` consumes this internally to derive `topGapConfidence` but never forwards the IDs into `HolidayPlanData`.
4. `lib/parentPulse/builder.ts:46` computes `knowledgeConfidence` from real Projection data; the function's return type is a bare `string` — there is no structured object for the value to survive into.
5. `app/api/teacher/monday-panel/route.ts:82` reads `riskProjector`'s full `RiskValue` (confidence, per-flag `evidenceIds` computed at `riskProjector.ts:68-75`) and keeps only `.value.overallRiskLevel`.
6. `lib/learnerModel/types.ts:19-26`'s `RiskFlag` has no evidence-id field in its type definition — structurally impossible to trace, not merely dropped in a mapping step.
7. `lib/remedial/types.ts:9-20`'s `RemedialGroup`/`RemedialStudent` likewise carry no confidence or evidence-id field.
8. `app/api/learn/end/route.ts` returns `genuineProgress`/`startingLevel`/`endingLevel` (and the XP they trigger) with no confidence or evidence trace — distinct from the others above because the underlying value was never gated in the first place, not just dropped from the response (see §3, Article VII).

---

## 8. Confidence Transparency Review

| Where confidence is computed | Is it returned to the caller? |
|---|---|
| `riskProjector.ts` (per-flag and overall) | No — discarded in Monday Panel's route |
| `capabilityExtractor.ts` / `computeCapabilityProfile()` | Yes — via `Insight.confidence` in Blueprint, `CapabilityCareerMatch.confidence` in capability-matches |
| `careerIntelligenceEngine.ts`'s `assessmentCount`/`confidenceLevel` | No — used only to shape the prompt |
| `lib/adaptiveLearning/recommend.ts`'s `confidenceFromScore()` | Yes — both in the `Insight` and in Holiday Planner's `evidence_confidence` |
| `parentPulse/builder.ts`'s `knowledgeConfidence` | No structurally — shapes template choice, not returned as data |
| `capabilityMatchEngine.ts`'s `confidenceFromAssessmentCount()` | Yes, in capability-matches; **no**, once mapped into the Intelligence Report |
| Legacy `pathwayCalculator.ts`'s confidence | Yes — `confidenceLevel` field in the Academic Clinic report, but the formula itself is non-canonical (Article XI) |
| Compass's Evidence Domain trust tier | Yes, internally (lifecycle state is queryable) — but never surfaced to the student in the XP/level-up UI, which is the actual point of failure |

The pattern across the platform: **confidence is computed correctly far more often than it is discarded** — the canonical machinery (Projection Engine, `capabilityExtractor.ts`, Evidence Domain) is sound. The gap is almost entirely at the *last mile*, where a route handler or a template-building function keeps the derived text/number and drops the confidence that justified it. This is a narrow, mechanical fix pattern repeated across several subsystems, not eight separate design problems.

---

## 9. Recommended Improvements (ranked by educational value)

No new scoring, no new intelligence models — every item below threads an already-computed value through, adds a field to an existing type, or changes what an existing template says.

1. **Gate Compass's immediate XP/level-up feedback the same way the durable evidence chain already gates mastery claims.** Highest priority — it is the one live, confirmed instance of the platform making an unhedged claim directly to a child. Reuse the existing trust-tier/lifecycle-state concept already computed in `lib/compass/autoConfirm.ts`: show a provisional framing ("Nice work today — your teacher will confirm this soon") until the underlying evidence reaches `auto_confirmed`/`reviewed_confirmed`, rather than an unqualified "Level Up." No new engine — the confidence-equivalent signal already exists one function away.
2. **Thread `assessmentCount`/`confidenceLevel` from `careerIntelligenceEngine.ts` into `CareerIntelligenceReport`'s response type.** The values are already computed for the prompt; this is a type-and-return change, not new computation. Directly closes the audit's clearest "grounded prompt, ungrounded response" gap.
3. **Thread Holiday Planner's already-computed `Insight.evidence` (evidence IDs) from `recommend.ts:190` into `HolidayPlanData`, and pass evidence-volume/confidence into `enrichPlanWithAI()`'s prompt** using the same grounding-rule pattern already proven in `careerIntelligenceEngine.ts:464-468`. Prevents the AI enrichment step from overwriting a correctly-hedged deterministic sentence with an ungrounded one.
4. **Add an `evidenceIds` field to `learnerModel/types.ts`'s `RiskFlag` type, and stop discarding `riskProjector`'s confidence/evidenceIds in `monday-panel/route.ts:82`.** This does not require resolving the Sprint 25 Stage 3 taxonomy-unification decision (which formula is canonical) — it only requires that whichever flag data is shown, its own confidence and evidence travel with it. A smaller, immediately actionable slice of the larger reconciliation work already staged.
5. **Add `confidence`/`evidenceIds` fields to `RemedialGroup`/`RemedialStudent`** (`lib/remedial/types.ts`), copying the exact pattern `lib/adaptiveLearning/recommend.ts` already uses — the sibling subsystem in the same duplicate pair (Constitution matrix item #5) already has the reference implementation.
6. **Give Parent Pulse a structured return type alongside its message string** — `{message, confidence, evidenceIds}` rather than bare `string` — so a future teacher-facing "why did this Pulse say that" view becomes possible without touching the WhatsApp copy itself.
7. **Standardize the `Insight.evidence` field platform-wide to optionally carry real evidence IDs, not only human-readable text** — currently only Blueprint's risk-flag path does this. A template-level convention change across `Insight`-shaped objects (Blueprint, Career, Adaptive Learning), not a new type.
8. **(Documentation, not code)** Explicitly record that report cards, Academic Clinic reports, and Parent Pulse are *intentionally* evidence-ID-free (correct for their audience) versus Monday Panel and Remedial Planner being *unintentionally* so (a teacher tool that should support drill-down but doesn't yet) — folds into Sprint 24's already-deferred item #6 (document which confidence implementation governs which surface).

---

## 10. Final Go / No-Go

**CONDITIONAL GO.**

The canonical chain — Evidence Domain, Projection Engine, Blueprint, Adaptive Learning, and Career Intelligence's `capability-matches` endpoint — is genuinely explainable today: a teacher can trace every claim in these surfaces back to specific evidence and a stated confidence, in language a Kenyan parent can follow. This is real, verified, load-bearing work from Sprints 22–25, and this audit found no regression in it.

The condition: **do not ship new Compass gamification features, and treat item #1 above (XP/level-up gating) as a near-term fix rather than a deferred one.** Every other finding in this audit is a bounded, low-risk, "thread the value through" fix with no product-decision dependency (unlike Sprint 25's readiness/risk-flag unification, which needs one) — but #1 is different in kind: it is a live claim reaching a child with no hedge, in a subsystem the Constitution otherwise governs strictly. The other seven recommended improvements can proceed in any order as ordinary engineering work; #1 is the one item this report asks to be prioritized ahead of unrelated feature work on Compass specifically.

Everything else: **GO as scoped engineering backlog**, no architecture change, no new intelligence model, fully consistent with Sprint 25's mandate to reuse the existing Evidence Domain and Projection Engine rather than build a new explainability layer.

---

## 11. Method note

This sprint delegated the file-level tracing to two parallel research passes (Blueprint/Career/Holiday/Parent Pulse; Monday Panel/Compass/Interventions/Progress Summaries) rather than tracing all eight subsystems sequentially, since this is an audit spanning the full learner-facing surface of the platform and each subsystem's trace is independently verifiable. Every citation in this report was file:line-checked against the current working tree by the research passes, not recalled from prior-sprint memory — Sprint 24's Monday Panel finding was specifically re-verified rather than assumed still true, and found to still hold with a sharper detail (neither taxonomy is independently traceable, not just the two being mixed).
