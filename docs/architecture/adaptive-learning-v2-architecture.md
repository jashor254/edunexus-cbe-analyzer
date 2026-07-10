# Adaptive Learning v2 — Architecture for the Third Term Pilot

Status: **FROZEN** — the master reference for Adaptive Learning across
Compass, Holiday Learning, and the teacher workflow. Not an implementation
plan; no schema DDL, no route handlers, no pseudocode. Bound by (frozen,
not renegotiated here): the [Engineering Constitution](../engineering-constitution.md),
[Learner Intelligence Engineering Principles](learner-intelligence-engineering-principles.md)
(LI-1–LI-8), the [Evidence Domain Model](evidence-domain-model.md), the
[Migration Ledger](migration-ledger.md), and [Compass v2 Design](compass-v2-design.md)
+ its [Implementation Roadmap](compass-v2-implementation-roadmap.md). This
document does not redesign any of those; it places Adaptive Learning — the
differentiated-classroom, holiday-journey, and printable-pack capability —
on top of them, for a normal Kenyan boarding school beginning Third Term.

---

## 0. What This Document Is Answering

The prior Compass v2 work fixed *who owns a Compass conversation* and *how
a conversation becomes Evidence*. It did not address a separate, larger
question: what does Adaptive Learning mean in a school where learners do
not carry phones, teachers are the only daily contact point, and the
richest personalization opportunity is not a chat session but the three
school holidays? This document answers that question without inventing a
second intelligence engine — every adaptive decision below is Projection,
read once, rendered through a different channel.

---

## 1. Core Architectural Decision: One Engine, Four Channels

There is exactly one Adaptive Learning Engine. It does not live in a new
`lib/adaptiveLearning/` directory competing with the existing
`lib/adaptiveLearning.ts` — it *is* the Projection Engine
(`lib/projection/`) plus a thin **recommendation layer** that turns a
Projection into a concrete next task. This is LI-1 applied to a new
surface, not a new exception to it.

```
                         Evidence (confirmed)
                                │
                                ▼
                        Projection Engine
              (academic / knowledge / risk / growth /
               behaviour / capability — all existing)
                                │
                                ▼
                   Recommendation Layer (new, thin)
        "given this learner's current Projection, what is
         the next achievable task, at what level, tied to
         which career signal if any" — one function,
         reused by every channel below
                                │
        ┌───────────┬───────────┼───────────┬───────────┐
        ▼           ▼           ▼           ▼           ▼
   Classroom    Holiday      Printable     Parent     (future)
  Differentiation Journey      Pack       Delivery    WhatsApp/
   (teacher-      (learner-   (no-phone    (has-      SMS/App
    facing)        facing)     learner)     phone)
```

The Recommendation Layer is the only new "brain." Every channel is a
renderer over its output — this is the literal architectural expression
of "Compass supports, teacher leads, learner grows": the engine proposes,
a channel presents, and in the classroom case, **the teacher is the one
who approves before anything reaches a learner.**

**Why this must not become four separate generators:** the failure mode
named in the brief — "Compass must never depend on daily learner phone
access" — is only true if the holiday journey, the printable pack, and
the classroom differentiation set are three renderings of the same
recommendation, not three independently-built features that quietly drift
apart the first time someone patches one and not the others.

---

## 2. The Recommendation Layer

