# EduNexus — Educational Recommendation Calibration Report

**Sprint 29 — Educational Wisdom & Recommendation Calibration**
Date: 2026-07-12
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: audit-only, no code changed. Governed by the Educational Constitution ([[Sprint 25]]). Builds directly on [[Sprint 28]]'s empirically-confirmed finding that Career Intelligence over-specializes at 3 same-subject exams — this sprint does not re-run that simulation, it asks four new, structural questions Sprint 28 didn't: does a staged-specificity model exist at all, does any recommendation say what evidence would change it, is anchoring caused only by the confidence formula or also by stale persistence, and is "Junior stays broad" a real computational guarantee or a presentation convention.

---

## 1. Executive Summary

Sprint 28 found a *threshold* bug: Career Intelligence's confidence formula jumps too fast. This sprint found something more structural underneath it: **the codebase has no concept of a career cluster or family at all.** There is exactly one output shape in `capabilityMatchEngine.ts` — a ranked list of specific occupations (`primary`/`stretch`/`alternative`/`entrepreneurial`, each pointing at one named career). The mission's requested staged ladder — emerging interests → capabilities → clusters → families → specific exploration → readiness — cannot currently be built by tuning a threshold, because there is no intermediate stage in the type system to progress *into*. Sprint 28's fix recommendation (add a diversity gate to the confidence formula) would soften the bug; it would not create the staged progression this sprint's mission actually asks for.

Three further findings sharpen the picture. First, **"Junior School stays broad" is not enforced where it matters**: the only grade-based gate in the codebase (`clinicReportBuilder.ts`, `grade >= 10`) protects a different, older report — the live student-facing Career Explorer and its underlying `capability-matches`/`intelligence-report` APIs have no grade parameter at all, so a Grade 7 student with three exams gets the identical specific-career response as a Grade 12 student. Second, **anchoring has a second cause beyond the confidence formula**: capability profiles are read from a persisted database row (`students.capability_profile`) by default, and nothing in the Evidence Domain's `markSuperseded` lifecycle invalidates that row when an assessment is corrected — so even after evidence changes, a stale conclusion can keep serving until something explicitly triggers a recompute. Third, **only Blueprint tells the reader what additional evidence would help**, and even there it only says what would raise confidence, not what could change the conclusion — Career Intelligence, Holiday Planner, and Adaptive Learning have no such field at all.

**Verdict: NO-GO on Career Intelligence's readiness to serve Junior School students** as currently built — this is not a hedge-language problem, it's an absent structural guarantee. **CONDITIONAL GO** on everything else. Detail in §11.

---

## 2. Recommendation Progression Audit (Objectives 1, 4, 5, 6)

| Subsystem | Progressive specificity? | Evidence |
|---|---|---|
| Blueprint | **Yes** — `isPlaceholder`/`confidence === 0` checks (`blueprint.ts:69-72`) return an explicit "insufficient evidence" state rather than a graded claim; capability level (`emerging`→`exceptional`) genuinely tracks accumulated evidence per Sprint 24/26's prior verification | Re-confirmed, no new violation |
| Career Intelligence | **No — structurally absent, not just miscalibrated** | §3 |
| Holiday Planner | Yes — Sprint 28 confirmed Tier-1 behavior stays light; no new violation found this pass | Sprint 28 §5 |
| Parent Pulse | Yes — hedges phrasing on low confidence without ever escalating claims ahead of evidence, per Sprint 26 | No new check this pass, no reason found to revisit |
| Progress / Reports | Not directly re-checked this pass; Sprint 27's finding that `clinicReportBuilder.ts` computes from a single latest snapshot (no trend/longitudinal weighting) remains the live concern here, unchanged | Sprint 27 §3.4 |
| Compass, Adaptive Learning, Monday Panel | Not re-checked this pass — no new evidence to add beyond Sprints 26–27's findings | — |

## 3. Career Recommendation Calibration (Objectives 2, 13, 14)

**The mission's requested six-stage ladder does not exist in the codebase, in either direction.** `CapabilityMatchReport`'s type (`lib/career/types.ts:456-467`) has four *confidence* tiers (`primary`/`stretch`/`alternative`/`entrepreneurial`), each pointing at one specific `Career` record — there is no "cluster" or "family" type anywhere in `lib/career/types.ts`. The `dominant_cluster` field that exists (`types.ts:34`) is not a career cluster; it's a label built from the student's top *capability dimensions* (e.g. `analytical_reasoning`), reused as a string, with no relationship to any grouping of occupations. **This means Sprint 28's recommended fix (tightening the confidence threshold) would reduce false confidence but would not deliver staged progression — there is currently nowhere less specific than "a named career" for the system to output.**

