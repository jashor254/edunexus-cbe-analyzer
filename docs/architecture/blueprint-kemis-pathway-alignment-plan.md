# Learner Blueprint × KEMIS Career Pathway Alignment — Plan

**Date:** 2026-08-13
**Type:** Plan. Follows CLAUDE.md "Before Building Any New Feature" — approval gate per step.

> **Status update, same day.** The founder directed a full career-pipeline fix
> ("you are the driver here"), which superseded the step-gate in this document.
> **Step 1 is built and shipped** — `lib/learnerBlueprint/composePathwayReadiness.ts`,
> rendered on the teacher/learner Blueprint (Page 4) and in the parent portal.
> Steps 2–5 (tracks, learner voice, aspiration capture, curriculum rule-set
> extraction) remain unbuilt and still gated on the KEMIS source in Step 0.
>
> Work not in this plan also shipped alongside it — a career knowledge
> lifecycle, a human review gate on AI-generated careers, and removal of a
> fabricated market signal. See the commits from `34279cd` onward.
**Question:** the Blueprint is evidence-honest and readable. Is it *decision-useful* against the actual national decision a Kenyan learner faces — the KEMIS/KNEC Senior School pathway, track, subject-combination and school selection?

---

## 0. Honest note on the source material

I could not retrieve an authoritative Ministry of Education / KNEC / KEMIS **career guidance guidelines PDF**. What is publicly reported and consistent across sources is summarised in §1. Everything in this plan that depends on an exact rule (subject counts, compulsory subjects, track-to-subject maps, cut-offs) is marked **NEEDS SOURCE** and is deliberately *not* encoded until the real document is in hand. Building a national placement rule from a news article is exactly the kind of fabrication the Constitution forbids.