**New module: `lib/adaptiveLearning/recommend.ts`** (extends the existing
`lib/adaptiveLearning.ts`, does not replace it — that file's current
session-local logic stays scoped to live Compass turns per Compass v2 §8;
this is the *out-of-session* counterpart it doesn't yet have).

Input: a learner's current Projection (`recomputeLearnerProjection`, the
same call every other consumer uses — no bespoke read path, per Compass
v2 §12) plus optional context (teacher-set intent, career signals from
`lib/career/capabilityMatchEngine.ts`, holiday duration, class-wide
substrand health from `lib/remedial/planner.ts`'s existing health lookup).

Output: an ordered list of `AdaptiveTask` — each one an `Insight`
(observation / evidence / confidence / action, per LI-2 and the Insight
contract already used by Blueprint and Career Intelligence), not a bare
worksheet reference. Every task a learner or teacher receives can answer
"why this, why now" the same way a Blueprint statement can.

Zone-of-proximal-development logic (§ "Adaptive Learning Principles" in
the brief) lives here, once: a task's difficulty is chosen relative to the
learner's current subject-level tier from `academicProjector`/
`knowledgeProjector`, never a fixed grade-level default. This reuses the
same tier logic Compass's session-start read already applies — this
document does not invent a second ZPD formula.

**What already exists and is reused, not rebuilt:**
- `lib/remedial/planner.ts` already proves the "Group A/B/C" shape the
  brief asks for is the right taxonomy (`RemedialGroupType`:
  `critical_gap` / `prerequisite_gap` / `concept_confusion` / `on_track`).
  **Correction from the initial draft of this document, made before
  freeze:** the Recommendation Layer does *not* call
  `generateRemedialPlan()` itself — that function sources learner data via
  `getClassLearnerProfiles()` (`lib/learnerModel/queries.ts`), which reads
  raw `learner_profiles` rows, i.e. Legacy per the Migration Ledger's own
  definition. Calling it directly would make Classroom Differentiation the
  one channel not deriving from Projection, breaking §1's own invariant.
  Instead, the Recommendation Layer implements its own small grouping
  function — the same thresholds and group labels
  (`critical_gap`/`prerequisite_gap`/`concept_confusion`/`on_track`, plus
  the new Group C, §3) — fed by `recomputeLearnerProjection`'s risk/
  academic/knowledge output instead of `getClassLearnerProfiles()`.
  `lib/remedial/planner.ts` itself is untouched: it keeps its existing,
  separate life as the post-bad-assessment remediation feature (Legacy,
  per the Migration Ledger, unchanged), and is not a runtime dependency of
  the Recommendation Layer. Porting a threshold shape is not the same as
  sharing a code path — this document treats them as distinct, and only
  the shape is reused.
- `lib/assignments/pdfRenderer.ts` already renders level-tagged (1–4),
  scaffolded printable tasks with CBC-appropriate instruction language per
  level. This is the printable engine — it needs a data source
  (Recommendation Layer output) feeding it per-learner, not a rebuild.
- `lib/holiday/planner.ts` already builds a per-learner, multi-week,
  career-aware plan. It needs to move from reading `learner_profiles`
  directly (Legacy, per the Migration Ledger) to reading the
  Recommendation Layer's output — same shape of work, correct source.
- `lib/career/capabilityMatchEngine.ts` and `growthEngine.ts` already
  supply the career-signal layer the brief's "Career Integration" section
  asks for (future-engineer → design challenge, etc.) — reused as a
  recommendation *input*, never re-derived.

The Recommendation Layer's job is small and specific: it is the missing
glue that lets these four already-built engines feed from one Projection
read instead of each computing its own view of "what does this learner
need," which is exactly the LI-1 violation this whole document exists to
avoid re-introducing.

---

## 3. Adaptive Classroom Support (Teacher-Facing, During School Days)

**Trigger:** an assessment is processed (`app/api/teacher/assessments/process/route.ts`
already exists and already computes substrand health — this is not a new
trigger point, it is an existing one gaining one more consumer).

**Flow:**
1. Assessment processed → substrand health computed (existing) →
   Projection recomputed for affected learners (existing:
   `recomputeLearnerProjections` batch call).
2. The Recommendation Layer's own grouping function (§2 — Projection-fed,
   not a call into `generateRemedialPlan()`) groups the class using the
   same taxonomy Remedial Planner established: `critical_gap`/
   `prerequisite_gap` → Group A (scaffolded, foundational),
   `concept_confusion`/mid-tier `on_track` → Group B (normal
   reinforcement), high-tier `on_track` → **Group C, newly defined**
   (enrichment: higher-order prompts, open-ended/mini-research tasks,
   leadership pairing) — the one real gap in the original taxonomy, which
   treated "on track" as "needs nothing" rather than "needs a ceiling
   raised."
