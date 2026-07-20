# Sprint 6A — Canonical Instructional Reasoning Consolidation

## Implementation, following ADR-0028

**Status: Implemented.** Unlike every prior document in this series, this one changed real code. Scope held deliberately narrow per the brief: one duplicate reasoning path retired, nothing else touched.

---

## 1. Repository-Wide Audit — Every Learner-Classification Path

Grep sweep across `lib/` and `app/` for the four-way `critical_gap`/`prerequisite_gap`/`concept_confusion`/`on_track` taxonomy, before any change:

| File | Role |
|---|---|
| `lib/adaptiveLearning/recommend.ts::classifyGroup()` | The canonical instructional classifier (Phase 3, curriculum-aware). Read-only consumer of Projection. |
| `lib/remedial/planner.ts` | An independent, inline classification (see §2) feeding `generateRemedialPlan()` — the confirmed duplicate. |

**Excluded, checked and confirmed out of scope**: `lib/academicClinic/reportGenerator.ts`, `lib/notifications/notify.ts`, `app/api/lesson-plans/[planId]/tsc-view/route.ts` all contain `pct >= 75`-shaped thresholds — but these convert a score to a **display grade letter/label** (e.g. "Grade A-", "Strong"), a different concept entirely from *instructional severity banding for adaptive/remedial action*. Retiring these was never named by ADR-0028 and is exactly the "unrelated refactoring" this sprint was told not to combine with — left untouched.

**Named, not resolved, per ADR-0028 §12's own scope discipline**: `lib/career/careerEngine.ts`/`careerIntelligenceEngine.ts`/`matchEngine.ts` were flagged in ADR-0028 as an open question about internal duplication, not traced there. This sprint did not trace them either — the brief named exactly one duplicate to retire (`remedial/planner.ts`), and this document does not silently expand scope to a second, unverified one. Still open.

---

## 2. Verification: Duplicate, Partially-Overlapping, or Genuinely Different?

Read both implementations in full before writing anything. **Confirmed duplicate, with two concrete, previously-undetected behavioral divergences** — not a cosmetic rewrite of the same rule, an actually different (and in one case, actually wrong) implementation of the same concept:

1. **Level source.** `classifyGroup()` reads `academic.bySubject[subject].latestLevel` from Projection — itself derived from confirmed Evidence via the canonical `marksToLevel()` (`lib/intelligence/cbcScale.ts`), thresholds `75/50/30`. `planner.ts` independently recomputed a level from the same class's raw exam marks using its own hardcoded thresholds: `pct >= 75 ? 4 : pct >= 50 ? 3 : pct >= 25 ? 2 : 1`. **The level-2 threshold differs: 30 vs 25.** A student scoring 26–29% would be `level 2` under the old planner rubric and `level 1` under the canonical one — a genuine, silent misclassification at that boundary, not merely duplicated logic.
2. **Risk signal.** `classifyGroup()` gates `critical_gap` on a **subject-specific** risk flag (`projection.risk.value.flags.find(f => f.subject === subject)?.severity === 'critical'`). `planner.ts` gated on the learner's **platform-wide** `overallRiskLevel === 'critical'` — meaning a learner already flagged critical in, say, English, could have been routed into a Mathematics remedial plan's "needs direct support" group on the strength of an entirely unrelated subject's risk flag.

Confirmed **not** a difference in educational decision — both answer the identical question ("how severe is this learner's gap in this subject, right now") for two different features (Adaptive Assessment vs. Remedial Planning) that have no legitimate reason to disagree.

---

## 3. Migration Performed

`lib/remedial/planner.ts`:
- Deleted the inline `pct`/`level` mark-to-level rubric and the `isProjectionCritical` helper entirely — not wrapped, not kept as a fallback path.
- Added one exported pure function, `resolveRemedialGroupType(projection, subject)`, whose entire body is: call `classifyGroup()` (imported from `lib/adaptiveLearning/recommend.ts`); if it returns a real band, use it; if it returns `insufficient_data`, fold the student into `critical_gap` (when platform-wide risk is already critical) or `prerequisite_gap` (otherwise) — the one piece of logic that legitimately belongs to this feature and not to the canonical classifier: a remedial plan's whole purpose is never dropping an enrolled student, even one with zero academic evidence yet, whereas `classifyGroup()`'s honest `insufficient_data` is exactly the right answer for *it* to give.
- `generateRemedialPlan()`'s student-grouping step now calls `resolveRemedialGroupType()` per student instead of computing `level`/`isCritical` inline. Every downstream step (group labels, teaching actions, peer pairing, teacher allocation, AI narrative enrichment, persistence) is **byte-for-byte unchanged** — none of it referenced the removed `level`/`score` fields directly.

