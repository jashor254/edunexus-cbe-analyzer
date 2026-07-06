# Lean Intelligence Layer — Migration Plan

Branch: `refactor/lean-intelligence-layer`
Status: **Phase 0 (audit + plan) and Phase 1 (freeze EILS/EIR) both complete.
Phase 2 (prerequisite engine) in progress — see below.**

Target shape: learning signals in (Door 1 + Door 2) → prerequisite intelligence
out → prioritized remedial + TSC docs + parent report. No fees, no payroll, no admin.

---

## Phase 2 — Prerequisite Intelligence Engine

### `substrand_prerequisites` — ABANDONED (2026-07-07)

A new table + seed (`substrand_prerequisites`, `lib/curriculum/prerequisites/grade7MathematicsSeed.ts`,
`supabase/migrations/20260707_substrand_prerequisites.sql`) was drafted for a
Grade 7 Mathematics prerequisite graph, grounded in the KICD curriculum bank
(`sow_substrands`) since no live Grade 7 usage data exists yet.

**Discarded before anything was applied to the database** — a live, seeded,
KEEP-zone prerequisite graph already exists: `knowledge_nodes` / `knowledge_edges`
(Grade 7 Mathematics: 15 nodes, ~28 weighted hard/soft edges, with per-edge
rationale), with a working traversal engine (`lib/knowledgeGraph/traversal.ts`,
`findRootCauses`/`findAllRootCauses`) already wired into `lib/remedial/planner.ts`.
Shipping a second, disagreeing prerequisite graph for the same domain would have
been a direct duplication of a system that's already live product — the
Prerequisite Intelligence Engine is being built on top of `knowledge_nodes`/
`knowledge_edges` instead. No migration was ever applied; no seed was ever run;
nothing in `substrand_prerequisites` ever existed in the database. Files removed
(`rm`, not `git rm` — all three were untracked, never committed):
- `lib/curriculum/prerequisites/grade7MathematicsSeed.ts`
- `supabase/migrations/20260707_substrand_prerequisites.sql`
- `scripts/seed-substrand-prerequisites.ts`

Left in place (currently unreferenced by anything, pending a decision — see
end-of-turn report): `lib/curriculum/prerequisites/{types.ts, dag.ts, seed.ts}`.

### The 23 hand-validated edges — preserved here as an independent check

