# Comparable-Context Growth Correction — Phase 4B.1

**Date:** 2026-07-27
**Scope:** Fix confirmed Projection and coherence defects exposed by rendering a real Blueprint (Victor Gitau, Mwatate Ridge Senior School) before conducting any teacher-validation sessions. No Blueprint redesign, no new educational features, no AI calls, no schema change.

---

## 1. Executive Verdict

The defect was real, root-caused, and is now fixed at its true source (`growthProjector.ts`), not merely patched at a display layer. All three prepared teacher-validation cases were recomposed and Victor Gitau's Blueprint was re-rendered to PDF and visually re-inspected, page by page, against the exact five locations where the false claim previously appeared. All five are corrected. Cheruiyot Gitau's genuine decline signal and Chebet Rotich's genuine uncertainty are both preserved, unchanged in substance. The Coherence Engine now independently catches this entire defect class, defense-in-depth, even though the corrected composers can no longer produce it by construction.

**Verdict: `READY_FOR_THREE_TEACHER_VALIDATION`.**

## 2. Rendered Defect Evidence

Rendering Victor Gitau's real Blueprint to PDF (7 pages, `renderBlueprintPdf`) surfaced the same false claim in five separate places, all traceable to one root cause:

| Page | Claim (before) | Contradicts |
|---|---|---|
| 2 (Learner Overview) | "The greatest current opportunity is to strengthen kiswahili_lugha, where the present capability evidence is least secure." | Kiswahili is at CBC Level 4 (the maximum), zero risk flags |
| 3 (Academic Evidence Matrix) | "OVERALL PATTERN: declining" | Both listed subjects are at Level 4 |
| 4 (Growth, Risk and Conditions) | "Movement over time: Declining... 100% to 83% (-17 points)" | The very next box on the same page: "Current severity: Stable — no active concern" |
| 5 (Pathway and Future Intelligence) | "Subjects to strengthen: ...kiswahili_lugha... least secure" (repeat of page 2) | Same as page 2 |
| 6 & 7 (Action Plan / School and Family Review) | "Victor Gitau is showing an area needing attention progress this term." (also grammatically broken) | Same underlying claim, plus a template-substitution grammar bug |

## 3. Root-Cause Map

```
learner_evidence (subject, cbc_level, academic_year, term, created_at)
  -> growthProjector.ts::projectGrowth()          [BUG: pooled ALL subjects into one chronological
                                                     sequence, compared early-half vs late-half average]
    -> academicRecord.overallTrend                [composeAcademicRecord.ts:54 — sources overallTrend
                                                     directly from growth.value.trend]
      -> Academic Record section ("OVERALL PATTERN")     [page 3]
      -> Risk/Growth section ("Movement over time")      [page 4 — via composeRisk.ts's own growth read]
      -> composeParentSummary.ts:38                      [page 6/7 — TREND_WORDS['declining'] = 'an
                                                            area needing attention', a noun phrase
                                                            slotted into an adjective-shaped template
                                                            -> broken grammar]
      -> composeLearningStory.ts (NA3 narrative check)    [indirect — narrative correctly avoided
                                                            claiming decline, which the coherence
                                                            engine's own NA3 rule then flagged as a
                                                            *different*, pre-existing warning]

learner_evidence (per-subject, via capabilityProjector, a SEPARATE V1 projection, 0-1 score scale)
  -> capability.value.bySubject                   [independent of growthProjector entirely]
    -> composeLearningStory.ts::describeCapability()   [BUG: `opportunityCore` named `weakest`
                                                          "least secure" unconditionally, even when
                                                          `mixed` was false (no meaningful gap) and
                                                          even when `weakest` was itself capable/
                                                          strong/exceptional]
      -> Learner Overview "Current opportunity"          [page 2]
      -> Pathway "Subjects to strengthen"                 [page 5]

lib/learnerBlueprint/coherence/rules/narrativeAlignment.ts::NA2
  -> only ever guarded the bySubject.length === 1 case — the 2+-subject
     version of the same false claim (both bugs above) passed through
     undetected; coherence.result was PASS_WITH_WARNINGS with neither
     defect flagged.
```

**Two independent root causes, one shared symptom:** the pooled cross-subject trend (growthProjector.ts) and the ungated multi-subject "least secure" language (composeLearningStory.ts) are separate bugs in separate files that happened to produce the same kind of false claim for the same learner. Both are fixed; neither fix depends on the other.

## 4. Comparable-Context Invariant

> Evidence from different subjects, learning areas, competencies, or otherwise incomparable contexts must never be treated as sequential measurements of one capability trajectory.

Subject is the narrowest reliable comparable context this domain model already supports — the same grouping key `academicProjector.ts` already uses for per-subject trend. `growthProjector.ts` now computes trend independently within each subject, then aggregates conservatively; it never compares one subject's score against a different subject's score to infer direction.

