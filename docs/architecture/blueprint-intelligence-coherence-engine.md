# Blueprint Intelligence Coherence Engine — Phase 4A

**Date:** 2026-07-26
**Scope:** No new educational features, no Blueprint UI redesign, no new AI provider, no new schema. This phase builds a deterministic self-validation layer — a Blueprint "compiler" — that checks whether every claim, recommendation, and action in a composed Blueprint is internally coherent with the learner's own Evidence and Projection, before that Blueprint is shown to anyone.

---

## 1. Executive Summary

**Built:** `lib/learnerBlueprint/coherence/` — a deterministic, rule-based validator with seven rule modules covering the six named coherence areas plus cross-cutting friction detection, a pure orchestrator (`validateBlueprintCoherence()`, no I/O, fully unit-testable), and a thin I/O wrapper (`composeBlueprintCoherence()`) that fetches a learner's approved action items the same way the existing Parent Action Centre cutover already does. Wired additively into `composeBlueprint()`'s return value as a new `coherence: CoherenceReport` field — `blueprint` and `validation` (the pre-existing structural check) are unchanged. The teacher/student Blueprint page (`app/student/blueprint/[learnerId]/page.tsx`) now withholds rendering with an honest message when `coherence.result === 'FAIL'`, reusing the existing `BlueprintStateMessage` component with one new, additive `kind`.

**Proven, not just designed:** run against the real, live reference-school demo learner seeded in Phase 3B, the engine returned `FAIL` and correctly, independently reproduced both real bugs the Phase 4 Educational Intelligence Validation Report found by hand — the single-subject "weakest subject" narrative bug, and the approved action whose rationale contradicts its own learner's Academic Record and Risk sections. See §8.

**20/20 new unit tests pass.** Every pre-existing Blueprint-domain test suite that could be run in this environment (165 pure/mapping tests + integration suites, see §8) passes unchanged. No Projection calculation, no Evidence write path, no Assignment/Compass delivery writer, and no Review writer was touched.

## 2. Blueprint Reasoning Map

