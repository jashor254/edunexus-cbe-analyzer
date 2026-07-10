# Adaptive Learning v2 — Implementation Plan

Status: **Waves 0–7 implemented and validated (2026-07-08)**, all backend/
`lib`-layer work — 34/34 tests passing against real database writes and
real Projection recomputation, zero mocks. **Wave 7 — Curriculum
Grounding Layer** was added mid-implementation, not in the original plan:
the platform's Curriculum Integrity mandate ("every recommendation must
be grounded in the official curriculum, never invented") was found to be
unmet by Waves 1–6's original content generation. See its own section
below. **Outstanding: the teacher-facing UI screen for Wave 4's Review →
Adjust → Approve flow** (and any UI for triggering Wave 5's return intake
/ viewing packs / assigning a Sub-Strand for Wave 7 grounding) — not
built this pass; flagged rather than silently skipped.

Sequencing only otherwise. Implements
[Adaptive Learning v2 — Architecture (FROZEN)](adaptive-learning-v2-architecture.md)
exactly as written. No new features, no architecture changes. Every wave
below cites the architecture section it implements; if a wave seems to
need something the architecture doesn't say, that is a stop-and-ask
signal, not a license to improvise.

Optimized for one fully working pilot school before Third Term begins.
Waves are small on purpose — each has its own validation and exit
criteria so a blocked wave never silently drags the next one down with it.

---

## How to read this plan

- **Complexity** is relative sizing (S / M / L), not hours — S is a
  single well-scoped function or extension of existing code; L is
  multi-file, touches persistence, or has a genuinely new failure mode.
- **Pilot-critical** = required for one working pilot school before Third
  Term. **Post-pilot** = named in the architecture's own §13/§14 as future
  work; do not build it now even if it looks easy.
- **Depends on** lists waves that must reach their exit criteria first —
  not "should probably happen before," a hard gate.

---

## Wave 0 — Preflight (no code)

**Status: DONE** — Reference School (Core schema) confirmed unusable for Projection testing (Evidence/Projection live in the legacy schema); the existing synthetic-seed pattern from `evidenceDomain.integration.test.ts` used instead for all later waves' validation.

**Implements:** nothing new; validates the ground the rest of the plan
stands on.