## 5. Previous Pooled Algorithm

```ts
const sorted = [...scored].sort(by created_at)          // ALL subjects merged into one sequence
const firstHalf = sorted.slice(0, mid)
const secondHalf = sorted.slice(mid)
const earliestScore = avg(firstHalf.map(normalizeLevelToUnit))
const latestScore = avg(secondHalf.map(normalizeLevelToUnit))
trend = delta > 0 ? 'improving' : delta < 0 ? 'declining' : 'stable'
```

Whichever subject happened to have the earliest-recorded evidence and whichever subject happened to have the latest-recorded evidence determined the "trend" — regardless of whether either subject actually moved at all.

## 6. Corrected Algorithm

`lib/projection/growthProjector.ts`:

1. Group scored evidence by `subject`.
2. Within each subject, group further by **effective period** (`academic_year` + `term`) — multiple assessments within the same term are a snapshot of that term, not movement; a subject confined to one effective period stays `insufficient_data` regardless of row count, however many days apart the `created_at` timestamps are.
3. A subject with 2+ distinct effective periods gets its own trend: earliest-period average level vs. latest-period average level, same `STABLE_THRESHOLD`-gated improving/declining/stable logic as before, now scoped to one subject.
4. Overall trend is aggregated from the *valid* (non-`insufficient_data`) per-subject trends only (§7).

## 7. Overall Aggregation Semantics

| Valid per-subject trends | Overall | Rationale |
|---|---|---|
| none | `insufficient_data` | Nothing comparable to summarize yet |
| exactly one | that subject's own trend, `sourceSubject` set | Directly traceable, no aggregation needed |
| all improving | `improving` | Unanimous |
| all declining | `declining` | Unanimous |
| all stable | `stable` | Unanimous |
| stable + improving (no declining) | `improving` | A real, observed movement; the stable subject(s) don't contradict it — conservative in that it never invents a direction, but does surface a real one |
| stable + declining (no improving) | `declining` | Symmetric with the row above — a real decline is not diluted into invisibility by an unrelated stable subject |
| both improving AND declining present | **`mixed`** (new `Trend` value) | The only honest label — neither direction may be dropped to force a single answer, and a high score in one subject plus a lower score in another is never "decline" |

When 2+ subjects contribute to the overall trend, `earliestScore`/`latestScore`/`delta`/`windowStart`/`windowEnd` are `null` at the top level — a single scalar across genuinely different subjects would itself be the same cross-subject-pooling error this correction removes. The real, traceable per-subject values live in the new `GrowthValue.bySubject` field, always.

`Trend` gained one new value, `'mixed'` (`lib/projection/types.ts`) — the mission's own instruction ("do not introduce a new trend vocabulary unless the existing type cannot honestly represent mixed outcomes") was checked against the existing four values first; none of `improving`/`declining`/`stable`/`insufficient_data` can honestly represent "one subject up, one subject down," so the addition was necessary, not decorative. Every exhaustive consumer (`composeParentSummary.ts`'s `TREND_HEADLINE`, `components/blueprint/BlueprintView.tsx`'s `TREND_LABEL`, `sections.tsx`'s `TREND_ARROW`) was updated; TypeScript's own exhaustiveness checking caught every site that needed it.

## 8. Learning Story Correction

`lib/learnerBlueprint/composeLearningStory.ts::describeCapability()` — the 2+-subject branch's `opportunityCore` used to name `weakest` "least secure" whenever `weakest` existed, regardless of whether `mixed` (a real, ≥0.25 spread) was true, and regardless of the weakest subject's own `CapabilityLevel`. Corrected to distinguish:

- **No meaningful gap** (`mixed` false): no subject is singled out — "does not show one subject standing out as needing particular attention."
- **Meaningful gap, weakest subject genuinely `emerging`/`developing`** (`belowThreshold` true): the existing "least secure, strengthen X" remediation language remains — this is the one case where it's actually true.
- **Meaningful gap, weakest subject still `capable`/`strong`/`exceptional`**: enrichment/continued-challenge language — "relatively lower... but remains {level}... reads as an enrichment opportunity... not a gap needing remediation."

## 9. Coherence-Rule Extension

`narrative_alignment` (`lib/learnerBlueprint/coherence/rules/narrativeAlignment.ts`):

- **NA2b** — the 2+-subject counterpart to the existing single-subject NA2: a max-level (CBC 4), risk-flag-free subject named with deficiency language ("least secure"/"insecure"/"needing attention"/etc.) is now caught, independent of how the narrative was generated.
- **NA-overall-decline** — an `overallTrend === 'declining'` with no `academicRecord.bySubject` entry actually `declining` is now caught. `growthProjector.ts`'s own correction should make this structurally unreachable; this is a defense-in-depth re-check, same posture as the existing evidence-count guards.
- **NA-parent-summary** — a Parent Summary headline reading as decline while `overallTrend` is neither `declining` nor `mixed` is now caught (Parent Summary is a separate composer reading the same Academic Record; nothing previously cross-checked the two stayed in agreement).