Before the discard, these 23 edges were drafted from the KICD curriculum bank
and reviewed edge-by-edge by a human (topic-level granularity, not the
existing graph's node IDs). They were never applied to any table. Keeping
them here — not deleting them — because they're a second, independently-derived
opinion on Grade 7 Mathematics prerequisites, useful for diffing against
`knowledge_edges` to sanity-check its coverage (see Phase 2 taxonomy
reconciliation below for that diff).

| Prerequisite → Unlocks | Rationale |
|---|---|
| Whole Numbers → Factors | GCD/LCM needs whole-number mult/div |
| Whole Numbers → Fractions | Fraction ops build on whole-number ops |
| Factors → Fractions | Simplifying fractions needs GCD/LCM |
| Fractions → Decimals | Decimals extend fraction place-value |
| Fractions → Squares and Square Roots | Squaring fractions needs fraction mult |
| Decimals → Squares and Square Roots | Squaring decimals needs decimal mult |
| Whole Numbers → Algebraic Expressions | Same ops, applied symbolically |
| Algebraic Expressions → Linear Equations | Must simplify before solving |
| Linear Equations → Linear Inequalities | Same technique + sign-flip rule |
| Fractions → Money | Profit/loss/discount are fraction-of-quantity |
| Decimals → Money | Currency is decimal by convention |
| Whole Numbers → Length | Unit conversion is whole-number arithmetic |
| Length → Area | Area formulas built from length |
| Area → Volume and Capacity | Volume extends area to 3D |
| Squares and Square Roots → Pythagorean Relationship | a²+b²=c² needs squaring/roots |
| Length → Pythagorean Relationship | Applied to find side lengths |
| Whole Numbers → Time, Distance and Speed | Unit conversions |
| Length → Time, Distance and Speed | Distance is a length quantity |
| Whole Numbers → Temperature | Conversion arithmetic |
| Whole Numbers → Angles | Missing-angle problems are whole-number subtraction |
| Angles → Geometrical Constructions | Constructions require angle theory |
| Whole Numbers → Data Handling | Tallying/frequency needs counting |
| Fractions → Data Handling | Pie charts need fraction-of-whole |

---

## Phase 1 execution log (post-approval)

Executed in the amended order (AttentionFeed lifted before the freeze, since
it's KEEP, not FREEZE):

- [x] 0. Dependency-closure gate on `buildTeacherPanel` — **PASS**. Its
      closure only touches `lib/learnerModel/queries`, `lib/learnerModel/types`,
      `lib/knowledgeGraph/types` (type-only, via `eils/types.ts`), and a direct
      `class_students`/`students` DB read. Zero reach into EILS
      reasoning/arbitration/coordinator layers. Proceeded.
- [x] 1. Lifted `buildTeacherPanel` (+ all its private helpers and the 5 types
      it needs: `TeacherPanel`, `StudentAttentionItem`, `MisconceptionAlert`,
      `AccelerationCandidate`, `MasteryHeatmapRow`) out of
      `lib/eils/teacherIntelligence.ts` into new `lib/attentionFeed/panel.ts`.
      `lib/attentionFeed/sources.ts` now imports from there instead of
      `lib/eils`. Byte-identical logic — same output, new home.
- [x] 2. Verified: `tsc --noEmit` clean, `next build` clean,
      `/teacher/dashboard` (renders `<AttentionFeed />`) compiled.
- [x] 3. Froze EILS: `lib/eils/` → `_frozen/eils/`, `app/api/eils/` →
      `_frozen/api-eils/` (`git mv`, fully recoverable). Severed the 4 KEEP-flow
      call sites — see below.
- [x] 4. Froze EIR: `lib/eir/` → `_frozen/eir/`, `app/api/eir/` →
      `_frozen/api-eir/`, `app/api/cron/eir-research/` →
      `_frozen/api-cron-eir-research/` (`git mv`). No live call sites existed
      for `runLearnerResearchCycle`/`runPlatformResearchCycle` — both triggers
      were only ever called from the now-dead `_frozen/eils` files.
- [x] 5. Full build + typecheck — **zero TS errors**, all 4 KEEP flows verified
      present and compiling: `/api/teacher/assessments/process`,
      `/api/learn/end`, `/api/formative/signal`, `/teacher/analytics`,
      `/teacher/dashboard`.
- [x] 6. This section.

### What changed in the 4 KEEP-flow call sites

Each of these now calls the underlying `lib/learnerModel/updater` function
directly instead of the EILS wrapper — dropping only the fire-and-forget
side effects (event emission, next-best-action recompute, EIR triggers) that
the Phase 0 audit already identified as non-load-bearing:

| File | Before | After |
|---|---|---|
| `app/api/teacher/assessments/process/route.ts` | `afterAssessment(...)` (awaited inside `triggerEILSUpdate`, itself fire-and-forget at the call site) | `updateFromAssessment(...)`, function renamed `triggerLearnerModelUpdate` |
| `app/api/learn/end/route.ts` | `afterCompassSession(...).catch(() => {})` | `updateFromCompass(...).catch(() => {})` |
| `app/api/formative/signal/route.ts` | `afterFormativeSignal(...)` × 3 (fire-and-forget) | `updateFromFormativeSignal(id, snapshot)` × 3 |
| `lib/parentPulse/observationPipeline.ts` | `await afterParentObservation(...)` | `await updateFromParentObservation(...)` |

### Internal frozen-tree consistency fixes (not behavior changes)

A few cross-references between EILS and EIR needed their import paths
repointed to `@/_frozen/...` so the whole tree still typechecks — these are
frozen-file-to-frozen-file references only, nothing live touches them:

- `_frozen/eir/engine.ts`, `_frozen/eir/explainability.ts`: `EILSRecommendation`
  type import repointed from `@/lib/eils/types` → `@/_frozen/eils/types`
- `_frozen/eils/continuousLearning.ts`, `_frozen/eils/nextAction.ts`:
  `runLearnerResearchCycle`/`afterRecommendationCreated` import repointed from
  `@/lib/eir/engine` → `@/_frozen/eir/engine`
- All 7 `_frozen/api-eils/*/route.ts` files: `@/lib/eils` → `@/_frozen/eils`
- All 8 `_frozen/api-eir/*/route.ts` + `_frozen/api-cron-eir-research/route.ts`:
  `@/lib/eir` → `@/_frozen/eir`

### Frozen paths (recoverable via `git mv` back, nothing deleted)

- `_frozen/eils/` (10 files) — was `lib/eils/`
- `_frozen/api-eils/` (7 route files) — was `app/api/eils/`
- `_frozen/eir/` (11 files) — was `lib/eir/`
- `_frozen/api-eir/` (8 route files) — was `app/api/eir/`
- `_frozen/api-cron-eir-research/` (1 route file) — was `app/api/cron/eir-research/`

### DB tables — listed, NOT dropped

**EILS tables:** `eils_events`, `eils_interventions`, `eils_milestones`, `eils_recommendations`

**EIR tables:** `eir_misconceptions`, `eir_learning_trajectories`,
`eir_intervention_effectiveness`, `eir_personalization_models`,
`eir_career_development`, `eir_kg_discoveries`, `eir_risk_predictions`,
`eir_recommendation_outcomes`, `eir_hypotheses`, `eir_findings`

These 14 tables still exist in the database, still have their migrations in
`supabase/migrations/`, and are pending a future decision on whether to drop
them. No migration has been written for this yet — deliberately deferred.

---

## 1. Orientation — current top-level structure

**`lib/`** (56 dirs/files): the two speculative engines — `eils/`, `eir/` — sit
alongside the real product logic: `learnerModel/`, `teachingIntelligence/`,
`remedial/`, `holiday/`, `compass/`, `parentPulse/`, `sow/`, `lessonPlan/`,
`row/`, `career/`, `knowledgeGraph/`, `payments/`, `whatsapp/`, `events/`, plus
a **new, uncommitted** `attentionFeed/` module and `config/attentionFeedTiers.ts`.

**`app/api/`** (49 dirs): `eils/` and `eir/` are self-contained route groups
(7 + 8 routes). The real product's routes — `teacher/`, `learn/`, `formative/`,
`assessments/`, `sow/`, `holiday/`, `remedial/`, `parent/`, `whatsapp/`,
`cron/` — are separate and mostly do not reach into `eils`/`eir`. A **new**
`teacher/attention-feed/` and `teacher/cohorts/` route pair was added this
session (uncommitted) and does reach into `eils`.

There is **no** marketplace/plugin/CLI/certification code inside this repo at
all — that entire spec lives only as docs (`docs/developer-platform*.md`,
`docs/dx-ecosystem-blueprint.md`, `docs/developer-portal-ui-blueprint.md`) and
as a **separate sibling repository**, `edunexus-devportal/`, which has its own
`app/(marketplace)`, `(ai-studio)`, `(ekg)`, `(dashboard)` route groups. That
repo is untouched by this branch — see §3 PARK for what that actually means.

---

## 2. Dependency audit

### 2a. Everything importing `lib/eils`

| File | Uses | Breaks if removed |
|---|---|---|
| `app/api/eils/events/route.ts` | `emitEvent` | Route itself is EILS-only — dies with the freeze, which is correct. |
| `app/api/eils/profile/[studentId]/route.ts` | `buildIntelligenceSnapshot` | Same — EILS-only route. |
| `app/api/eils/reason/[studentId]/route.ts` | reasoning engine fns | Same. |
| `app/api/eils/recommend/[studentId]/route.ts` | `computeNextBestActions`, `markRecommendationActioned` | Same. |
| `app/api/eils/teacher/[teacherId]/panel/route.ts` | `buildTeacherPanel` | Same — but see attention-feed overlap below. |
| `app/api/eils/school/[schoolId]/intelligence/route.ts` | `buildSchoolIntelligence` | Same. |
| `app/api/eils/parent/[studentId]/pulse/route.ts` | `buildParentInsight` | Same. |
| `app/api/learn/end/route.ts` | `afterCompassSession` | **KEEP flow.** Not awaited (`fire and forget`, no `.catch` on the call site but internals self-catch) — see 2b. |
| `app/api/formative/signal/route.ts` | `afterFormativeSignal` | **KEEP flow.** Awaited directly; internals are also low-risk (see 2b). |
| `app/api/teacher/assessments/process/route.ts` | `afterAssessment` | **KEEP flow.** Awaited — see 2b for what's actually load-bearing inside it. |
| `lib/parentPulse/observationPipeline.ts` | `afterParentObservation` | **KEEP flow** (parent report). Needs a shim. |
| `lib/attentionFeed/sources.ts` | `buildTeacherPanel` (direct from `lib/eils/teacherIntelligence`, bypassing the barrel), `StudentAttentionItem` type | **New, uncommitted, wired into the teacher dashboard already** — see §2c, this is the important one. |
| `lib/eir/engine.ts`, `lib/eir/explainability.ts` | `EILSRecommendation` type only | Internal to EIR, dies with EIR. |

### 2b. What's actually load-bearing in the two KEEP integration points

**`afterAssessment` (`app/api/teacher/assessments/process/route.ts:148`, awaited):**
```
1. await updateFromAssessment(...)          // lib/learnerModel/updater — NOT eils, stays regardless
2. void emitEvent(...)                      // writes to eils_events — cosmetic, safe to drop
3. void publishEvent(...)                   // lib/events — stays, unrelated to eils
4. void computeNextBestActions(...).catch() // EILS-only, fire-and-forget, safe to sever
5. void detectAndRecordCareerMilestones(...).catch()
6. void checkInterventionOutcomes(...).catch()
7. void detectTermBreakthrough(...).catch()
8. void runLearnerResearchCycle(...).catch()// EIR call, fire-and-forget, safe to sever
```
Only step 1 is `await`ed and only step 1 survives the freeze. Steps 2–8 are all
`void ...catch(console.error)` — none of them can fail the request today, and
none of them feed back into anything the KEEP list needs. **Breakage risk: low.**

**`afterCompassSession` (`app/api/learn/end/route.ts:159`, itself not awaited by the caller):**
Same shape — `await updateFromCompass(...)` internally (step 1), everything
else (`emitEvent`, `publishEvent`, `computeNextBestActions`, intervention
resolution check, EIR research cycle) is `void ...catch()`. **Breakage risk: low.**

**Conclusion:** the two flows the user needs preserved do not actually depend
on EILS/EIR for their core behavior — they depend on `lib/learnerModel/updater`,
which lives outside `eils`/`eir` and is already in KEEP. The freeze just needs
thin replacement functions for `afterAssessment` / `afterCompassSession` /
`afterFormativeSignal` / `afterParentObservation` that call the `updateFrom*`
functions directly and drop the EILS/EIR side-effects.

### 2c. The one useful EILS kernel — and the one real contradiction

**Kernel to preserve (Layer 9, `lib/eils/coordinator.ts`):**

> "EILS acts as the decision engine behind every AI system in EduNexus. Before
> any AI generates content, it should ask EILS for context. This prevents:
> — Lesson plan generators ignoring that a student is missing a prerequisite
> — Tutors teaching advanced content to a learner who needs foundational support
> — Career explorer showing careers incompatible with the student's actual readiness
> — Assessment generators ignoring class-wide misconceptions"

Concretely this is `getContextForTutor/LessonPlan/AssessmentGenerator/CareerExplorer/HolidayPlanner()`,
which builds a small `context_note` string (e.g. `"PREREQUISITE WARNING: This
learner is missing foundational concepts: X, Y. Do NOT assume prior mastery of
these topics."`) from `getOrCreateLearnerProfile()` + `risk_flags` +
`knowledge_state`. **This is exactly the "prerequisite intelligence out" the
product is centered on.**

**Important finding: this kernel is currently dead code.** `grep` for
`getContextFor` turns up zero call sites in any generator, tutor, or lesson
plan route — it's exported from the barrel but nothing calls it. So freezing
`coordinator.ts` today breaks nothing at runtime. The recommendation is to
extract its logic (not the file as-is) into a small standalone function
(e.g. `lib/learnerModel/prerequisiteContext.ts`) during Phase 1, since it only
depends on `lib/learnerModel`, not on any other EILS layer.

**The one real contradiction to your buckets:** `buildTeacherPanel()` in
`lib/eils/teacherIntelligence.ts` (currently showing as modified, uncommitted)
is **actively used right now** by the brand-new (also uncommitted) Attention
Feed feature — `lib/attentionFeed/sources.ts` imports it directly, and
`app/teacher/dashboard/page.tsx` already renders `<AttentionFeed />` in
production-facing code. Unlike the coordinator kernel, `buildTeacherPanel`
only depends on `lib/learnerModel` (not on any other EILS layer, not on EIR),
so it *could* freeze cleanly — but it is live, wired-in functionality for
exactly the "prioritized remedial ... out" part of the lean product, not
speculative scope. **Recommend: extract `buildTeacherPanel` out of `lib/eils`
before freezing** (e.g. move it to `lib/attentionFeed/teacherPanel.ts` or merge
its logic into the attention feed's own aggregation), rather than freezing it
and shimming attention-feed around a stub. Flagging this for your decision
before Phase 1 — it's the only place FREEZE and "ship the lean product" are in
direct tension.

### 2d. Everything importing `lib/eir`

All 8 `/api/eir/*` routes import directly from `lib/eir` for their sole
purpose (misconceptions, trajectories, intervention effectiveness,
personalization, risk, explainability, validation, knowledge base) — each
route dies cleanly with the freeze. `app/api/cron/eir-research/route.ts`
imports `lib/eir/engine` — also dies cleanly (it's EIR's own weekly cron).
Internally, `lib/eils/nextAction.ts` calls `afterRecommendationCreated` from
`lib/eir/engine`, and `lib/eils/continuousLearning.ts` calls
`runLearnerResearchCycle` from `lib/eir/engine` — both already covered by the
`afterAssessment`/`afterCompassSession` analysis above (fire-and-forget, safe
to sever). No KEEP-bucket file imports `lib/eir` directly.

### 2e. Confirmed clean — no eils/eir dependency

`lib/remedial/planner.ts`, `lib/holiday/planner.ts`,
`app/api/teacher/monday-panel/route.ts`, and
`lib/eils/teacherIntelligence.ts`'s own imports (aside from being *in* the
eils folder) all depend only on `lib/learnerModel`, confirming the KEEP
bucket's core signal→intelligence path is already independent of EILS/EIR.

---

## 3. Buckets

### KEEP — do not touch
- `lib/learnerModel/` (signal ingestion + risk/knowledge state — the real brain)
- Three signal streams: `learner_marks`, `assessments`, `compass_sessions`
- `app/teacher/analytics/` (teacher analytics dashboard)
- SOW / LP / RoW generators (`lib/sow`, `lib/lessonPlan`, `lib/row`)
- `lib/teachingIntelligence/` (TIE) + `lib/remedial/` (Remedial Bank / Quick Wins) + substrand_health
- Compass (`lib/compass/`, `app/api/learn/`)
- Parent report + WhatsApp (`lib/parentPulse/`, `lib/whatsapp/`) — needs the
  `afterParentObservation` shim (§2b)
- Door 2: light data-entry flow (teacher → class → students → marks)
- Door 1: versioned ingestion API (`app/api/v1/...`) for schools with their own data
- **Flag for your call:** `lib/attentionFeed/` + `components/teacher/AttentionFeed.tsx`
  + `app/api/teacher/attention-feed/` + `app/api/teacher/cohorts/` — new,
  uncommitted, already wired into the teacher dashboard. Reads squarely as
  product (prioritized remedial feed), not speculative scope, but it currently
  imports from `lib/eils` (§2c) so it needs to be resolved before/during the freeze.

### FREEZE → `_frozen/`
- `lib/eils/` (all 10 layers) → `_frozen/eils/`, except: extract the
  coordinator kernel logic (§2c) as a small new function in `lib/learnerModel/`
  first, and resolve `teacherIntelligence.ts`'s `buildTeacherPanel` per the
  flag above, before the folder move.
- `app/api/eils/` (7 routes, listed in §2a) → `_frozen/api-eils/` or delete the
  route folder and note it in MIGRATION.md as frozen-not-deleted (routes are
  cheap to restore from `_frozen/` since they're thin wrappers)
- `lib/eir/` (all 12 modules) → `_frozen/eir/`
- `app/api/eir/` (8 routes) + `app/api/cron/eir-research/route.ts` → `_frozen/`
- EIR DB tables (list only, no migration yet): `eir_misconceptions`,
  `eir_learning_trajectories`, `eir_intervention_effectiveness`,
  `eir_personalization_models`, `eir_career_development`, `eir_kg_discoveries`,
  `eir_risk_predictions`, `eir_recommendation_outcomes`, `eir_hypotheses`, `eir_findings`
- EILS DB tables (list only, no migration yet): `eils_events`,
  `eils_interventions`, `eils_milestones`, `eils_recommendations`

### PARK — concept kept, code frozen, not maintained
- There is **no marketplace/plugin/CLI/certification code in this repo** to
  park — it all lives in the sibling repo `edunexus-devportal/` (separate git
  repo, separate working directory), which is **out of scope for this branch**
  entirely. Nothing to move here.
- The 40k+-word spec docs in `docs/` (`developer-platform.md`,
  `developer-platform-backend-specification.md`, `developer-portal-ui-blueprint.md`,
  `dx-ecosystem-blueprint.md`, and the standards-series volumes) stay in place,
  untouched, marked here as: **PARKED — reference only, not actively built against.**
- If "keep the dev-portal landing page only" refers to `edunexus-devportal/`,
  that repo isn't touched by this plan at all — flag if you want a separate
  Phase 0 audit scoped to that repo.

---

## 4. Proposed Phase 1 sequence (shims before moves, so KEEP never breaks)

- [ ] 1. Add `lib/learnerModel/prerequisiteContext.ts` — extract the
      coordinator kernel logic (§2c) as a standalone function, independent of `lib/eils`
- [ ] 2. Decide + implement the `buildTeacherPanel` resolution (§2c flag):
      move its logic into `lib/attentionFeed/` (or a new `lib/teacherPanel.ts`),
      update `lib/attentionFeed/sources.ts` and
      `app/api/eils/teacher/[teacherId]/panel/route.ts`'s callers accordingly
- [ ] 3. Add thin replacements in `lib/learnerModel/` (or a new small
      `lib/learnerModel/hooks.ts`) for `afterAssessment`, `afterCompassSession`,
      `afterFormativeSignal`, `afterParentObservation` that call only the
      `updateFrom*` functions — no EILS event emission, no EIR trigger
- [ ] 4. Repoint the 4 KEEP call sites to the new thin replacements:
      `app/api/teacher/assessments/process/route.ts`,
      `app/api/learn/end/route.ts`, `app/api/formative/signal/route.ts`,
      `lib/parentPulse/observationPipeline.ts`
- [ ] 5. Confirm build + the two critical flows (assessment marking, Compass
      session end) still work with `lib/eils` imports removed from all 4 files
- [ ] 6. Move `lib/eils/` → `_frozen/eils/`, `lib/eir/` → `_frozen/eir/`
- [ ] 7. Move `app/api/eils/` → `_frozen/api-eils/`,
      `app/api/eir/` → `_frozen/api-eir/`,
      `app/api/cron/eir-research/` → `_frozen/api-cron-eir-research/`
- [ ] 8. Run a repo-wide `grep` for `lib/eils` and `lib/eir` imports to confirm zero remain outside `_frozen/`
- [ ] 9. Full typecheck + build
- [ ] 10. List (don't drop) the 14 eils/eir DB tables in a follow-up migration note for later cleanup

---

## 5. Summary

**Biggest breakage risk:** low, and it's not where you'd expect. The two
KEEP-critical flows (assessment marking, Compass session-end) already only
*need* `lib/learnerModel`, and everything EILS/EIR adds on top of them is
fire-and-forget (`void ...catch(console.error)`) — none of it can fail the
request, none of it feeds anything else in KEEP. The freeze is mechanically
low-risk once the 4 thin shims in step 3–4 exist.

**Where your buckets and the actual code disagree:**
1. **Attention Feed is new, uncommitted, and already live** on the teacher
   dashboard — it's the closest thing in the repo to the "prioritized remedial
   ... out" product goal, but it's currently built as a thin wrapper around
   `lib/eils/teacherIntelligence.ts`. It should probably be reclassified into
   KEEP explicitly (it reads as real product, not EILS scope creep) with its
   one EILS dependency extracted, not frozen wholesale.
2. **The "one useful EILS kernel" (coordinator.ts) is currently unused** —
   zero call sites anywhere. It's the right thing to preserve conceptually,
   but there's no live wiring to protect when extracting it; it's a clean
   copy-out, not a live migration.
3. **There is no developer-platform code in this repo to PARK** — the
   marketplace/plugin/CLI/certification stack is a separate repository
   (`edunexus-devportal/`) with its own git history, untouched by this branch.
   The only "park" that applies here is the spec docs, which need no action.

Waiting for your go-ahead before touching any feature code.