**Action required from the founder:** obtain the KNEC Grade 10 subject-selection guidelines and the MoE/KEMI career-guidance handbook (KEMI's Junior School career-guidance training ran 17 Aug – 12 Sep 2026; its materials are the most likely authoritative artefact). Until then, Step 1 below is the only step that can start.

---

## 1. What KEMIS/CBE actually requires (as publicly established)

| Fact | Status |
|---|---|
| Three senior pathways: **STEM**, **Social Sciences**, **Arts & Sports Science** | Established |
| Tracks beneath them — STEM: Pure Sciences / Applied Sciences / Technical & Engineering; Social Sciences: Humanities / Business & Entrepreneurship; Arts & Sports: Performing Arts / Visual Arts / Sports | Reported, consistent |
| Placement score = 20% KPSEA (Grade 6) + 20% SBA (Grades 7–8) + 60% KJSEA (Grade 9) | Reported, consistent |
| Selection runs through an automated national platform (`selection.education.go.ke`); junior schools must guide learners through it | Established |
| Career guidance/counselling is **mandatory before choices are finalised**, and must be "learner-centred, evidence-based, and guided by interests, abilities, talents and long-term aspirations" | Established |
| Schools must keep accurate learner records and submit through designated platforms | Established |
| Exact compulsory subjects, subjects-per-learner count, per-track subject combinations, pathway cut-offs | **NEEDS SOURCE** |

**The single most important line for us:** the state now requires *evidence-based* career guidance and does not supply the evidence. That is the Blueprint's job, and it is the sharpest pilot pitch this product has.

---

## 2. Where we actually are today

### Built and working
- `lib/learnerBlueprint/composeBlueprint.ts` — canonical composer, ~20 section composers, every section wrapped in `BlueprintSection<T>` with `available | unavailable | not_implemented`. Sections hide honestly when thin. This is solid and should not be rebuilt.
- `lib/learnerBlueprint/gradeBand.ts` — four bands (`grade_7_8`, `grade_9`, `grade_10`, `grade_11_12`) already encoding the correct asymmetry: pathway is a **forecast** for juniors, a **settled fact** for seniors.
- `lib/pathwayCalculator.ts` (1,102 lines) — `calculateJuniorPathwayAffinity()`, `calculateKJSEAComposite()`, `calculatePathwayGapAnalysis()` returning `PathwayResult` with key levers and "next doors"; `PATHWAY_RULES`, `PATHWAY_WEIGHTS`, a versioned `KjseaRuleSet` and a `PATHWAY_DISCLAIMER`. Real work, already done.
- `lib/career/types.ts` — `CareerPathway = 'STEM' | 'Social Sciences' | 'Arts & Sports Science'`, the three official pathways, every seeded career mapped to exactly one.
- Blueprint ↔ Compass bridge — `composeLearningCompass.ts`, `deliverBlueprintActionToCompass()`, `lib/compass/deliveryBinding.ts`. An approved Blueprint action already becomes Compass work.
- Blueprint Action Plan lifecycle — propose → approve → deliver (assignment **or** Compass) → review. Human review gate per ADR-0031.
- Three audiences already render: teacher (`/student/blueprint/[learnerId]` + `ClassBlueprintTable`), parent (`/(parent)/child/[learnerId]/full`), learner (same route, `requireLearnerAccess`).

### The five real gaps

**GAP-1 — The pathway engine does not reach the Blueprint.** Confirmed by search: nothing in `lib/learnerBlueprint/`, `components/blueprint/`, or `components/parent/` imports `pathwayCalculator`, `PathwayResult`, or `pathwayGapAnalysis`. `CareerData` carries `careerCluster`, `futureDirection`, `aiOutlook` — prose strings — and **no pathway, no composite, no gap, no lever**. The Blueprint tells a Grade 9 learner about a "career cluster" in the term they must choose a national pathway. This is the highest-value gap in the product and it needs no new intelligence — the engine already exists, unused, one composer away. (Same failure shape as Sprint 30: the fix already existed, 12 of 13 consumers didn't use it.)

**GAP-2 — There is no track layer.** We model 3 pathways. KEMIS decides at pathway **and** track **and** subject-combination level. A learner told "STEM" still cannot fill the form.

**GAP-3 — There is no learner voice.** `app/student/blueprint/[learnerId]/page.tsx` renders `BlueprintView` — the teacher's component. The parent gets a genuine audience treatment (`ParentBlueprintView`, ADR-0010 visibility matrix); the learner gets the teacher's document. The stated goal — "a learner can understand it, a parent can, a teacher can" — is two-thirds met.

**GAP-4 — Interests and aspirations are not captured.** KEMIS requires guidance on "interests, abilities, talents **and long-term aspirations**." We measure ability from evidence, and infer the rest. Nowhere does the learner state what they want. A recommendation that ignores aspiration is not learner-centred, and a parent will reject it on sight.

**GAP-5 — Curriculum adaptability is asserted, not built.** `CurriculumType = 'cbc' | 'igcse' | 'ib' | 'other'` — **8-4-4 is absent** despite CLAUDE.md naming it a target curriculum. CBC levels are hardcoded 1–4 in `BlueprintView.tsx`/`types.ts` with no curriculum branching in the Projection pipeline (already flagged in the Kenyan School Evolution Audit, 2026-08-03). `IGCSEPathway` exists in `pathwayCalculator.ts` but is a parallel, unrelated code path.

---

## 3. The design principle this plan is built on

> **One Blueprint. One composition. Three voices. Two horizons.**

- **One composition** — `composeBlueprint()` stays the single source. No parent-Blueprint, no learner-Blueprint, no KEMIS-Blueprint. Sections are composed once; audiences select and phrase.
- **Three voices** — teacher (diagnostic, actionable), parent (plain, decision-supporting), learner (second person, agency-giving, never labelling).
- **Two horizons** — junior: *pathway is a forecast with a gap you can still close*. Senior: *pathway is settled; fit and destination are the live questions*. `gradeBand.ts` already encodes this; the pathway section must obey it.
- **CBE-first, curriculum-adaptable** — the *shape* of the pathway question ("which door am I heading toward, what closes it, what opens it") is universal. The *rules* (levels, composites, tracks) are per-curriculum data. Adaptability = extracting the rule set behind an interface, not writing IGCSE code.

---

## 4. Proposed step sequence

Each step is an approval gate. Nothing after Step 1 starts before the KEMIS source arrives.

### Step 0 — Obtain source (founder, blocking for Steps 2+)
KNEC Grade 10 selection guidelines + KEMI career-guidance materials. Encode nothing until then.

### Step 1 — Pathway Readiness reaches the Blueprint *(no new intelligence; unblocks now)*
1. **Tables/columns:** none. Reads existing Projection + evidence.
2. **Reuse:** `calculateJuniorPathwayAffinity`, `calculatePathwayGapAnalysis`, `calculateKJSEAComposite`, `PATHWAY_DISCLAIMER`, `gradeBand.ts`, `getCareerBlueprintSummary`.
3. **New `lib/`:** `lib/learnerBlueprint/composePathwayReadiness.ts` → `BlueprintSection<PathwayReadinessData>`; `PathwayReadinessData` added to `types.ts`; wired into `composeBlueprint.ts`. Band-aware: `grade_7_8` = "this work already counts" (no forecast); `grade_9` = full forecast + gap + levers; `grade_10` = fit check; `grade_11_12` = section `unavailable` by design, not by failure.
4. **Routes:** none.
5. **Components:** one `PathwayReadinessSection` in `components/blueprint/sections.tsx`, reused verbatim by teacher and parent views.
   *Honesty rule:* below the evidence threshold the section returns `unavailable` with a real reason. No pathway is ever guessed.

### Step 2 — Track + subject-combination layer *(needs Step 0)*
Extend `CareerPathway` with a track dimension and a per-track subject-requirement map sourced from KNEC, versioned exactly as `KjseaRuleSet` already is. Blueprint then answers "STEM → Applied Sciences → these subjects", and Career Intelligence maps careers to track, not just pathway.

### Step 3 — Learner voice *(can run parallel to Step 2)*
`LearnerBlueprintView` — same `composeBlueprint()` output, learner phrasing, learner visibility matrix (an ADR-0010 sibling). Second person, no risk-labelling, every finding paired with something the learner can do. Compass already speaks to learners; reuse that register.

### Step 4 — Aspiration capture *(needs Step 0's guidance framing)*
A small learner-stated interest/aspiration record (new table, learner-owned, evidence-typed). Fed into the pathway section as a **stated preference set beside the evidence**, never blended into it — "you want X; the evidence points toward Y; here is the distance between them" is the honest and genuinely useful output, and it is exactly what the state's "interests + abilities + aspirations" wording asks for.

### Step 5 — Curriculum rule-set extraction *(last, deliberately)*
Add `'844'` to `CurriculumType`. Extract the CBC 1–4 level scale and pathway rules behind a curriculum rule-set interface, CBC as the reference implementation. Per Start-Simple-Grow-Later: do this *after* CBE is genuinely right, not before.

---

## 5. Governance check

- **Foundation Freeze / PE-1** — this plan is engineering, and PE-1's filter is "does this remove a REAL blocker a pilot hit TODAY." **Step 1 is the only step with a credible claim**, and only if a pilot conversation is actually turning on pathway guidance. Otherwise this document is a plan on the shelf, correctly, until a school asks. **Founder decides; not assumed here.**
- **ADR-0031** — any pathway-derived action still passes the human review gate. Unchanged.
- **Career Principle grade gate** (`29afb8a`) — juniors get orientation, never a specific job. The pathway section is a *pathway* forecast, not a career prediction; the existing gate stays authoritative.
- **Evidence-First Mandate** — every pathway claim carries Observation / Evidence / Confidence / Action, and degrades to `unavailable` rather than guessing.

---

## 6. Recommendation

Approve **Step 1 only**, and only if pathway guidance is live in a pilot conversation. It is the largest gain in the document: a working engine, a required national decision, and zero new intelligence, tables, or routes. Steps 2–5 wait on the KEMIS source and on real pilot demand.