`evidence_sufficiency` (`lib/learnerBlueprint/coherence/rules/evidenceSufficiency.ts`):

- **Growth/risk disagreement** (warning) — `overallTrend === 'declining'` alongside `risk.overallRiskLevel === 'normal'` with zero active flags is now flagged as worth a second look (not critical — a genuine one-term dip not yet risk-flag-worthy is a plausible real state).

`DEFICIENCY_MARKERS` (`textSignals.ts`, shared by every rule that uses it) gained `'least secure'`, `'insecure'`, `'needing attention'`, `'needs attention'` — this codebase's own real remediation-register phrasing.

**Already correctly implemented, unchanged:** `recommendation_alignment`'s RA1 (action rationale vs. healthy subject) already only fires on explicit deficiency language, so a positively-phrased enrichment action targeting a strong subject already passed clean — verified, not re-implemented, with an explicit new test.

## 10. Parent Summary Grammar Correction

`lib/learnerBlueprint/composeParentSummary.ts` — replaced the single shared `TREND_WORDS: Record<string,string>` (a word/phrase interpolated into one fixed template — `declining: 'an area needing attention'` produced "is showing an area needing attention progress this term") with `TREND_HEADLINE: Record<OverallTrend, (name) => string>` — **semantic phrase ownership**: every trend state supplies its own complete, independently-checked sentence, never a fragment assumed to fit a template it was never verified against. All five states (`improving`, `declining`, `stable`, `insufficient_data`, `mixed`) tested individually.

## 11. Three-Case Revalidation

Recomposed via `composeBlueprint()` against the live reference-school database (not fixtures) for all three prepared cases:

| Case | overallTrend | bySubject | risk | learningStory.opportunity | parentSummary.headline | coherence |
|---|---|---|---|---|---|---|
| **Cheruiyot Gitau** (challenge) | `declining` (from Mathematics alone — Kiswahili stays `insufficient_data`, n=1) | kiswahili_lugha L2 insufficient_data · mathematics L1 declining | critical, 1 flag | "...strengthen mathematics, where the present capability evidence is least secure." (legitimate — Mathematics is genuinely below threshold) | "Cheruiyot Gitau's progress this term needs attention." | `PASS_WITH_WARNINGS` (1 warning: risk flag has no approved action yet — expected, none proposed) |
| **Victor Gitau** (enrichment) | `improving` (from Mathematics alone; was `declining` before this fix) | kiswahili_lugha L4 insufficient_data · mathematics L4 improving | normal, 0 flags | "Current evidence does not show one subject standing out..." (was "...strengthen kiswahili_lugha... least secure" before this fix) | "Victor Gitau is showing improving progress this term." (was the broken "...an area needing attention progress..." sentence) | **`PASS`, zero findings** |
| **Chebet Rotich** (mixed) | `insufficient_data` (neither subject has 2 distinct periods) | kiswahili_lugha L3 insufficient_data · mathematics L2 insufficient_data | normal, 0 flags | "...strengthen mathematics, where the present capability evidence is least secure." (Mathematics is genuinely the lower-level subject; a static current-level comparison, not a trend claim) | "Chebet Rotich is still building a fuller evidence picture this term." | `PASS`, zero findings |

**Visual re-render (Victor Gitau, full 7-page PDF, re-rendered exactly as production would generate it):** every one of the five previously-broken locations (pages 2, 3, 4, 5, 6, 7) now reads correctly and consistently — confirmed by reading the actual rendered PDF pages, not just the composed data.

## 12. Test Results