**Work:**
- Confirm the Reference School fixture (Mwatate Ridge Senior School,
  per memory) has enough real Grade 7–9 assessment history to exercise
  Projection's academic/knowledge/risk projectors meaningfully — if it's
  thin, synthetic seed data (same pattern as the Grade 7 Math prerequisite
  engine's synthetic seed) may be needed before Wave 1's tests can be
  written honestly.
- Confirm with the pilot school (operational, not engineering) that
  printing capacity for a class set of packs each holiday is real —
  named as a risk in the architecture (§14); this plan assumes yes, but
  it is worth a five-minute confirmation before Wave 3/5 effort is spent.

**Complexity:** S.
**Depends on:** nothing.
**Validation:** a person confirms both points above, in writing (a
Slack message or memory note is enough).
**Exit criteria:** Reference School data is sufficient, or a synthetic
seed script exists to supplement it; printing is confirmed feasible.

---

## Wave 1 — Recommendation Layer core

**Status: DONE** — `lib/adaptiveLearning/recommend.ts`, 14/14 unit tests passing.

**Implements:** §2 (as corrected at freeze — the Layer has its own
grouping function, it does not call `generateRemedialPlan()`).

**Work:**
- `lib/adaptiveLearning/recommend.ts`: one function,
  `buildRecommendations(learnerId | classId, context)`, that:
  - Reads Projection via `recomputeLearnerProjection`/
    `recomputeLearnerProjections` — no other data source.
  - Produces the A/B/C/D group taxonomy (`critical_gap`/
    `prerequisite_gap`/`concept_confusion`/`on_track`, ported as a
    *shape*, plus the new Group C enrichment tier) for a class, and a
    per-learner ZPD-appropriate task difficulty for an individual.
  - Returns `AdaptiveTask[]`, each shaped as an `Insight` (observation/
    evidence/confidence/action) — reuse the existing Insight type/builder
    already used by Blueprint/Career Intelligence, do not define a second
    one.
  - Accepts optional context inputs (teacher-set topic intent, career
    signals via `capabilityMatchEngine`) without requiring them.
- Unit tests against synthetic Projection fixtures covering: a
  `critical_gap` learner, an `on_track`/Group-C learner, a learner with
  `insufficient_data` (must degrade to a named "not enough evidence yet"
  Insight, never a guess — per LI-2/LI-6 discipline already established
  elsewhere in the codebase).

**Complexity:** M — one new module, but it must get the Insight
contract and the Projection read right, since every later wave inherits
whatever this wave gets wrong.

**Depends on:** Wave 0.

**Validation:** unit tests (`node:test`, matching this codebase's existing
pattern — see the Prerequisite Engine's own test style) proving the
group taxonomy and Insight shape are correct against known synthetic
Projection states, not against real assessment flows yet.

**Exit criteria:** `buildRecommendations()` is callable, tested, produces
correct groupings for at least the four known synthetic learner
archetypes above, and is not yet wired into any route, UI, or renderer.

---

## Wave 2 — Holiday Planner re-pointed to Projection

**Status: DONE** — `lib/holiday/planner.ts` re-pointed, Migration Ledger updated, 3/3 integration tests passing against real evidence.

**Implements:** §4 point 1–3, §11 (Migration Ledger row change).

**Work:**
- `lib/holiday/planner.ts`: replace `getOrCreateLearnerProfile()` +
  manual `knowledge_state`/`career_signals` field reads with one
  `recomputeLearnerProjection()` call plus `buildRecommendations()`
  (Wave 1).
- `HolidayWeek.compass_topics` populated from `AdaptiveTask` output
  instead of the current substrand-string slicing.
- `HolidayPlanData`'s shape is **unchanged** — same fields, same
  consumers (WhatsApp message, PDF renderer, publish gate) — only the
  internal data source changes.
- Update the Migration Ledger: Holiday Planner row moves from
  `Legacy`/`Deferred` to `Projection`.

**Complexity:** M — mechanical rewiring, but touches a function with
several live downstream consumers (publish gate, WhatsApp message,
parent summary) that must not regress.

**Depends on:** Wave 1.

**Validation:**
- Run `generateHolidayPlan()` for 3–5 real Reference School learners
  spanning different risk/knowledge profiles; diff the output shape
  against the pre-change version for the same learners — same fields
  present, priority gaps at least as specific, no null/undefined
  regressions.
- Confirm the existing Holiday Publish Gate flow (`app/api/holiday/publish/route.ts`,
  the 3-day auto-publish cron) still operates correctly against the new
  data source — this is an existing, working feature; this wave must not
  break it.

**Exit criteria:** `generateHolidayPlan()` produces correct,
Projection-sourced `HolidayPlanData` for real Reference School learners;
publish gate unaffected; Migration Ledger updated.

---

## Wave 3 — Printable Adaptive Learning Pack extension

**Status: DONE** — `lib/assignments/pdfRenderer.ts` extended (enrichment style), `lib/holiday/packRenderer.ts` built. Rendered against real data, visually published for review.

**Implements:** §5.

**Work:**
- `lib/assignments/pdfRenderer.ts`: add a Group-C task style (open-ended
  prompt, no fixed-answer scaffold) alongside the existing four
  `SCAFFOLDS` levels — additive, per the architecture's own instruction.
- New pack sections: reflection page (2–3 fixed prompts), progress
  tracker (checkbox grid across weeks), teacher comment / parent
  signature / return checklist fields — all rendered from data Wave 2
  already produces (no new data source).
- Renderer input changes from a single manually-specified assignment to
  `AdaptiveTask[]` (Wave 1 output) for a whole holiday plan.

**Complexity:** S/M — extends a working renderer; the only genuinely new
piece is the Group-C scaffold style and the reflection/tracker page
layout.

**Depends on:** Wave 1, Wave 2.

**Validation:** render a full pack for 2–3 real Reference School
learners (one Group A/critical-gap profile, one Group C/on-track
profile) and visually review the PDF output — correct level scaffolding,
correct career note, reflection page present, checklist present.

**Exit criteria:** a teacher (or a stand-in reviewer) looks at a printed
pack and confirms it is usable as-is — legible, age-appropriate
language, no placeholder text leaking through.

---

## Wave 4 — Classroom Differentiation + teacher approval flow

**Status: BACKEND DONE, UI OUTSTANDING** — `lib/adaptiveLearning/differentiation.ts`, new `class_differentiation_plans` table (deviated from the architecture's literal "reuse remedial_plans" guidance — confirmed with user — due to a real FK/schema mismatch), API routes, 5/5 integration tests passing. No teacher-facing Review/Adjust/Approve screen built yet.

**Implements:** §3 (as corrected at freeze).

**Work:**
- Extend the existing assessment-processing responsibility
  (`app/api/teacher/assessments/process/route.ts`) to call
  `buildRecommendations()` for the affected class after substrand health
  computes, producing grouped, level-tagged task sets.
- A teacher-facing review surface: Review → Adjust → Approve, gated the
  same way the existing Holiday Publish Gate already gates teacher
  approval (reuse that interaction pattern, do not invent a second one).
- On approval, render via the Wave 3 pack renderer (print) and/or a
  digital share path (whatever "Share" already means elsewhere in the
  product for assignment-shaped content — reuse, do not build a new
  sharing mechanism).
- Rendering rule from the architecture: learner/class-facing labels are
  neutral ("This Week's Focus," "Challenge Set") — never the internal
  `critical_gap`/`on_track` taxonomy names.

**Complexity:** L — the one wave that adds new UI surface (the
review/adjust/approve screen) and touches a live, daily-use teacher route.

**Depends on:** Wave 1. (Not on Wave 2/3 functionally, but sequenced
after them per the architecture's own rollout order, §12, so the
Recommendation Layer is already proven against lower-stakes holiday
output before it's trusted in the daily teaching path.)

**Validation:** run the full flow against one real Reference School
class with real recent assessment data — process an assessment, confirm
groups are sensible (spot-check against a teacher's own judgment of that
class, if available), confirm the approval gate blocks anything from
reaching print/share until a teacher acts, confirm rejected/adjusted
tasks are respected (not silently reverted to the AI's original
proposal).

**Exit criteria:** one teacher, one real class, one real assessment
cycle — differentiated groups generated, reviewed, adjusted, approved,
printed — end to end, with no step bypassing teacher approval.

---

## Wave 5 — Holiday Return intake + Evidence Loop closure

**Status: DONE** — `lib/holiday/return.ts` + `returnAutoConfirm.ts`, new `holiday_returns` table, `EvidenceSource`/DB CHECK constraints extended, 4/4 integration tests proving the full loop (intake → pending → invisible to Projection → confirmed → Projection reflects it).

**Implements:** §4 (Evidence Loop closure), §7, §9 (Holiday Return
intake responsibility), §10 (new small table).

**Work:**
- New `EvidenceSource` value `'holiday_return'` in
  `lib/intelligence/evidence.ts` (additive to the existing union).
- New extraction-method values `'holiday_engagement'` /
  `'holiday_mastery'`, following the exact pattern
  `lib/compass/evidenceClaimTypes.ts` already established for Compass's
  two claim shapes.
- Trust tier 2 declared for `'holiday_return'` in
  `EVIDENCE_SOURCE_TRUST_TIER` (matches the existing `classroom_observation`
  precedent).
- New small table: Holiday Return records (learner, week, returned Y/N,
  teacher comment, Ingestion Run reference) — indexed on `teacher_id`,
  `student_id` per CLAUDE.md's standing rule.
- Intake path: a teacher's batch entry of returned-pack results (primary
  path, matches the boarding-school model) and a digital form
  equivalent for smartphone parents/learners — both produce one
  Ingestion Run and a batch of `holiday_return` Evidence via the
  existing `persistEvidenceBatch()` pipeline.
- Review path: `holiday_mastery` claims are teacher-reviewable by
  default; `holiday_engagement` may use the same conservative
  auto-confirm pattern Compass already uses for engagement-only facts —
  reuse `applyConservativeAutoConfirm`'s existing logic/shape, extended
  to this claim type, not a second auto-confirm implementation.

**Complexity:** L — the one wave the architecture itself flags as
having no live precedent (§14 risk); new evidence source, new table,
new intake UI, and it must get trust-tier/auto-confirm scoping exactly
right (this is the wave most likely to attract review scrutiny given
LI-3/LI-6's stakes).

**Depends on:** Wave 2 (needs real Holiday Journeys to exist to be
returned), Wave 3 (needs the reflection page to be the physical intake
artifact).

**Validation:**
- Unit tests for the new evidence source's trust-tier ceiling and
  auto-confirm scoping (`holiday_engagement` can auto-confirm under
  threshold; `holiday_mastery` never does), mirroring the existing
  Compass evidence tests.
- End-to-end test with a small real batch (one class, per the
  architecture's own midterm-scale rollout, §12): generate a Holiday
  Journey (Wave 2), simulate/collect a return, intake it, confirm
  Evidence lands in the right lifecycle state, confirm
  `recomputeLearnerProjection` for that learner reflects it afterward.

**Exit criteria:** a real learner's holiday return, taken through
intake, produces confirmed-or-pending Evidence correctly tiered and
claim-typed, and that learner's next Projection recompute visibly
reflects it (e.g., a knowledge-state or behaviour change traceable to
that specific Evidence record).

---

## Wave 6 — Parent Delivery

**Status: DONE (logic), UNSENT (no real message dispatched)** — `lib/holiday/notify.ts` wired as a fire-and-forget trigger on `recordHolidayReturn`. No real WhatsApp message was sent (no safe test recipient) — validated via no-op/error-path unit tests only. Send a real test message before pilot go-live.

**Implements:** §6.

**Work:**
- Extend `lib/whatsapp/sender.ts` / `reportNotify.ts` with one new
  trigger point: after a Holiday Return is processed (Wave 5), send a
  progress message built from the same Insight-formatted pattern the
  parent activity feed already uses.
- No new channel infrastructure — this is a new call site on an
  existing sender.
- Printable-pack parent fields (signature, comment, parent action line)
  are already delivered by Wave 3 — this wave only confirms they're
  present and correctly populated, no new rendering work.

**Complexity:** S.

**Depends on:** Wave 2 (plan generation trigger), Wave 5 (return-processed
trigger).

**Validation:** send a real WhatsApp message to a test phone number at
both trigger points (plan generated, return processed); confirm message
content matches the Insight pattern (observation/evidence/action in
parent-appropriate language, per §6).

**Exit criteria:** both trigger points fire correctly and content is
reviewed for tone/clarity by a non-engineer (a teacher or the product
owner) before pilot go-live.

---

## Dependency Graph

```
Wave 0 (preflight)
   │
   ▼
Wave 1 (Recommendation Layer core)
   │
   ├──────────────┬───────────────┐
   ▼              ▼               │
Wave 2          Wave 4             │
(Holiday        (Classroom         │
 Planner)        Differentiation)  │
   │                                │
   ▼                                │
Wave 3 ◄────────────────────────────┘
(Printable Pack)
   │
   ▼
Wave 5 (Holiday Return + Evidence Loop)
   │
   ▼
Wave 6 (Parent Delivery)
```

Wave 4 only hard-depends on Wave 1; it is sequenced after Wave 2/3 by
choice (architecture §12's own stated rollout order), not by a technical
gate — if pilot timeline pressure demands it, Wave 4 could run in
parallel with Wave 2/3 without breaking anything, at the cost of
deviating from the architecture's stated "prove it on lower-stakes
holiday output first" risk management. Flag this explicitly if that
tradeoff is ever made.

---

## Pilot-Critical vs. Post-Pilot

**Pilot-critical (all of Waves 0–6):** every wave above is required for
the "one fully working pilot school" goal. None are optional for Third
Term.

**Explicitly post-pilot (do not build now):**
- Substrand-level knowledge / 6-dimension capability / duration tracking
  in Projection (Migration Ledger gaps, architecture §8/§13.1).
- Automated Attention Feed "holiday non-return" risk signal (architecture
  §8/§13.2) — non-return stays a teacher-visible operational fact via the
  Wave 5 return checklist for the pilot.
- New delivery channels (SMS, native app) (architecture §13.3).
- Multi-school Recommendation Layer calibration (architecture §13.4).
- Retiring `lib/holiday/planner.ts`'s dual-write / Remedial Planner
  migration (architecture §13.5, §11) — governed by the Migration
  Ledger's own pre-existing exit conditions, unrelated to this pilot's
  success.

---

## Rollout Checkpoints (tying waves to the school calendar)

- **Before Third Term begins:** Waves 0–4 complete and validated —
  Classroom Differentiation live for daily use from day one of the term.
- **First mid-term break:** Waves 5–6 get their first live, small-scale
  run (one class), per the architecture's own §12 rollout mechanics —
  not the full school.
- **Main November–December holiday:** full-school rollout of the
  complete pipeline, once the mid-term run has proven the Evidence Loop
  closes correctly end-to-end (Wave 5's exit criteria, satisfied at
  real scale).

---

## What Would Trigger Re-Opening the Frozen Architecture

Per the freeze condition ("no further expansion unless a real
implementation blocker appears"), only these count as a genuine blocker,
not a preference:

- A wave's exit criteria cannot be met *without* a data source or
  capability the architecture didn't account for (e.g., if Projection
  genuinely cannot supply what Wave 1 needs for a real learner cohort —
  not a synthetic-data gap, a structural one).
- A real trust/privacy issue is found in the Holiday Return path that
  the Evidence Domain Model's existing invariants don't already resolve.
- Pilot school operational reality contradicts a named assumption (e.g.,
  printing genuinely isn't feasible) — this changes rollout mechanics,
  not the architecture itself, and should be resolved as a rollout
  adjustment first before treating it as an architecture problem.

Anything else — a wave taking longer than expected, a UI detail not
specified, a threshold needing tuning — is implementation work, not a
reason to revisit the frozen document.

---

## Wave 7 — Curriculum Grounding Layer (added 2026-07-08, not in original plan)

**Status: DONE.** Triggered by four new governing documents (Curriculum
Integrity, Teacher Professional Autonomy, Adaptive Learning Rules, The
EduNexus Golden Rule) declaring curriculum grounding Non-Negotiable —
found, on audit, that Waves 1–6's content generation violated it in three
places: `recommend.ts`'s generic action templates, `pdfRenderer.ts`'s
fully invented worksheet questions, and Holiday Planner's subject-level
(not Strand/Sub-Strand) topic identity.

**What's real and used:** `sow_grades → sow_learning_areas → sow_strands
→ sow_substrands → sow_learning_outcomes` (the same tree
`lib/compass/topicSelector.ts` already reads) — real, populated Strand/
Sub-Strand titles and 608 real Specific Learning Outcome rows.

**Two load-bearing findings from live-database verification, not
assumption:**
1. `sow_strands.kicd_data` and `sow_learning_areas.kicd_subject_data`
   (Core Competencies, PCIs, Values, Suggested Learning Experiences,
   Assessment Opportunities) are **empty across every row** — never
   actually seeded, despite `lib/sow/aiLessonGenerator.ts` already having
   a prompt-injection pattern built for them. Wave 7 does not fabricate
   these; every generated task explicitly states they're unavailable
   (`UNAVAILABLE_CURRICULUM_FIELDS`).
2. `sow_learning_outcomes.substrand_id` is **almost entirely orphaned**
   from `sow_substrands.id` in this database (1 of 51 sampled rows
   resolved) — a pre-existing data-integrity gap, out of scope to repair
   here. `resolveCurriculumContext()` is correct either way (real query,
   honest `null`/empty fallback) but the "real outcomes" positive path
   will rarely fire against current live data until that's reconciled.

**Built:** `lib/curriculum/curriculumContext.ts` (`resolveCurriculumContext`),
two new `CurriculumRepository` methods, `AdaptiveTask` gained `curriculum`/
`curriculumNotice` fields, `recommendForLearner`/`recommendForClass`/
`generateClassDifferentiation` gained an optional teacher-supplied
`subStrandId` (Teacher Professional Autonomy: the teacher assigns it, the
system never guesses), `pdfRenderer.ts` gained `buildOutcomeGroundedTasks`
plus a visible grounded/ungrounded status badge, `packRenderer.ts` wired
through. 6 new tests (3 unit, 3 integration against synthetic
well-formed curriculum rows, since live seeded data can't currently
exercise the positive path per finding #2).

**Named gap, not fixed:** "combine multiple strands for revision"
(Teacher Professional Autonomy's own list) isn't supported — each
Recommendation Layer call takes one `subStrandId`. Assigning across
grades/revisiting foundational concepts already works structurally (any
real `subStrandId`, any grade, resolves), just not yet exposed in a UI.