**"Junior stays broad" is a presentation convention in one report, not a computational guarantee in the live product.** The only code gating career specificity by grade is `lib/career/clinicReportBuilder.ts:682-683` (`section = grade >= 10 || curriculum === 'igcse' ? 'senior' : 'junior'`), which governs the Academic Clinic PDF — a different, older pipeline from Sprint 27's duplicate inventory. The live, student-facing Career Explorer (`app/(student)/career/page.tsx`) calls `computeCapabilityMatches()` via `/api/career/capability-matches`, and that function takes **no grade parameter at all**. A Grade 7 student with three same-subject exam scores receives the identical `primary`-tier, named-career, High-confidence response Sprint 28 reproduced for its synthetic test student — there is nothing in the code path that would behave differently for a 13-year-old than for a Grade 12 student. This directly fails Objective 13 ("career exploration remains broad in Junior School... narrows gradually") at the computational layer, not merely in AI narrative tone.

## 4. Confidence Progression Verification (Objective 3)

Re-affirms Sprint 28's formula-level findings (`confidenceFromAssessmentCount()`'s Low→High jump at count≥3 with no diversity check; `capabilityProjector.ts`'s flat confidence on repeat same-subject evidence; `coverage.ts`'s mean-based formula that can drop on added source diversity) — not re-tested this pass, cited as still open. **New this pass**: confidence *progression* is further undermined by §5's persistence gap — even where the formula is eventually fixed, a persisted, unrefreshed `capability_profile` row means the *displayed* confidence may not reflect current evidence at all, correct formula or not.

## 5. Educational Anchoring Analysis (Objectives 9, 10, 11, 12)

Two independent anchoring mechanisms were found, not one:

1. **Algorithmic anchoring** (Sprint 28's finding, restated): the confidence-threshold bug locks in a specific pick at low evidence and that pick doesn't get revised because later evidence rarely triggers a *higher* tier once "High" is already reached — there's no tier above High to move into, and no re-evaluation logic that revisits an earlier specific pick when better evidence arrives.
2. **Persistence anchoring** (new this pass): `getCapabilityProfile()` (`lib/career/careerEngine.ts:391-395`) reads a **persisted row** (`students.capability_profile`) by default — it does not recompute. Fresh computation only happens via `recomputeAndSaveCapabilityProfile()`, called from exactly three places, none of which fire on evidence *correction*. Traced the Evidence Domain's `markSuperseded()` (`lib/intelligence/evidenceLifecycle.ts`) across its ~20 call sites (Compass, Holiday, Projection, formative signals, assignments, Remedial) — **none of them touch `careerEngine.ts` or invalidate `students.capability_profile`.** Both `GET /api/career/capability-matches` and `GET /api/career/intelligence-report` — the two live-read paths — serve this same persisted row, unrefreshed.

**Consequence**: even a learner whose earlier, mistaken assessment is later corrected or superseded can keep seeing the old, now-invalid career conclusion indefinitely, until some other code path happens to trigger a POST-based recompute. This is a stronger, more literal violation of Objective 9 ("guidance always remains reversible as new evidence arrives") than a confidence-formula tuning issue — reversibility isn't just miscalibrated here, it's architecturally not wired up for the correction case.

## 6. Constitution Compliance Matrix

| Principle | Status |
|---|---|
| Evidence suggests, never dictates | Violated at Junior grade level (§3) — a specific career is dictated by three same-subject scores regardless of grade |
| Confidence grows with evidence | Partially held (Sprint 28); undermined further by persistence anchoring (§5) |
| Recommendations become more specific only as evidence justifies | **Structurally impossible to satisfy today for Career Intelligence** — no intermediate "cluster/family" stage exists to grow into |
| AI explains possibilities, never predicts destiny | Violated — the deterministic scoring layer (not the AI narrative layer) is what produces the specific career; the AI-level grounding rules Sprint 23 hardened don't reach this problem, since it happens upstream of any prompt |
| Every recommendation remains open to revision | Violated for corrected/superseded evidence (§5) |
| Missing evidence ≠ poor performance / lower confidence ≠ lower ability | Not implicated by this sprint's new findings; holds per Sprints 26–28 |

## 7. Recommendation Explainability (Objective 7)

Only Blueprint exposes a structured "what would strengthen this" field (`BlueprintEvidenceSummary.recommendedNextEvidence`, `lib/learnerIntelligence/types.ts:19-20`) — and even there, it states what would raise *confidence*, not what could *change the conclusion*, which is a narrower guarantee than Objective 7 asks for. Career Intelligence has only a generic prose caveat ("this will sharpen as more evidence arrives," `capabilityMatchEngine.ts:180-182`) with no structured field and no specificity about which evidence would matter. Holiday Planner and Adaptive Learning have neither the "why" field's sibling nor any evidence-strengthening pointer at all (confirmed absent by direct grep). **No subsystem currently answers Objective 7's second half — "what additional evidence could strengthen or change it" — in a way a teacher or parent could act on** (e.g., "this becomes a specific recommendation once you've entered assessments in two more subjects").

## 8. Educational Risk Ranking (harm order)

1. **Junior School receiving specific career recommendations with no grade gate on the live surface (§3)** — highest priority. This is the platform's most explicit, most memory-documented design mandate ("Junior: explore broad career families, no career prediction," recorded 2026-07-07) failing at the exact age group it was written to protect, on the exact live student-facing page real learners use.
2. **Absence of any cluster/family stage in the type system (§3)** — a prerequisite blocker for #1's real fix; tuning the confidence threshold alone (Sprint 28's original recommendation) cannot resolve this on its own.
3. **Persistence-caused anchoring surviving evidence correction (§5)** — lower daily-traffic visibility than #1, but a sharper violation of "recommendations remain reversible" in principle, since it means the system can be *provably wrong after correction* and still not know it.
4. **No structured "what would change this" field anywhere except Blueprint's narrower "what would strengthen this" (§7)** — a transparency gap rather than a wrong-conclusion risk; lower harm, real trust cost.

## 9. Recommended Safe Consolidations

No architecture redesign — every item reuses existing types/functions or adds a narrow field:

1. **Add a grade parameter to `computeCapabilityMatches()`** (or gate its call site in `/api/career/capability-matches/route.ts`) so Junior School (Grade 7-9) responses are structurally capped at the `dominant_cluster`/capability-dimension level and never include a specific `primary`/`entrepreneurial` career match, mirroring the gate `clinicReportBuilder.ts` already implements for the Academic Clinic report — reuse that existing pattern rather than inventing a new one.
2. **Introduce a minimal `CareerCluster`/`CareerFamily` output shape** (even a lightweight wrapper grouping existing `Career` records by an existing taxonomy field, if one exists in the `careers` table — check before adding a new column) so Senior School students with thin evidence have somewhere less specific than a named occupation to land, satisfying Objective 2's staged ladder without a new intelligence model.
3. **Wire `markSuperseded()` (or a new, narrow event) to invalidate `students.capability_profile`**, triggering `recomputeAndSaveCapabilityProfile()` the next time it's read stale, rather than requiring an explicit POST — smallest safe fix is a staleness check at read time (compare `capability_profile.computed_at` against the evidence's `superseded_at`), not a new invalidation architecture.
4. **Extend `BlueprintEvidenceSummary`'s pattern to Career Intelligence**: add a structured `evidenceThatCouldChangeThis: string` (or similar) field to `CapabilityCareerMatch`, populated the same way `recommendedNextEvidence` already is in Blueprint — copy the existing pattern rather than designing a new one.
5. **Carried over, still open**: Sprint 28's confidence-threshold/diversity-gate fixes remain valid and should land alongside item 1-2 above, since they address the calibration half of the same problem this sprint addressed the staging half of.