- `lib/projection/growthProjector.test.ts` (new) — **15/15 pass**: same-subject improving/declining/stable, single observation, same-period non-movement, cross-subject non-inference (both directions), valid-trend-not-corrupted-by-thin-sibling, mixed-trend honesty, all-improving/all-declining aggregation, stable+directional aggregation, no-valid-context, input-order independence, null-on-no-evidence.
- `lib/projection/engine.test.ts` — 1 pre-existing test rewritten (it asserted the old pooled-decline behavior by name; now asserts the corrected behavior — genuine multi-subject decline across distinct terms still detects `declining`), 1 new test added (same-term cross-subject spread does NOT falsely decline) — **14/14 pass**.
- `lib/learnerBlueprint/composeLearningStory.test.ts` — 4 new tests (strong-subject-with-real-gap → enrichment language, legitimately-below-threshold → remediation language preserved, no-meaningful-gap → no subject singled out, enrichment language for relatively-lower-but-still-strong) — **10/10 pass**.
- `lib/learnerBlueprint/coherence/validateBlueprintCoherence.test.ts` — 6 new tests (NA2b fires / does not false-positive on legitimate enrichment, NA-overall-decline fires on a constructed inconsistent fixture, NA-parent-summary fires / does not false-positive, growth/risk warning) — **26/26 pass**.
- `lib/learnerBlueprint/composeBlueprint.pure.test.ts` — 2 new tests (all 5 trend states produce grammatically correct headlines; the exact "showing an area needing attention progress" phrase can no longer render) — **19/19 pass** (existing suite, +2).
- `components/blueprint/BlueprintView.test.tsx` — unchanged, still passing.
- `lib/learnerBlueprint/actionPlan/lifecycle.integration.test.ts` (live database, includes the Phase 4A Conformance Audit's approval-FAIL-boundary test 11b) — **25/25 pass**, confirming no regression to the canonical coherence-FAIL-blocks-approval boundary.
- `npx tsc --noEmit -p .` — clean.
- `npx eslint` on every touched file — clean, 0 errors.

## 13. Affected Consumers

Every consumer of `academicRecord.overallTrend` / `Trend` was already audited in Part 1 before any change (composeAcademicRecord.ts, composeLearningStory.ts, composeParentSummary.ts, narrativeAlignment.ts, BlueprintView.tsx, sections.tsx) — none of them re-derive or re-interpret the trend value themselves; they only format/display whatever `Trend` they're given. This is exactly why the fix could be made once, at the source (`growthProjector.ts`), with no consumer needing its own logic changed beyond the mechanical exhaustiveness updates (`TREND_HEADLINE`/`TREND_LABEL`/`TREND_ARROW` gaining a `mixed` entry).

One additional direct consumer of `growth.value` (not `academicRecord.overallTrend`), found during this audit: `composeGrowthTimeline.ts` reads `earliestScore`/`latestScore`/`delta`/`windowStart`/`windowEnd` directly and already has a pre-existing null-guard that degrades to `status: 'unavailable'` (honest, no fabrication) whenever any of those is null — exactly the state they're now in whenever 2+ subjects contribute to the overall trend. No code change was needed there; verified, not assumed.

## 14. Unchanged Ownership Boundaries

- No Evidence writer touched — `growthProjector.ts` and `composeLearningStory.ts` are both pure readers.
- No Assignment, Compass, or Review ownership touched.
- No new schema, no migration — `GrowthValue.bySubject`/`sourceSubject` are additive fields on an existing in-memory type, not a table change.
- The Phase 4A coherence-FAIL-blocks-approval boundary (`lifecycle.ts::requireCoherentApproval`) was not modified — re-verified passing, not re-implemented.
- No AI call introduced anywhere in this phase.
- Action Plan quadrants were not touched — "no action currently supported by evidence" remains valid and untouched for all three cases; no quadrant was filled merely for visual completeness.

## 15. Residual Risks

- **`GrowthValue`'s "stable + directional -> that direction" aggregation rule (§7) is a documented judgment call, not a mathematical necessity.** A different, equally defensible conservative rule (e.g., requiring *all* valid subjects to agree before asserting any overall direction, defaulting to `stable` otherwise) was considered and rejected as under-sensitive — a real subject-level decline would then be invisible in the overall trend whenever any other subject was merely flat. Worth revisiting if real pilot data shows this choice surfaces too many one-subject-driven "declining" overalls in practice.
- **Chebet Rotich's Learning Story still says "strengthen mathematics, where evidence is least secure" from a single data point per subject.** This is a *current-level* comparison (Mathematics genuinely recorded at a lower CBC level than Kiswahili), not a *trend* claim, so it is not the defect this phase targeted and `overallTrend` correctly stays `insufficient_data`. Whether a single-data-point current-level comparison should itself carry more hedging language is a legitimate open question, out of this phase's scope (mission named specific confirmed defects; this wasn't one of them).
- **Text-matching coherence rules remain coupled to current composer wording** (`'least secure'`, `'needing attention'`, etc.) — a future wording change could silently stop a rule from firing. Same accepted trade-off as Phase 4A's own residual risks.
- **Parent-facing pages still do not gate on `coherence.result`** — unchanged from Phase 4A's own disclosed, out-of-scope gap.

## 16. Readiness Verdict for Three-Teacher Validation

All three prepared cases are now safe to show to experienced teachers: Victor's false decline is gone (confirmed both at the data level and by visually re-reading the rendered PDF), Cheruiyot's real decline signal is unchanged, and Chebet's genuine uncertainty is preserved and honestly labeled. The Coherence Engine independently catches the entire defect class now, so a recurrence would be caught before a teacher ever sees it, not just prevented by the composer fix alone.

**`READY_FOR_THREE_TEACHER_VALIDATION`.**