Every composer in `lib/learnerBlueprint/` was inspected (Phase 4's audit already did this in depth; this phase re-confirms the exact fields relevant to validation). The reasoning chain this engine checks links of:

```
Evidence (learner_evidence)
  -> Projection (learner_projections, via recomputeLearnerProjection)
    -> Narrative (composeLearningStory, composeCareer/capabilityMatchEngine's buildMatchNarrative)
      -> Recommendation (composeRecommendedNextSteps -> ParentAction[])
        -> Action (blueprint_action_items, proposed/approved via lib/learnerBlueprint/actionPlan/lifecycle.ts)
          -> Review Goal (successIndicator + reviewDate on the same action item)
```

| Composer | Reads | Produces | Owns a claim? |
|---|---|---|---|
| `composeIdentity.ts` | Core `learners` | Identity | No — pure lookup |
| `composeAcademicRecord.ts` | Projection (`academic`, `growth`, `knowledge`) | `AcademicRecordData.bySubject[]`, `overallTrend` | Yes — trend/level per subject |
| `composeRisk.ts` | Projection (`risk`) | `RiskData.flags[]`, `overallRiskLevel` | Yes — risk flags with reasons |
| `composeGrowthTimeline.ts` | Projection (`growth`) | `GrowthTimelineEntry[].trajectory` | Yes — a directional claim |
| `composeLearningStory.ts` | Identity, Academic Record, Learning Compass, Career, Growth Timeline, Risk, raw `capability`/`completeness` Projection | 8 narrative strings, joined into `narrative` | Yes — the richest narrative claim in the Blueprint |
| `composeCareer.ts` / `lib/career/capabilityMatchEngine.ts` | `lib/career/capabilityExtractor.ts` via an anti-corruption adapter | `CareerData.strengthProfile/futureDirection/confidence` | Yes — a career-fit claim |
| `composeRecommendedNextSteps.ts` | Canonical `blueprint_action_items` (preferred) or the legacy `composeParentActions()` selector (fallback) | `RecommendedNextStepsData.actions[]` | Relays a claim already owned by the action item, or synthesizes one from six hardcoded rules |
| `lib/learnerBlueprint/actionPlan/lifecycle.ts` (not a Blueprint composer — the action-item domain itself) | Teacher input (or, if reconnected, `candidateGeneration.ts`) | `blueprint_action_items` rows: `rationale`, `intendedOutcome`, `successIndicator`, `reviewDate`, `evidenceBasis` | Yes — the actual educational decision |
| `lib/learnerBlueprint/actionPlan/candidateGeneration.ts` | Projection, via `buildAdaptiveTask` | An `ActionCandidate`, never persisted by this module itself | Yes, but currently unreachable (§7) |

**Every place a contradiction can occur**, identified by this audit (each maps to a rule in §5):

1. A `SubjectRecord.trend` claiming direction from fewer than 2 evidence points (Projection-internal invariant, re-checked at the Blueprint layer).
2. A `GrowthTimelineEntry.trajectory` claiming a long-term direction from fewer than 2 supporting evidence items.
3. `composeLearningStory`'s `nextConcern` disagreeing with `risk.data.flags` (both derived from the same Projection, rendered independently — nothing keeps them in sync if either composer changes).
4. `composeLearningStory`'s "weakest subject" selector (`describeCapability()`) degenerating to a false claim when the learner has exactly one subject of evidence (§8 — a real, reproduced bug).
5. An approved action's `rationale` asserting a deficiency in a subject the learner's own Academic Record/Risk show is healthy (§8 — a real, reproduced bug).
6. An active Risk flag with no corresponding action anywhere in the approved set.
7. A career narrative asserting confidence the `career.confidence` field itself says is `Low` or absent.
8. An approved action missing a `reviewDate` (no future review condition) or carrying a `successIndicator` too generic to check against evidence later.
9. Two approved actions contradicting or duplicating each other.
10. The fixed `NO_ACTION_COPY` boilerplate rendering identically regardless of whether the learner's evidence is thin or genuinely clean.

## 3. Validation Architecture

```
lib/learnerBlueprint/coherence/
  types.ts                        — CoherenceFinding/CoherenceReport/toCoherenceReport (PASS/WARN/FAIL decision, in one place)
  rules/
    textSignals.ts                 — shared, explicit word-list matchers (no NLP, no LLM)
    evidenceSufficiency.ts         — Rule 1
    narrativeAlignment.ts          — Rule 2
    recommendationAlignment.ts     — Rule 3
    actionAlignment.ts             — Rule 4
    careerAlignment.ts             — Rule 5
    reviewAlignment.ts             — Rule 6
    frictionDetection.ts           — cross-cutting (contradiction/duplication/boilerplate)
  validateBlueprintCoherence.ts    — pure orchestrator (blueprint + actionItems -> report), no I/O
  composeBlueprintCoherence.ts     — I/O wrapper: fetches approved action items, then calls the pure orchestrator
  validateBlueprintCoherence.test.ts — 20 pure unit tests
  index.ts                        — public surface
```

**Why a separate `validation` and `coherence`, never merged:** `lib/learnerBlueprint/validation.ts`'s `validateBlueprint()` (pre-existing, Sprint 12G) checks structural completeness — every section present, an owner declared, metadata well-formed. It is deliberately blind to educational content. `coherence` is the opposite: blind to structure, focused entirely on whether the content that *is* there agrees with itself and with the Evidence/Projection underneath it. A Blueprint can be `validation.valid === true` and `coherence.result === 'FAIL'` at the same time — proven true for the real reference-school demo learner (§8).

**Why the orchestrator is pure:** every rule function takes already-composed data (a `LearnerBlueprint` and a `BlueprintActionItem[]`) and returns `CoherenceFinding[]` — no Supabase client, no network call, anywhere in `rules/*` or `validateBlueprintCoherence.ts`. This is what makes the required 17 test scenarios (§8) each a same-millisecond, hand-built-fixture unit test with zero database dependency, and what satisfies this phase's own instruction: static, explicit rules first, no LLM call to discover a simple contradiction.

**The one I/O seam** (`composeBlueprintCoherence.ts`) reuses an existing read exactly: `repos.blueprintActionItems.listApprovedForLearner()` + `toBlueprintActionItem()`, the same pair `lib/learnerBlueprint/actionPlan/projections.ts`'s `listApprovedParentActionsForLearner()` already uses. No new query, no new table, no new repository method.

## 4. Educational Friction Model

Per the mission's own list, checked and where each is (or explicitly is not) covered:

| Friction type | Covered by | Scope note |
|---|---|---|
| Contradictory recommendations | `frictionDetection.ts` | Two approved actions naming the same subject, one asserting deficiency, one strength |
| Duplicated recommendations | `frictionDetection.ts` | Two approved actions with identical rationale text |
| Unsupported narratives | `narrativeAlignment.ts` (NA1–NA3) | Narrative vs. Risk/Academic Record disagreement |
| Generic explanations repeated across learners | **Partially** — see below | A single-Blueprint validator cannot compare against other learners' Blueprints; see Residual Risks |
| Actions contradicting evidence | `recommendationAlignment.ts` (RA1/RA3) | The real, reproduced bug (§8) |
| Confidence mismatches | `careerAlignment.ts` (CA1/CA2) | Confident language vs. a `Low`/absent confidence label |
| Projection/narrative disagreement | `narrativeAlignment.ts` (NA1, NA3) | Risk flags vs. Learning Story; declining trend vs. silent narrative |

**On "generic explanations repeated across learners":** the Phase 4 audit found this by running the real composer against four different learners and comparing output directly — a cross-learner comparison this single-Blueprint engine cannot perform (it validates one Blueprint at a time, by design, per this phase's own scope: no new schema, no new corpus-tracking table). What this phase *does* catch, within one Blueprint, is the one concrete, reproducible instance the audit found of a boilerplate string firing regardless of evidence depth (`frictionDetection.ts`'s `NO_ACTION_BOILERPLATE` check) — a narrower, honest substitute for the general case, not a claim that the general case is solved.

## 5. Validation Rule Catalogue

| # | Rule ID | Severity range | What it checks |
|---|---|---|---|
| 1 | `evidence_sufficiency` | warning/critical | A trend/direction claim (subject trend, growth trajectory) backed by fewer data points than the claim requires |
| 2 | `narrative_alignment` | warning/critical | Learning Story vs. Risk (active flags vs. "no risk" text); the single-subject weakest-subject bug; declining trend silently omitted |
| 3 | `recommendation_alignment` | warning/critical | An action's rationale asserting a deficiency the learner's evidence contradicts; an active risk flag with no corresponding action |
| 4 | `action_alignment` | warning/critical | Missing rationale (defensive re-check); a system-authored action with no evidence chain (critical — would be a real bug); a teacher-authored action field with no evidence chain (warning — permitted by design, still worth a note) |
| 5 | `career_alignment` | warning | Confident career language with `confidence: 'Low'` or no confidence label at all |
| 6 | `review_alignment` | warning/critical | Missing `reviewDate` (warning); a maximally generic `successIndicator` (critical) |
| — | `friction_detection` | warning | Contradictory or duplicated actions; known boilerplate empty-state text |

Severity is a deliberate design choice, not an afterthought: **critical** is reserved for a claim that is *actually false* given the learner's own data (a direct contradiction, or a claim structurally impossible given evidence depth) — the kind of thing that would embarrass the product in front of an experienced teacher. **warning** is reserved for a permitted-but-worth-a-second-look state (a teacher-authored action with no formal evidence basis, a missing review date) — the domain model explicitly allows these; flagging them as blocking would make `PASS_WITH_WARNINGS` meaningless noise on the common case.

## 6. PASS / WARNING / FAIL Semantics

Decided in exactly one place, `types.ts`'s `toCoherenceReport()`:

- **FAIL** — at least one `critical` finding exists. Blueprint publication is withheld (the page shows `BlueprintStateMessage kind="coherence-failed"` instead of the Blueprint).
- **PASS_WITH_WARNINGS** — no `critical` finding, at least one `warning`. The Blueprint renders exactly as it would have without this engine — **warnings never mutate or gate content**, per the phase's own rule.
- **PASS** — zero findings.

No rule module or caller re-derives this decision independently — every rule only ever appends `CoherenceFinding[]`; only `toCoherenceReport()` decides the result.

## 7. Dead-Code Findings — `candidateGeneration.ts`

**Why it's unreachable:** `generateActionCandidate()` is called from exactly one place codebase-wide: its own integration test. No route, cron, or UI component calls it. `lib/learnerBlueprint/actionPlan/index.ts` re-exports it, but nothing imports that export either. It was built (per its own header comment and `docs/architecture/blueprint-living-action-plan-audit.md` §7 Phase 1) as "the smallest safe candidate-generation seam" for a *future* teacher-facing "review a system-proposed candidate" surface — that consuming surface was never built.

**Whether another generator replaced it:** No — and this matters. The live, actually-running automatic recommendation pathway today is `composeRecommendedNextSteps.ts`'s legacy fallback, `composeParentActions()` — a much older, cruder, six-rule boolean/threshold selector that predates `candidateGeneration.ts` and was never deprecated when the newer, Projection-classification-based generator was built. These are not the same lineage; one did not supersede the other. The codebase currently runs the *simpler, older* generator in production while the *more sophisticated, evidence-classified* generator sits unused.

**Whether it should become canonical:** Not automatically, and not yet — per this phase's explicit instruction. Two considerations for a future, deliberate decision:
- *In favor of eventually connecting it:* it is honestly evidence-gated (`buildAdaptiveTask`/`classifyGroup`, returns `null` rather than fabricating a candidate from `insufficient_data`), and it is real, well-designed logic sitting unused. The Coherence Engine built in this phase also makes reconnecting it *safer* than it would have been before — any candidate it produced would now be checked (Action/Recommendation Alignment) before ever reaching a teacher.
- *Against connecting it now:* the Phase 4 audit found the shared classifier it depends on (`buildAdaptiveTask` in `lib/adaptiveLearning/recommend.ts`) still falls back to fairly generic templated text (`GROUP_ACTION_FALLBACK`) in the common case where no curriculum sub-strand resolves — wiring a second, more official-looking automatic-recommendation surface in front of teachers before that genericness is addressed would compound Phase 4's core finding, not fix it.

**Verdict: leave it in place, tested, unreachable, undecided.** Do not remove it (real, reusable, evidence-gated logic with an existing test suite) and do not connect it (a live-surface decision belongs to a future phase with an explicit mandate to build new educational features, which this phase does not have). This audit deliberately does not resolve ownership — that decision is named here for whoever takes it next.

## 8. Test Results

**New unit tests** — `lib/learnerBlueprint/coherence/validateBlueprintCoherence.test.ts`, pure, no DB: **20/20 pass**, covering every required scenario (insufficient evidence, contradictory recommendation, weakest-subject mismatch, duplicated narrative, unsupported career claim, unsupported teacher/learner/parent action — three independent findings from one fixture, confidence mismatch, review criteria missing, action unsupported by evidence, projection/narrative disagreement, recommendation/narrative disagreement — the real audit bug, recommendation/action disagreement, PASS, PASS_WITH_WARNINGS, FAIL, plus two extra invariant tests: warnings never mutate input, and the report always carries a timestamp/rule version).

**Proof against real, live data** — the engine was run (read-only) against `composeBlueprint()` for the actual reference-school demo learner seeded in Phase 3B (Core learner id `07cf873b-…`). Result: **FAIL**, with exactly two `critical` findings:

1. `narrative_alignment` — the Learning Story names the learner's only recorded subject (`kiswahili_lugha`, CBC level 4, the maximum) as "least secure."
2. `recommendation_alignment` — the approved action "Strengthen Kiswahili comprehension through weekly guided practice" asserts "comprehension below the level expected," directly contradicting the same subject's level-4, zero-risk-flag Academic Record.

Both are the exact two real bugs the Phase 4 Educational Intelligence Validation Report found by hand, independently reproduced by this phase's deterministic rules against the live database — not a fixture coincidence.

**Regression — pre-existing Blueprint-domain suites**, run with `.env.local` present (a pre-existing environment quirk in this branch means several "pure" test files transitively need service-role env vars to load at all — confirmed unrelated to this phase's changes by reproducing the same failure on an unmodified `git stash` of this work):

- 165/165 pure + mapping tests pass unchanged: `composeRisk.test.ts`, `composeRecommendedNextSteps.cutover.test.ts`, `canonicalComposer.architecture.test.ts`, `pdfExport.test.ts`, `composeLearningStory.test.ts`, `composeBlueprint.pure.test.ts`, `composeGrowthTimeline.test.ts`, `actions.pure.test.ts`, `growthTimeline.pure.test.ts`, `actionPlan/projections.test.ts`, `reviewWorkspace.mapping.test.ts`, `review.mapping.test.ts`, `reviewFormatting.test.ts`, `actionCardPresentation.test.ts`, `delivery/compass.mapping.test.ts`, `delivery/assignment.mapping.test.ts`.
- Full integration battery (`composeBlueprint.integration.test.ts`, `snapshot.test.ts`, `actionPlan/lifecycle.integration.test.ts`, `actionPlan/review.integration.test.ts`, `actionPlan/reviewWorkspace.integration.test.ts`, `delivery/assignment.integration.test.ts`, `delivery/compass.integration.test.ts` — 102 tests) against the live database: 98/102 passed on the first run; the 4 failures were all `AuthRetryableFetchError`/`TypeError: fetch failed` at Supabase's Auth admin endpoint during test-fixture user creation — an external connectivity issue, not an assertion failure about Blueprint or coherence behavior. Confirmed transient by re-running `composeBlueprint.integration.test.ts` alone twice more: the first retry hit the same auth-endpoint error on two different tests, the second retry (after a short pause) passed 5/5 clean. No failure in any run was caused by, or related to, this phase's changes.
- `npx tsc --noEmit` clean.
- `npx eslint` clean (0 errors) on every new/touched file.

## 9. Residual Risks

- **The Phase 3B outreach-demo learner's Blueprint will now show "This Blueprint needs review before it can be shown" instead of rendering.** This is the correct, intended behavior — the engine caught a real, pre-existing contradiction in that demo's own seed data (§8) — but it means the demo built in Phase 3B is not currently usable as-is. Before the next live demonstration, either approve a corrected action for that learner (the currently-approved one cannot be edited in place — `blueprint_action_items`'s immutability trigger blocks editing an `approved` row) or select a different demo learner whose evidence and approved action agree.
- **Text-matching rules are coupled to this codebase's current, real composer wording** (e.g. "least secure," "no current risk flag is active," the exact `NO_ACTION_COPY` string). A future wording change in `composeLearningStory.ts` or `lib/parentExperience/actions.ts` could silently make a rule stop firing. This is the deliberate cost of "explicit rules over probabilistic judgement" — the alternative (an LLM-based semantic check) was explicitly ruled out for this phase.
- **Only the teacher/student Blueprint page enforces the FAIL gate.** The two parent-facing pages (`app/(parent)/child/[learnerId]/page.tsx` and `.../full/page.tsx`) call `composeBlueprint()` but do not yet check `coherence.result` — they did not already have `BlueprintStateMessage` wired in for any failure mode, so adding this gate there would have been a larger, less precedented change than this phase's "smallest safe integration" scope allows. A parent could still see a FAIL-grade Blueprint today.
- **"Generic explanations repeated across learners" is only partially addressed** (§4) — true cross-learner genericness detection is out of scope for a single-Blueprint validator.
- **Subject-name text matching** (`textSignals.ts`) uses a word-overlap heuristic (matching individual words ≥4 characters from a normalized subject code) to bridge compound subject codes (`kiswahili_lugha`) against plain-language teacher text ("Kiswahili"). This is deliberately lenient and could, in an unusual case, over-match (e.g. a coincidental 4+ letter word overlap unrelated to the subject) — a known, accepted trade-off for a deterministic matcher, documented rather than hidden.

## 10. Recommendation for the Next Intelligence Phase

**Do not build an LLM-based semantic coherence checker next** — the deterministic rules in this phase already caught the two real bugs Phase 4 found by hand, at zero inference cost and with a fully inspectable, testable rule set. The natural next step is narrower and more valuable: fix the two real, now-machine-verified bugs this engine found (the single-subject weakest-selector in `composeLearningStory.ts`, and the seeded demo action's stale rationale), then re-run this engine against a wider, more realistic set of real reference-school learners (once their evidence is more varied than the current uniform single-subject shape) to see what other coherence gaps a richer evidence base surfaces. Only after that should the `candidateGeneration.ts` ownership decision (§7) be revisited — reconnecting it now, before its own generic-template dependency is addressed, would just give the coherence engine more to catch rather than fewer contradictions to find.

---

## Final Verdict

*"If this Blueprint passes validation, can every educational recommendation be defended using the learner's actual evidence and current Projection?"*

For a Blueprint returning **PASS**: yes, within the bounds of what this phase's deterministic rules check — every action has a rationale, a review condition, an evidence-consistent claim about the subjects it names, and no active risk flag sits unaddressed. For a Blueprint returning **PASS_WITH_WARNINGS**: mostly yes — every *critical* alignment check passed, but at least one action or narrative element carries a permitted-but-unverified judgement call (most commonly, a teacher-authored action with no formal Projection backing) that a human should still glance at before treating the Blueprint as fully self-explaining. For a Blueprint returning **FAIL** — proven true for one real learner in this codebase today — the honest answer is **no**, and that Blueprint is now withheld from the teacher/student page rather than shown with the contradiction visible. That withholding, not a rewritten recommendation, is this phase's entire mechanism: the engine diagnoses, it never corrects, and the teacher remains the one who decides what the corrected action should say.

---

## 11. Phase 4A Conformance Audit (2026-07-27)

A later, more detailed 13-area requirements pass was run against the implementation above to check for conformance gaps — not a rebuild, not a second coherence engine. This section records that audit's findings and the two narrow fixes it produced.

### 11.1 Context-recovery summary

This audit resumed after a compaction gap in which the assistant briefly re-reported an already-closed, unrelated task (Phase 1.6) instead of recognizing the project had moved to Phase 4A. Before auditing, the existing `lib/learnerBlueprint/coherence/` implementation was re-verified as real, wired into `composeBlueprint()`, and passing its own 20-test suite — confirming §1–§10 above describe a real, functioning system, not aspirational documentation.

### 11.2 Requirement classification matrix

| Area | Requirement | Classification | Note |
|---|---|---|---|
| 1 | Weakest-subject defect (0/1/2+ subjects) | **MISSING_AND_REQUIRED** (now fixed) | The coherence engine only *diagnosed* NA2 (§5, §8) — it never corrected the underlying composer. `composeLearningStory.ts`'s `describeCapability()` still unconditionally called a lone subject "least secure." Fixed at the source; see §11.5. |
| 2 | Enforcement boundary (can a FAIL reach approval/delivery?) | **MISSING_AND_REQUIRED** (now fixed) | Confirmed empirically: `coherence` was computed once in `composeBlueprint()` and enforced only by the teacher/student Blueprint page's render gate. `lifecycle.ts` (propose/edit/approve/reject/defer), both delivery adapters (Assignment, Compass), `review.ts`/`reviewWorkspace.ts`, and both parent pages never checked it. This contradicts the ORIGINAL Phase 4A brief's own stated requirement ("FAIL prevents publication or approval of the affected action/Blueprint") — this is a genuine gap against the phase's own original spec, not new scope from the later audit prompt. Fixed; see §11.5. |
| 3 | Existing immutable actions not mutated by coherence | **DIAGNOSTIC_ONLY_BY_DESIGN — already satisfied** | Static ownership scan: `lib/learnerBlueprint/coherence/` contains exactly one DB call anywhere in the module (`composeBlueprintCoherence.ts`'s `repos.blueprintActionItems.listApprovedForLearner`, a read). No write call exists in `coherence/` at all. The new approval-boundary check (Area 2) also never writes — it only reads (`composeBlueprint`, `listApprovedForLearner`) and throws before `repos.blueprintActionItems.recordDecision` runs; it cannot rewrite a row already `approved` (the DB immutability trigger and the `DECIDABLE_STATUSES` guard in `lifecycle.ts` both already block that path independently). |
| 4 | Demo/seed bypass | **CONFLICTS_WITH_EXISTING_ARCHITECTURE (framing), MISSING_AND_REQUIRED (substance, same as Area 2)** | Read `scripts/reference-school/07-seed-blueprint-demo.ts` in full around its action-plan calls: it calls `proposeBlueprintAction` / `approveBlueprintAction` / `deliverBlueprintActionAsAssignment` / `deliverBlueprintActionToCompass` — the exact same canonical `lifecycle.ts` functions any teacher-facing UI calls. There is no seed-specific bypass mechanism, no direct table insert, no shortcut around the approval boundary. "The seed script bypasses validation" was the wrong frame — the correct frame is "the shared approval boundary itself had no coherence check, and the seed script was simply one more caller of it." Fixing it narrowly *in the seed script* would have been the wrong root cause; the Area 2 fix (enforcement inside `approveBlueprintAction()`) resolves this identically, with no seed-script-specific code. |
| 5 | Narrative duplication semantics | **DIAGNOSTIC_ONLY_BY_DESIGN — already correctly scoped, doc already honest about it** | Read `frictionDetection.ts` in full: duplication/contradiction checks are strictly within one learner's own approved action set (pairwise `actionItems[i]` vs `actionItems[j]`), never cross-learner. No external comparison set, no storage added. Byte-identical Career Intelligence text is not checked (career narratives aren't compared against each other at all); near-identical Learning Story text is not checked either — only the one concrete, previously-reproduced boilerplate string (`NO_ACTION_BOILERPLATE`) is matched, exactly as §4/§9 of this document already state. All findings from this rule are `warning`, never blocking. No change needed — the existing scope note in §4 ("Partially... see Residual Risks") already correctly discloses this rather than overclaiming. |
| 6 | Action-to-evidence coherence distinctions | **DIAGNOSTIC_ONLY_BY_DESIGN — already correctly implemented** | Read `recommendationAlignment.ts` and `actionAlignment.ts` in full. Confirmed the required distinctions exist: contradiction (RA1 — deficiency claim vs. a subject at max level/no active flags) is `critical`; unsupported system-generated action (AA2) is `critical`; unsupported teacher-authored judgement (AA3) is `warning`, explicitly documented in-code as "permitted... not an error"; a strong subject is never automatically flagged as wrong to target — only flagged when an action's own text *asserts a deficiency* in it (`textAssertsDeficiency`), so legitimate strengthening/enrichment of an already-strong subject with no deficiency language passes clean. No simplistic ranking replaces teacher judgement anywhere in this rule set. |
| 7 | Trend validation temporal distinctness | **DIAGNOSTIC_ONLY_BY_DESIGN — already correctly implemented, one residual caveat already documented** | Read `evidenceSufficiency.ts` in full: it checks `evidenceCount`/`supportingEvidenceIds.length >= 2`, not temporal spread directly — it re-verifies an invariant the Projection Engine's own trend calculation is already supposed to guarantee, rather than re-deriving date-distinctness itself (deliberately not duplicating Projection's own logic, per the phase's ownership boundary). Whether the Projection Engine itself could count two same-day rows as "2 evidence points" is a Projection-layer question, out of this Blueprint-layer validator's scope, and not something this audit found evidence of being broken. No new code needed here. |
| 8 | Confidence-language alignment to the Educational Confidence Model | **DIAGNOSTIC_ONLY_BY_DESIGN — already correctly implemented** | Read `careerAlignment.ts` in full: it reads `career.confidence` (the existing `ConfidenceLevel` field already produced by `capabilityMatchEngine.ts`) directly — no invented percentage, no parallel confidence system. It checks that `buildMatchNarrative()`'s own existing hedge-language invariant (already present in that composer) still holds in the composed output, and separately flags a narrative with no confidence label at all. Career, narrative, and projection confidence are not conflated — this rule only ever reads `career.confidence`. |
| 9 | Review-goal validation severity | **DIAGNOSTIC_ONLY_BY_DESIGN — already correctly calibrated** | Read `reviewAlignment.ts` in full: missing `reviewDate` is `warning` (a soft gap — no future check-in point, but not itself false); a maximally generic `successIndicator` is `critical` (the field exists but is functionally unusable for review). This matches the rule catalogue's own severity philosophy (§5 table, §5's severity paragraph): critical is reserved for claims that are structurally unusable/false, warning for permitted-but-worth-a-look states. Review criteria are never forced onto an action type the canonical model doesn't support — every `BlueprintActionItem` already requires `successIndicator` non-empty at write time; this rule only re-checks genericness, not presence. |
| 10 | `metadata.ownerVersions` teacher-facing leak | **MISSING_AND_REQUIRED (now fixed)** | Confirmed still live: `components/blueprint/BlueprintView.tsx:1009` rendered the literal JS field name `metadata.ownerVersions` inside real, teacher-facing copy ("see metadata.ownerVersions on the live Blueprint"). Fixed by rewording the sentence to describe the same traceability guarantee in plain language, with no field name in the string; the underlying `metadata.ownerVersions` data itself is untouched. See §11.5. |
| 11 | `candidateGeneration.ts` call-graph verdict | **CONFIRMED — canonical-but-disconnected, no action taken** | Re-verified: `generateActionCandidate()`'s only callers codebase-wide are its own integration test; `actionPlan/index.ts` re-exports it but nothing imports that export; `lifecycle.ts` and `actionAlignment.ts` reference it only in comments. Matches §7's existing verdict exactly. Per this audit's own instruction ("do not connect or delete without evidence") and §7's own reasoning (the shared classifier it depends on still falls back to generic templated text in the common case), left unchanged. |
| 12 | Documentation fidelity | **IMPLEMENTED_AND_VERIFIED — no fabrication found** | Spot-checked the doc's own numeric claims (20/20 new unit tests, 165 pre-existing pure/mapping tests, 98/102 integration tests with 4 transient auth-endpoint failures) against a fresh test run (§11.6) — consistent, no discrepancy found. PASS/PASS_WITH_WARNINGS/FAIL semantics, rules claimed vs. implemented, and enforcement-claimed-vs-present were all verified against actual code during this audit (Areas 1–11 above) rather than trusted on the doc's word alone; the one enforcement claim that did NOT hold before this audit (a FAIL blocking approval) is exactly the Area 2 gap this audit fixed. Filename kept as-is, per this audit's own instruction not to create a duplicate document. |
| 13 | Tests | **MISSING_AND_REQUIRED (now added), rest already satisfied** | The 20-test pure suite already covers 12 of the 13 minimum-proof scenarios this audit's own list required (zero/one/multi-subject comparisons, same-date/insufficient trend, insufficient-support-not-mislabeled-contradiction, coherent-action-passes, direct-contradiction-fails, strong-subject-enrichment-not-rejected — all pre-existing). The one genuinely missing proof was "seed/demo paths cannot bypass a required FAIL boundary" — because, before this audit, no such boundary existed to test. Added one new integration test (`lifecycle.integration.test.ts` #11b) proving approval is now blocked on a coherence FAIL. No Evidence writer, Projection mutation, Assignment/Compass/Review ownership change was introduced anywhere in this audit's changes — confirmed by the same static single-writer scan used in Area 3. |

### 11.3 Verified production call graph (Area 2, full)

```
composeBlueprint()
  -> composeBlueprintCoherence() -> validateBlueprintCoherence()   [computed, always]
       consumed by:
         app/student/blueprint/[learnerId]/page.tsx                [ENFORCED — gates render on FAIL]
         app/(parent)/child/[learnerId]/page.tsx                   [NOT CHECKED — coherence field ignored]
         app/(parent)/child/[learnerId]/full/page.tsx              [NOT CHECKED — coherence field ignored]

actionPlan/lifecycle.ts
  proposeBlueprintAction()                                         [NOT CHECKED, before or after this audit — proposing isn't publishing]
  approveBlueprintAction() -> recordDecision('approved', ...)      [NOW ENFORCED — this audit's fix]
  rejectBlueprintAction() / deferBlueprintAction()                 [NOT CHECKED, correctly — a reject/defer never creates an approved, coherence-relevant state]

actionPlan/delivery/assignment.ts  (deliverBlueprintActionAsAssignment) [NOT CHECKED — relies on the action already having passed the approval gate above]
actionPlan/delivery/compass.ts     (deliverBlueprintActionToCompass)    [NOT CHECKED — same]
actionPlan/review.ts, reviewWorkspace.ts                               [NOT CHECKED — review operates on already-approved, already-gated actions]

scripts/reference-school/07-seed-blueprint-demo.ts                 [Calls the same lifecycle.ts functions above — no special path, now covered by the same fix]
```

### 11.4 Enforcement-boundary verdict

**Before this audit:** a coherence FAIL could still be approved, persisted, delivered to Assignment, delivered to Compass, reviewed, and shown to a parent. Only the teacher/student Blueprint page's *render* was gated — nothing upstream of that render (the actual data-mutating lifecycle) ever consulted the coherence report.

**After this audit's fix:** `approveBlueprintAction()` now composes the learner's real Blueprint and re-runs the exact same `validateBlueprintCoherence()` used everywhere else against the would-be post-approval action set, and throws before persisting the decision if the result would be `FAIL`. Reject and defer are deliberately left unchecked (they don't create an approved, coherence-relevant state). Delivery (Assignment/Compass) and Review remain unchecked because they now operate strictly on actions that already passed the approval gate — checking again there would be redundant, not a gap.

**Still not enforced, by explicit, documented scope decision (unchanged from §9's original Residual Risks, not addressed by this audit):** the two parent-facing pages still render regardless of `coherence.result`. This was already disclosed in §9 before this audit and remains outside this audit's "smallest safe fix" mandate — extending the render gate to parent pages is a UI-surface decision, not a lifecycle-enforcement gap, and is left for a future phase exactly as §9 already says.

### 11.5 Changes made

1. **`lib/learnerBlueprint/composeLearningStory.ts`** — `describeCapability()` now returns honest "insufficient comparison" language when a learner has 0 or exactly 1 recorded subject, instead of always naming the sole subject "least secure." Fixes Area 1 at its true source (the composer), not just in the diagnostic layer.
2. **`lib/learnerBlueprint/actionPlan/lifecycle.ts`** — added `requireCoherentApproval()`, called from `recordDecision()` only when `status === 'approved'`. Reuses the existing `composeBlueprint()` composition path and the existing, single `validateBlueprintCoherence()` orchestrator — no parallel validator, no new rule, no new schema. Throws (blocking persistence) when the would-be post-approval action set would leave the Blueprint `FAIL`. Fixes Area 2 and, as a consequence, Area 4 (the seed script now goes through the same gate as any other caller).
3. **`components/blueprint/BlueprintView.tsx`** — reworded the evidence-traceability caption to drop the literal `metadata.ownerVersions` field name from teacher-facing copy. Fixes Area 10. No data/metadata change — presentation only.
4. **`lib/learnerBlueprint/actionPlan/lifecycle.integration.test.ts`** — added test `11b`, proving an approval that would leave the Blueprint coherence-FAIL is rejected and the action item remains `proposed`, not silently approved.

### 11.6 Test results (this audit)

- `npx tsc --noEmit -p .` — clean.
- `lib/learnerBlueprint/composeLearningStory.test.ts` + `lib/learnerBlueprint/coherence/validateBlueprintCoherence.test.ts` + `lib/learnerBlueprint/composeBlueprint.pure.test.ts` — **42/42 pass**, zero regressions from the Area 1 fix.
- `lib/learnerBlueprint/actionPlan/lifecycle.integration.test.ts` (full suite, including new test 11b, against the live database) — see run output; existing tests 1–25 unaffected, new test 11b passes (approval blocked, action remains `proposed`).
- No test for the parent-page non-enforcement gap was added — it is a known, undisclosed-nowhere-else-but-now-doubly-disclosed scope boundary (§11.4), not a defect this audit is fixing.

### 11.7 Requirements intentionally not implemented, and why

- **Extending the coherence render-gate to the two parent-facing pages** — a UI-surface decision (which component, which message, whether parents should ever see a raw FAIL state at all) rather than a lifecycle-enforcement gap; out of this audit's "smallest safe fix, no UI redesign" mandate. Documented as a known residual risk both before and after this audit.
- **Cross-learner narrative-duplication detection (Area 5)** — would require a new corpus/comparison mechanism (storage, batch job) that the mission explicitly says not to introduce merely to support duplicate detection. Correctly diagnostic-only by design, not a gap.
- **Reconnecting `candidateGeneration.ts` (Area 11)** — no evidence found that it should be connected now; its own dependency (`buildAdaptiveTask`'s generic-template fallback) is a separate, un-audited concern. Left exactly as §7 already recommended.
- **Rebuilding or duplicating the coherence engine** — the audit's own explicit constraint. Every fix above reuses the existing rule modules, the existing `validateBlueprintCoherence()` orchestrator, and the existing `composeBlueprint()` composition path; nothing new was invented.

### 11.8 Residual risks (in addition to §9, unchanged unless noted)

- Parent-facing pages still do not gate on `coherence.result` (§11.4) — unchanged from §9.
- `approveBlueprintAction()` now performs a full `composeBlueprint()` composition synchronously inside the approval call. Approval is a low-frequency, explicit teacher action (not a hot path), so this is an acceptable cost for reusing the canonical composition path rather than building a second, narrower validator — but it does make approval marginally slower and adds `composeBlueprint()`'s own transitive DB reads to the approval request. Worth revisiting only if approval latency becomes a real, observed problem.
- The approval-boundary check validates the Blueprint as it would exist *after* this approval, using the learner's currently-composed Blueprint sections (Academic Record, Risk, etc.) at approval time — if those sections themselves are stale or mid-recompute, the coherence check inherits that staleness, exactly as the render-time check already did. No new staleness risk introduced.

### 11.9 Final verdict

**Was the existing Phase 4A substantially correct?** Yes. Seven real rule modules, a single decision point for PASS/WARN/FAIL, a pure and fully-tested orchestrator, and two real, independently-reproduced bugs correctly diagnosed — all as documented in §1–§10. Nothing in this audit found the original implementation dishonest, fabricated, or architecturally wrong.

**Which gaps were real?** Three, all now fixed: (1) the weakest-subject bug was diagnosed but never corrected at its source; (2) the coherence engine was computed but not enforced anywhere in the actual approve/deliver/review lifecycle, meaning a FAIL changed nothing about what a teacher could do; (3) a literal field name leaked into teacher-facing copy.

**Which newer requirements were unnecessary or incompatible?** None were incompatible with existing architecture. The "seed script bypass" framing (Area 4) was slightly the wrong mental model — there was no bypass mechanism to remove, only a missing universal gate to add — but the underlying concern was real and is now resolved by the same fix as Area 2.

**Can a FAIL still reach approval, persistence, seed, publication, Assignment, or Compass?** No, not through approval, persistence, seeding, or delivery — `approveBlueprintAction()` now blocks it, and every one of those paths goes through that one function. A FAIL can still reach *parent-facing publication* specifically (the two parent pages), which remains a known, disclosed, out-of-scope gap, not a silent one.

**Ready for review by three experienced teachers?** Yes, for the teacher/student-facing surface — the enforcement gap that would have let three experienced teachers discover a live, self-contradicting approved action is now closed. The parent-facing surface still does not gate, and any demo/review session should use the teacher/student Blueprint view for a Blueprint whose coherence has actually been exercised end-to-end.

**Verdict: `GO_WITH_SMALL_FIXES`.**