## 10. Regression Results

- **TypeScript**: same 2 pre-existing errors as every prior sprint (`scripts/create-compass-auto-confirm-account.ts`, `scripts/reference-school/integration.test.ts`), plus the same pre-existing Sprint-27-introduced script-only error (`scripts/trace-consistency-audit.ts:112`). Zero new errors in application code.
- **ESLint**: zero errors/warnings across `lib/career`, `lib/learnerIntelligence`, `app/api/career`, `app/(student)/career`.
- **Production build**: compiles successfully; type-check step fails only on the same pre-existing `scripts/` file.
- No code changed this sprint; baseline unchanged from Sprints 27–28.

## 11. Final Verdict

**NO-GO on Career Intelligence's readiness to serve Junior School students as currently built. CONDITIONAL GO on everything else.**

This is a firmer verdict than Sprint 28's "fix the threshold before next term" framing, because this sprint found the problem is one level deeper: there is no grade gate on the live Career Explorer surface at all, and no intermediate output stage to fall back to even if one were added. A Grade 7 student using the platform today, with the thinnest possible evidence, can receive a specific, confidently-labeled career recommendation — the exact outcome the platform's own design mandate says must never happen at that age. This is not a hedge-language or confidence-calibration issue that AI prompt-grounding can soften; it happens in the deterministic scoring layer, upstream of anything the AI narrative writes.

The fix (§9 items 1 and 4 particularly) is small and does not require the cluster/family type work (item 2) to ship first — a grade gate alone would stop the immediate harm while the staged-progression work is scoped properly. Recommend treating item 1 with the same urgency Sprint 27 gave its persistence bug and Sprint 28 gave its Tier-2 threshold: this is a live, real-student-facing gap in the platform's most publicly stated child-safety commitment, not a theoretical one.