**Public API preserved exactly**: `generateRemedialPlan(input: PlannerInput): Promise<RemedialPlan>` — same signature, same return shape. `app/api/remedial/generate/route.ts` (the one live caller) required zero changes.

---

## 4. Tests — Behavioral Compatibility Demonstrated, Not Assumed

New file: `lib/remedial/planner.test.ts`, 9 pure unit tests (no DB), covering:
- Delegation to `classifyGroup()` for all four real bands (levels 1–4).
- **The cross-subject risk bug, proven fixed**: a critical risk flag for a *different* subject no longer triggers `critical_gap` here, and a platform-wide critical risk no longer overrides a healthy level-4 classification.
- The `insufficient_data` fallback in both its sub-cases (no projection at all; a projection with no academic evidence for this subject), confirmed to land in `critical_gap`/`prerequisite_gap` per the platform-wide risk signal, never silently dropped and never mis-routed into `concept_confusion`/`on_track`.

**One of these tests failed on first implementation** — `resolveRemedialGroupType(undefined, subject)` returned `insufficient_data` directly instead of falling through to the risk-based fallback, an early-return bug in the first draft of the function. The test caught it before merge; the fix was a two-line restructure (checking `projection ? classifyGroup(...) : 'insufficient_data'` uniformly, rather than an early `if (!projection) return`). This is recorded here specifically because "behavioral compatibility must be demonstrated through tests, not assumed" is exactly what surfaced it — an assumption-based review would very plausibly have missed this one.

**Full verification run**:
```
lib/remedial/planner.test.ts        9 pass, 0 fail
lib/adaptiveLearning/recommend.test.ts  24 pass, 0 fail (unmodified, confirming no regression to the canonical classifier itself)
npx tsc --noEmit                    clean
npx eslint lib/remedial/planner.ts lib/remedial/planner.test.ts   clean
```

No existing test file for `lib/remedial/planner.ts` existed before this sprint (confirmed by search) — this is the first test coverage this module has ever had.

---

## 5. Verification Report

**Has duplicate instructional reasoning actually been eliminated?** Yes, for the one path this sprint targeted. `lib/remedial/planner.ts` no longer contains any independent level-from-marks computation or independent risk-gating logic — every real classification decision now flows through `classifyGroup()`. The two confirmed behavioral divergences (§2) are resolved in favor of the canonical function's (correct) behavior, as an explicit, tested, documented consequence of consolidation — not a silent side effect.

**Do any independent classifiers still remain?** Two categories, both named honestly rather than swept under this sprint's own success claim:
1. **Display-only grade-letter thresholds** (`reportGenerator.ts`, `notify.ts`, the lesson-plan TSC view) — confirmed a different concept (grade-letter formatting, not instructional banding), correctly out of scope, not retired.
2. **The career-domain trio** — flagged as an open question by ADR-0028, not traced by this sprint either. This is a real gap in "one canonical instructional reasoning path" as a platform-wide claim, named explicitly rather than implied to be clean.

**Behavioral compatibility**: preserved for every caller-visible contract (`generateRemedialPlan`'s signature, `RemedialPlan`/`RemedialGroup` shape, the API route). Two internal behaviors changed *intentionally* (the threshold bug, the cross-subject risk leak) — both are corrections toward the canonical function's already-verified-correct behavior, not unrelated changes, and both are covered by an explicit regression test proving the fix.

**Test coverage**: 9 new tests, 0 pre-existing tests for this module (a net increase from zero), plus a full re-run of the canonical classifier's own 24 tests confirming it was not altered by this consolidation.

**Does the platform now have one canonical instructional reasoning path?** **For remedial/adaptive severity classification specifically: yes**, with the two named, non-classification-concept exceptions (display formatting; the unaudited career trio) stated honestly rather than omitted. **Platform-wide: not yet fully confirmed** — the career-domain question remains real, open work, not claimed as done here.

This sprint retired one duplicate reasoning path, exactly as scoped — no AI-router migration, no ARDS work, no adaptive-assessment generation, no unrelated refactoring, per the brief's own explicit boundary.