3. Each group's tasks are rendered via `pdfRenderer.ts`'s existing
   level-scaffolded task generation, extended with a Group-C task style
   (open-ended prompt, no fixed "correct answer" scaffold) that does not
   exist in the current four `SCAFFOLDS` levels — this is additive, not a
   rewrite of the existing three.
4. **The teacher reviews before anything is shared** — Review → Adjust →
   Approve → Print/Share, exactly the workflow named in the brief. This
   is not a new UI paradigm: it is the same teacher-approval gate the
   Compass v2 Evidence confirm/promote surface already establishes (§7 of
   Compass v2 Design) for a different artifact type — reviewable AI
   output before it reaches a learner, one consistent pattern across the
   platform.

**What must never happen:** differentiation groups must never be labeled
or displayed to learners by tier name. `RemedialGroup.label` today reads
"Group A — Prerequisite Gap" — appropriate for a teacher's private
planning view, never learner-facing. This document states explicitly:
any learner- or class-facing rendering of grouped work must carry neutral
labels (e.g., "This Week's Focus," "Challenge Set") — a rendering rule for
the printable/UI layer, not a change to the internal `RemedialGroupType`
taxonomy teachers already see.

---

## 4. Holiday Learning Journey (Learner-Facing, Primary Adaptive Surface)

The brief is explicit that holidays are where the *learner-facing*
adaptive experience actually lives — this reframes `lib/holiday/planner.ts`
from a nice-to-have into the pilot's single highest-leverage surface.

**Current state (per the Migration Ledger and this session's file read):**
`generateHolidayPlan` already does almost everything the brief asks for —
priority gaps from `knowledge_state`, a career note from
`career_signals`, week-by-week structure, a WhatsApp message, a parent
summary. It is marked **Legacy / Deferred** in the Migration Ledger because
it reads `learner_profiles` directly rather than a Projection.

**What changes for v2, precisely:**
1. `getOrCreateLearnerProfile` + manual `knowledgeState`/`career_signals`
   reads are replaced by one `recomputeLearnerProjection` call plus the
   Recommendation Layer (§2) — same information, correct source, and now
   automatically consistent with what Blueprint/Career Intelligence/
   Attention Feed already say about the same learner, closing a real
   divergence risk (a holiday plan built from stale `learner_profiles`
   data could contradict what the teacher's Attention Feed shows the same
   week).
2. Each week's `compass_topics` become Recommendation Layer `AdaptiveTask`
   entries — carrying an Insight, not a bare topic string — so the same
   "why this, why now" explainability the brief demands of the whole
   system extends to holiday work.
3. The plan generation itself is otherwise **unchanged in shape** — this
   is the "start simple" philosophy applied correctly: the planner
   already produces the right *artifact*, it was reading the wrong
   *source*.

**Evidence Loop closure (the brief's most consequential ask):** today,
holiday work has no return path — a learner does the holiday plan (or
doesn't) and nothing re-enters the Evidence Domain. v2 adds exactly one
new capability: a **Holiday Return** — a teacher-facing intake (digital
form for phone-having parents, or the printable pack's own returned pages
for everyone else) that becomes `LearnerEvidence` via the same
`persistEvidenceBatch` pipeline every other source already uses
(`lib/intelligence/evidenceLifecycle.ts`). Trust tier: 2 (teacher-reviewed
parent/learner-reported work, higher than Compass's Tier 1 self-report,
lower than a teacher-administered assessment) — a new, explicitly-declared
tier assignment per LI-6, not a reuse of an existing tier that would
misrepresent its trust level. Evidence source: a new
`EvidenceSource` value, `'holiday_return'`, added to the existing union in
`lib/intelligence/evidence.ts` (additive, not a redesign of that type).

This is what makes "the learner never starts a new term from zero" true
architecturally, not just aspirationally: the Return is Evidence, Evidence
triggers Projection recompute (existing `eventConsumer.ts`/recompute
path), and every downstream projector (Behaviour, Growth, Risk, Knowledge)
picks it up the same way it picks up any other confirmed evidence —
because it *is* any other confirmed evidence, structurally.

---

## 5. Printable Adaptive Learning Packs (No-Smartphone Workflow)

This is not a "simplified" or "offline mode" of the digital experience —
the brief is explicit that it must come from the same engine, and the
existing `pdfRenderer.ts` already proves this is architecturally free: it
already renders from the same level/task data a digital learner would see,
just to paper instead of screen.

**Pack contents (extending, not replacing, the existing renderer):**
- Weekly plan — from the Holiday Journey (§4), same Recommendation Layer
  output.
- Learner goals — the `AdaptiveTask.action` field, phrased learner-first
  (existing Insight-rendering pattern from Compass v2 §10, reused).
- Adaptive exercises — existing `buildTasks()` level-scaffolded questions,
  extended with the Group-C enrichment style (§3).
- Reflection page — new, small: 2–3 fixed prompts ("What was easy? What
  was hard? What do you want help with?") — becomes Evidence at return
  (`holiday_return`, §4), not just a paper artifact that dies at home.
- Teacher comment + parent signature + return checklist — administrative
  scaffolding around the Return intake (§4); no new intelligence, just the
  physical mechanism that makes the Evidence Loop close for a no-phone
  household.
- Progress tracker — a simple visual (checkbox grid across weeks),
  rendered from the same Holiday Journey week count, no new data source.

**Delivery:** printed via the school (teacher print run) — no new
infrastructure; this reuses the existing PDF generation path
(`lib/pdf/utils.ts`, `lib/assignments/pdfRenderer.ts`) that already
produces printable output today for assignments.

---

## 6. Parent Workflow

Two paths, both reading the same Recommendation Layer output — never two
different intelligence computations:

- **Smartphone parent:** WhatsApp delivery via the existing
  `lib/whatsapp/sender.ts` + `reportNotify.ts` infrastructure — weekly
  goals, progress, and encouragement messages generated from the Holiday
  Journey's `parent_summary` field (already exists), extended to also
  fire at Holiday Return time ("Amina completed 3 of 4 weeks — here's what
  she worked on") using the same Insight-formatted, plain-language pattern
  Compass v2 §4 already establishes for the parent activity feed. No new
  channel infrastructure — this is the existing WhatsApp sender gaining
  one more trigger point.
- **No-smartphone parent:** the printable pack itself *is* the parent
  channel — the "parent action" line already present in
  `HolidayWeek.parent_action` and the signature/comment fields (§5) are
  the entire parent-facing surface. This is why the brief's framing —
  "exactly the same adaptive experience" — is achievable without new
  product surface: the printed pack was always going to exist for the
  learner; it doubles as the parent channel for free.

---

## 7. Evidence Lifecycle Integration

No new lifecycle states, no new invariants — the Evidence Domain Model's
ten invariants apply unchanged. What's new is enumerated precisely:

- **One new `EvidenceSource`**: `'holiday_return'` (§4). Declared trust
  tier 2, per LI-6 — teacher-mediated, not teacher-administered, not
  raw AI self-report.
- **One new claim shape**, following the same pattern Compass's
  `extractionMethod` field already uses to distinguish `engagement` vs.
  `mastery` claims from one session (`lib/compass/evidenceClaimTypes.ts`):
  a holiday return's `extractionMethod` distinguishes `'holiday_engagement'`
  (did the pack come back, how many weeks completed — a completion fact)
  from `'holiday_mastery'` (teacher's assessment of the returned work
  against the assigned level — an academic claim). Same rationale as
  Compass v2 §6: never invent a dedicated field when the existing one
  already means exactly this.
- **Review path**: a holiday return's `holiday_mastery` claim is
  teacher-reviewable by default (a teacher looks at 20–30 returned packs
  per class over the two weeks after a holiday — a bounded, realistic
  review load, unlike daily Compass session volume). `holiday_engagement`
  (did it come back at all) may use the same conservative auto-confirm
  pattern Compass v2 §7 already established for engagement-only facts —
  this document does not invent a second auto-confirm policy, it applies
  the existing one to a second, equally low-stakes claim type.
- **No new Ingestion Run type is needed** conceptually — a teacher's
  batch intake of a class set of returned packs is one Ingestion Run
  (lineage per Evidence Domain §5), same as a CSV upload is one run today.

---

## 8. Projection, Blueprint, Career Intelligence, and Attention Feed Integration

**Projection**: no projector changes. Holiday-return evidence flows
through the existing academic/knowledge/behaviour/growth/risk projectors
unchanged — it is just evidence with a new source tag. The one named,
deliberate exception: the Migration Ledger's documented gap (no
substrand-level knowledge, no 6-dimension capability, no duration
tracking) still applies here exactly as it does everywhere else. This
document does not attempt to close those gaps — they are Projection
Engine v2 candidates, per the Ledger's own framing, and Adaptive Learning
v1 is scoped to run on top of the *existing* Projection surface, same
discipline Compass v2 already committed to.

**Blueprint / Career Intelligence**: read the same Projection state after
a holiday cycle as they do after any term-time evidence — no special-
casing needed. This is the direct payoff of routing holiday evidence
through the real Evidence Domain instead of a parallel `learner_profiles`
patch: Blueprint's next update after a holiday automatically reflects
holiday-return evidence, because Blueprint already reads Projection
(Migration Ledger: state = Projection), and Projection now includes this
evidence, because it's real confirmed Evidence like any other.

**Attention Feed**: gains one new input for free — a learner whose
holiday pack never comes back is itself a signal (a behavioural/
engagement absence). This document does **not** design a new "holiday
non-return" risk flag here — it names it as a natural `riskProjector`
extension candidate for a future phase, consistent with not expanding
Projection's scope inside this document (per the Ledger discipline
above). For the pilot, non-return is a teacher-visible fact (the return
checklist, §5) handled operationally, not yet an automated risk signal.

---

## 9. API Boundaries (Responsibility, Not Routes)

Consistent with Compass v2 §12's own level of specificity — responsibility
surfaces, not route contracts:

- **Recommendation read** — "what should this learner work on next" is
  answered by one responsibility surface (the Recommendation Layer, §2),
  called by the classroom-differentiation flow, the Holiday Planner, and
  the printable renderer alike. No consumer computes its own version.
- **Class differentiation generation + teacher approval** — extends the
  existing assessment-processing responsibility
  (`app/api/teacher/assessments/process/route.ts`) with one more output
  (grouped, level-tagged task sets) and a new, small approval
  responsibility (teacher reviews/adjusts/approves before anything
  renders to PDF or reaches a learner) — same shape as the Compass
  Evidence confirm/promote responsibility Compass v2 §12 already names as
  net-new there.
- **Holiday plan generation** — existing responsibility
  (`app/api/holiday/generate/route.ts`), re-pointed to the Recommendation
  Layer instead of raw `learner_profiles` reads; no new route
  responsibility.
- **Holiday plan publish** — already exists per the codebase (`app/api/holiday/publish/route.ts`,
  `app/api/cron/auto-publish-holiday-plans/`) implementing the
  teacher-approve-before-publish gate this session's own memory already
  recorded (3-day auto-publish fallback) — this document adopts that
  existing gate as the model for classroom-differentiation approval
  (§3) rather than inventing a second approval mechanism.
- **Holiday return intake** — net-new responsibility: accepting either a
  digital form submission (smartphone parent/learner) or a teacher's
  batch entry of printed-pack results (no-smartphone case), producing one
  Ingestion Run and a batch of `holiday_return` Evidence.
- **Printable pack rendering** — extends the existing
  `lib/assignments/pdfRenderer.ts` responsibility; no new route
  responsibility, new input shape only (Recommendation Layer output
  instead of a single manually-specified assignment).

---

## 10. Database Implications

Deliberately minimal — the brief's own philosophy ("start simple") argues
against new tables where an existing one, extended, already fits:

- **`evidence` table** (backing `EvidenceRepository`): no schema change.
  `evidence_source` and `extraction_method` are already free-text/enum
  columns per the existing `NewEvidenceRow` shape (`lib/repositories/evidence.repository.ts`)
  — `'holiday_return'` and `'holiday_engagement'`/`'holiday_mastery'` are
  new *values*, not new *columns*.
- **Holiday plan storage**: existing `HolidayPlanData` persistence
  (wherever `generateHolidayPlan`'s output is currently stored — the
  Holiday Publish Gate work already established a publish/draft
  distinction) gains one new small table or JSON column for **Holiday
  Return** records: which learner, which week, returned Y/N, teacher
  comment, link to the Ingestion Run. This is genuinely new — it is the
  one piece of state that has no existing home, because the return path
  has never existed before this document.
- **Class differentiation groups**: no new persistent table needed for
  the pilot — a differentiation run's grouped output can be generated
  on-demand from Projection + the Remedial Planner's existing logic each
  time a teacher opens the review screen, same as the Remedial Planner
  does today (`generateRemedialPlan` is called fresh, not read from a
  cached table). Persisting an *approved* set (for re-printing, for
  audit) is a `RemedialPlan`-shaped row — the existing `remedial_plans`
  storage pattern, reused, not a new table family.
- **Required indexes**: the new Holiday Return table needs `teacher_id`,
  `student_id` per CLAUDE.md's standing index rule — no exception here.

---

## 11. Migration Implications

This is one more row in the Migration Ledger's discipline, not an
exception to it:

- **Holiday Planner** moves from **Legacy** to **Projection** in the
  Ledger (§4 above) — this is the one Ledger row this document directly
  changes. Its "Deferred — not named in Phase 4 mission" note is
  superseded by this document naming it explicitly in scope.
- **Remedial Planner** stays **Legacy** in the Ledger, entirely unchanged
  and not called by the Recommendation Layer — only its group-taxonomy
  *shape* (§2, §3) is ported into a new, Projection-fed function. This is
  a deliberate non-dependency: Remedial Planner's own future migration (if
  it happens) remains a separate, future Ledger row, untouched by this
  document.
- **Parent Pulse** and **Monday Panel** remain Legacy/Deferred, unchanged
  — Adaptive Learning v1 does not depend on either migrating first.
- No changes to any **Deferred** row's status beyond Holiday Planner.

---

## 12. Rollout Strategy and Pilot Implementation Sequence

Priority order restated with the concrete dependency chain, matching the
brief's own numbered priorities:

1. **Recommendation Layer (§2)** — must exist first; every other item
   depends on it. Smallest correct slice: wraps the existing Remedial
   Planner grouping logic and the existing Holiday Planner's gap-priority
   logic behind one Projection-reading function. No new AI calls beyond
   what these two engines already make.
2. **Holiday Planner re-pointed to Projection + Recommendation Layer
   (§4)** — proves the Recommendation Layer against the highest-value
   existing surface first, with the lowest blast radius (holiday
   generation is not a daily-critical-path feature the way classroom
   differentiation would be).
3. **Printable pack extended (§5)** — reuses #2's output; mechanically
   small once #1 and #2 exist, because `pdfRenderer.ts` already does the
   hard part (level-scaffolded rendering).
4. **Classroom differentiation + teacher approval flow (§3)** — highest
   teacher-visible value, deliberately sequenced after holiday/printable
   because it touches the daily teaching workflow directly; ship it once
   the Recommendation Layer has already been proven against lower-stakes
   holiday output.
5. **Holiday Return intake + Evidence Loop closure (§4, §7)** — the
   piece with no existing precedent; sequenced last within the "must
   ship for pilot" set because it can only be built and tested once real
   Holiday Journeys (from #2) exist for real learners to return.
6. **Projection recompute on Holiday Return, Behaviour/Growth/Risk
   picking it up (§8)** — no new code beyond #5 delivering evidence
   correctly into the existing pipeline; this is the "free" payoff of
   having built Evidence correctly rather than a `learner_profiles` patch.

**Rollout mechanics** for a single pilot school, Third Term:
- Term-time weeks: only §3 (classroom differentiation) is live-facing;
  everything else is dormant infrastructure, reducing pilot risk to one
  feature at a time.
- First holiday break (whichever falls first in the school's Third Term
  calendar — commonly the shorter midterm break before the main
  November–December holiday): first live run of §4/§5/§6 end-to-end, at
  small scale (one class, not the whole school), matching the existing
  "start simple, grow later" discipline already applied to Holiday
  Planner's own publish-gate rollout.
- Full holiday (November–December): full-school rollout once the
  midterm run has proven the Evidence Loop closes correctly.

---

## 13. Scalability After the Pilot

Deliberately not designed in detail here — named as direction, per the
same discipline Compass v2 §20 already modeled:

1. **Widen Recommendation Layer inputs** as more Projection dimensions
   mature (substrand-level knowledge, capability breakdown, duration
   tracking — the same Migration Ledger gaps named in §8) — informed by
   real pilot data, not designed speculatively now.
2. **Automate the Attention Feed "holiday non-return" signal (§8)** once
   there's a real distribution of return rates to calibrate a threshold
   against.
3. **Extend delivery channels** (SMS, native mobile app) as Model D
   schools (fully digital) join — the architecture in §1 already
   supports this: a new channel is a new renderer over the same
   Recommendation Layer output, not a new intelligence path.
4. **Multi-school Recommendation Layer tuning** — once more than one
   pilot school's data exists, whether ZPD thresholds or Group-C
   enrichment criteria need per-school calibration becomes an answerable,
   evidence-backed question rather than a guess.
5. **Retire `lib/holiday/planner.ts`'s direct `learner_profiles` read
   entirely** once its dual-write conditions (Migration Ledger) are
   otherwise satisfied — already governed by the existing Ledger exit
   condition, not a new one this document introduces.

---

## 14. Risks

- **Group-C (enrichment) is new logic inside an otherwise-proven planner**
  (§3) — the existing Remedial Planner has never had to define "what does
  an advanced learner need," only "what does a struggling one need."
  This is the one genuinely new piece of pedagogical logic in this
  document and should be validated with real teacher feedback in the
  pilot's first differentiation cycle before being trusted at scale.
- **Holiday Return is the one workflow with no live precedent.** Every
  other piece in this document extends something already running in
  production; the Return intake does not. Treat its first live cycle
  (midterm break, §12) as a deliberately small-scale proof, not a
  full-school launch.
- **Auto-confirm scope creep, again** (same risk Compass v2 §18 already
  named) — `holiday_engagement` auto-confirm must stay engagement-only.
  The temptation to also auto-confirm `holiday_mastery` under teacher
  time pressure is the same failure mode Compass v2 already flagged, now
  with a second entry point into the same trap.
- **Printable-pack cost and logistics** (paper, printing capacity at a
  boarding school) are an operational risk outside this document's
  architectural scope, but worth naming: the architecture assumes a
  school can reliably print and physically distribute/collect packs
  each holiday — a pilot-readiness question for the school partnership,
  not a system design question.
- **Divergence if Holiday Planner's re-point (§4) is only partially
  done** — same caution the Migration Ledger already states generally:
  a holiday planner reading Projection for gaps but still reading
  `learner_profiles` for career signals (or vice versa) recreates the
  exact "two sources of truth" problem this whole redesign exists to
  close. The re-point must be complete, not partial, before rollout.
