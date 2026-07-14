# The Academic Evidence Layer

Status: DRAFT — complete architecture, schema, and migration-roadmap design.
**No schema or code changes are authorized by this document.** Per the
2026-07-13 sprint decision: the pilot phase must validate these
assumptions against real school usage before anything here is built.
This document exists so that when the pilot is done, the team builds
once, deliberately, instead of guessing twice.

**Correction (2026-07-13, same day):** §1 finding #5 and §5 below were
checked against an incomplete table list and wrongly concluded no
Evidence/timeline infrastructure exists. It does — `learner_evidence`
(407 rows), `evidence_audit_log` (814 rows), `evidence_projection_events`,
and nine live writer modules are real production code, and the Projection
Engine already consumes Evidence directly rather than assessment names.
See [Learner Record Layer](learner-record-layer.md) for the corrected
picture — that document supersedes this one's §1.5, §4, and §5. §2
(promotion/archival), §3 (teacher attribution), §7 (assessment types),
and §8 (one analytics engine) below are unaffected and still stand.

Depends on (treated as settled decisions, not re-litigated here):
[Evidence Domain Model](evidence-domain-model.md) (what Evidence *is*,
as a concept — this document does not redefine it, only maps assessment
data onto it), [Data Migration Strategy](data-migration-strategy.md)
(Legacy-first decided for the pilot — this document designs against
legacy tables, not Core, for the same reason), [School Integration
Pipeline](school-integration-pipeline.md) (CSV/API import modes already
designed — not redesigned here), [Intelligence Ingestion Engine](intelligence-ingestion-engine.md)
(the `LearnerEvidence` shape this document's new evidence sources must
conform to), [Migration Ledger](migration-ledger.md) (current state of
every Learner Intelligence consumer — the "One Analytics Engine" section
below extends this ledger, it doesn't replace it).

---

## 0. What This Document Answers

The 2026-07-13 sprint brief lays out five rules (learner permanence,
class archival, teacher-independent evidence, permanent remarks,
configurable assessment types), an evidence-sources list, a longitudinal
timeline requirement, and a mandate to collapse today's six duplicated
analytics computations into one engine. This document answers, for each
of those: **what already exists (grounded in the live schema and the
prior architecture docs above), what's a genuine gap, and what the
smallest correct migration looks like** — in that order, because three
of the five rules turned out to be smaller than the brief implied once
checked against reality, and pretending otherwise would cost real
migration risk for no benefit.

---

## 1. Grounding — What The Live Schema Actually Looks Like

Traced directly against Supabase (`mcp__supabase__list_tables`, 2026-07-13),
not assumed:

| Table | Rows | Relevant columns |
|---|---|---|
| `students` | 499 | `id, name, grade, school (text), term, year, curriculum_type, capability_profile, external_id, integration_connection_id` |
| `teachers` | 45 | `id, user_id, full_name, school (text), tsc_number, role` |
| `teacher_classes` | 13 | `id, teacher_id, name, grade, subject, academic_year (text), class_code, stream, grade_cohort, external_id, integration_connection_id` — **no `status`/`archived` column** |
| `class_students` | 485 | `id, class_id, student_id, parent_id, joined_at` — join table, no term/year scoping |
| `class_assessments` | 11 | `id, class_id, teacher_id, title, assessment_type (CHECK-constrained), term (CHECK '1'|'2'|'3'), year, max_score, subjects[], curriculum_type, grade_scale_id, weight_percent, grading_type, is_published, grade_id, external_id, integration_connection_id` |
| `learner_marks` | 476 | `id, assessment_id, class_id, teacher_id, student_id, student_name, admission_number, subject_scores, total_marks, mean_score, mean_grade, position` |
| `assessments` | 89 | `id, student_id, term, year, grade, subject_scores, curriculum_type, source` — a **second**, independent assessment store (parent/self-reported "Academic Clinic" path, per `migration-ledger.md`) |
| `learner_profiles` | 479 | derived/computed state, keyed by `student_id` |
| `holiday_plans` | 52 | `student_id, teacher_id, school_id, term, year, plan_data` |
| `schools` (Core) | 1 | `id, school_name, nemis_code, ...` |
| `learners` (Core) | 405 | `id, school_id, admission_number, first_name/last_name, ...` — Reference School v1 fixture data, not the pilot's live records |
| `classes` (Core) | 10 | `id, school_id, grade_id, stream_id, academic_year_id, ...` — same, fixture data |

**Confirmed findings that change the brief's assumed starting point:**

1. `class_assessments.assessment_type` has a **live database CHECK
   constraint** — `ANY (ARRAY['exam','cat','midterm','endterm','opener','assignment'])`
   — mirroring the Zod enum in `app/api/teacher/assessments/route.ts`. Rule
   5 is a real two-layer fix (DB constraint + API validation), not a
   validation-only change.
2. `students`, `teacher_classes`, and `class_assessments` **already carry**
   `external_id` + `integration_connection_id` columns. These are dead
   schema from the abandoned `integration_connections` design that
   [School Integration Pipeline §2](school-integration-pipeline.md#2-why-not-resurrect-integration_connections)
   explicitly decided not to build on (wrong owner: developer-scoped, not
   school-scoped). They exist on the tables this document also touches —
   worth knowing so nobody mistakes them for a working import path.
3. `assessments` (89 rows, student-scoped, no `class_id` at all) is a
   **second, disconnected assessment store** from `class_assessments`/
   `learner_marks` (476 rows, the teacher gradebook this document is
   about) — already documented in `migration-ledger.md` as two of four
   disconnected destinations. This document's "One Analytics Engine"
   (§6) only unifies the gradebook-side duplication (assessment page,
   class insights, teacher analytics) — it does **not** merge these two
   stores; that's the Intelligence Ingestion Engine's Evidence Store
   decision (§3 of that document), out of scope here.
4. `class_assessments.class_id` is nullable and untyped as an FK in this
   listing — consistent with `data-migration-strategy.md`'s finding that
   it targets legacy `teacher_classes`, not Core `classes`.
5. No `teacher_remarks`, `assessment_types`, or any evidence/timeline
   table exists anywhere in the schema. Rule 4 and the longitudinal
   timeline (§5) are genuine, from-scratch gaps.

---

## 2. Rule 1 + 2 — Learner Permanence and Class Archival

**This is smaller than the brief's framing suggests, and that's worth
stating plainly rather than building ceremony around it.**

`learner_marks`, `assessments`, and `holiday_plans` are already keyed by
`student_id`, independent of any class. A student's assessment history
today **already survives** a class being reassigned or a teacher
changing — there is no code path that deletes or re-keys `student_id`-
scoped rows when `teacher_classes` changes. Rule 1 ("a learner's history
must never be lost after promotion") is *structurally already true* for
every table this document is about. What's genuinely missing is:

1. **No recorded promotion event.** `students.grade` is a single mutable
   integer — when a teacher or admin bumps a student from Grade 7 to
   Grade 8, the old grade value is simply overwritten. The student's
   assessment rows keep their own `grade` column (each `assessments`/
   `class_assessments` row is self-describing), so *evidence* isn't
   lost — but there's no queryable record of "this student was promoted
   on this date, from this grade, into this class."
2. **No class archival state.** `teacher_classes` has no `status` column.
   A class from a prior academic year sits in the same table, same
   query surface, as this year's live classes, distinguished only by
   `academic_year` (a free-text column, e.g. `"2026"`) and `grade_cohort`.
   Nothing currently marks a class as closed.

**Proposed schema (illustrative — not applied):**

```sql
-- teacher_classes: additive, nullable, zero behavior change until used
ALTER TABLE teacher_classes
  ADD COLUMN status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  ADD COLUMN archived_at timestamptz;

-- new: one row per promotion event, append-only, never updated
CREATE TABLE student_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id),
  from_grade integer,               -- null for first-ever enrollment
  to_grade integer NOT NULL,
  from_class_id uuid REFERENCES teacher_classes(id),
  to_class_id uuid REFERENCES teacher_classes(id),
  academic_year text NOT NULL,
  promoted_by uuid REFERENCES auth.users(id),
  promoted_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
CREATE INDEX ON student_promotions(student_id);
```

**Why append-only history, not an update to `students.grade`:** the same
reasoning as the Evidence Domain Model's supersession rule (§3/§4 of
that document) — a correction to "what grade is this student in" should
never erase the record of what grade they were in last term. `students.grade`
remains the fast-read current value (every existing query keeps working
unchanged); `student_promotions` becomes the source of truth for "how did
they get here," which is what the longitudinal timeline (§5) reads.

**Archival mechanics:** at year-end, an admin (or, later, an automated
job) sets `teacher_classes.status = 'archived'` and `archived_at = now()`
for the outgoing year's classes, and creates the new year's classes fresh
(same as today's manual class-creation flow). `class_students` rows for
the archived class are **not deleted or moved** — they remain the
historical record of "this student was in this class, this year." The
student's *new* class membership is a new `class_students` row against
the new class, created alongside the `student_promotions` event.

**What this does NOT require:** no change to `assessments`, `learner_marks`,
or `holiday_plans` — none of them need a new column, because none of them
were ever going to lose data on promotion. The brief's Rule 1 diagram
(Grade 7 → 8 → 9 → ... with "every assessment remains attached to the
learner forever") describes behavior the schema already has.

---

## 3. Rule 3 — Teacher Transfer, Evidence Does Not

Audited against the live schema: `learner_marks` and `class_assessments`
both carry `teacher_id`, but every downstream reader (Blueprint,
Career Intelligence, Parent Pulse, per `migration-ledger.md`) queries by
`student_id`, never joins through `teacher_id` to decide whether evidence
is visible or valid. **`teacher_id` is already attribution, not gating,**
in every consumer traced this session and in the original classroom-
analytics audit earlier in this conversation.

The one place this matters in practice: the class list/marksheet UI
(`app/api/teacher/classes/route.ts`, `app/api/teacher/assessments/[id]/marks/route.ts`)
authorizes *access* through `teacher_id = auth.user`. If a teacher
transfers off a class mid-year, they lose the ability to *edit* that
class's marks (correct — access control) but the marks themselves,
already written, are untouched (correct — Rule 3 already holds). This is
a genuine distinction worth naming explicitly as an invariant rather than
leaving it implicit:

**Invariant to formalize (no schema change required):** `teacher_id` on
any evidence-producing row means "who entered this," never "who owns
this" or "who may read this downstream." Ownership is `student_id` +
`school`/`class` context. This should become a documented rule (e.g. in
CLAUDE.md's Database Rules section) rather than a migration — it is
already true in code, the risk is a future PR silently violating it by
adding a `teacher_id` filter somewhere it doesn't belong.

**One real gap:** there is no `created_by`/`verified_by` distinction
anywhere — `teacher_id` conflates "who entered the mark" with "who, if
anyone, verified it" (relevant once CSV bulk-import or future LMS sync
means the enterer and the class's current teacher may differ). Deferred
to the Evidence Domain Model's existing `verification_states` concept
(§8 of that document) — not re-designed here, just flagged as the
eventual home for this distinction.

---

## 4. Rule 4 — Permanent, Append-Only Teacher Remarks

Confirmed genuine gap: no `teacher_remarks` table, column, or code path
exists anywhere in the repository.

**Proposed schema (illustrative — not applied):**

```sql
CREATE TABLE teacher_remarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id),
  class_id uuid REFERENCES teacher_classes(id),       -- context, nullable (a remark can outlive the class)
  subject text,                                        -- nullable: some remarks are general, not subject-specific
  term integer,
  year integer NOT NULL,
  body text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),  -- attribution only, per §3's invariant
  created_at timestamptz NOT NULL DEFAULT now()
  -- deliberately NO updated_at, NO edit endpoint, NO delete endpoint
);
CREATE INDEX ON teacher_remarks(student_id);
```

**This table is never updated or deleted by application code** — the
brief's example (2026 "quiet learner" → 2027 "confidence improving" →
...) is a sequence of independent rows, ordered by `created_at`, never a
single row being overwritten. This is a **deliberate variance from the
Evidence Domain Model's default supersession rule (§4 of that document)**:
assessment scores supersede on a shared claim key because a re-graded
score genuinely replaces the old one as "the truth." A remark does not —
"quiet learner" in 2026 and "confidence improving" in 2027 are both true,
at their respective times; superseding one would destroy exactly the
signal Rule 4 exists to preserve. **Each remark is its own permanent claim
key** (no two remarks ever share one) — worth stating explicitly so a
future implementer doesn't reflexively apply the general supersession
rule here and quietly break the feature's entire purpose.

**Correction mechanism, if a remark was entered in error:** consistent
with retraction (Evidence Domain Model §2/§10), not deletion — a
`retracted_at` + `retracted_reason` pair, nullable, added later if this
becomes a real need. Not designed now (YAGNI until a pilot teacher
actually hits it) — noted here only so the eventual column names don't
collide with anything already shipped.

**Where this plugs into Evidence:** per the Intelligence Ingestion
Engine's `LearnerEvidence` shape (§2 of that document), this becomes
`evidenceSource: 'teacher_upload'`-equivalent — a new
`assessmentType: 'teacher_observation'` entry, already anticipated in
that document's enum. No new evidence-model concept is needed; this is a
new *source*, not a new *kind of evidence record*.

---

## 5. Evidence Sources — What's Live, What's Net-New

The brief lists twelve evidence sources. Checked one-by-one against the
Migration Ledger and live code:

| Source | State |
|---|---|
| Assessment Results | **Live**, two disconnected stores (`assessments` vs `class_assessments`/`learner_marks` — see §1.3). Not merged by this document. |
| Homework, Projects, Practicals | **Net-new.** No table, no UI path. Would each need either a new `assessment_type` value (if Rule 5 lands first) or a dedicated evidence-source type — decide per-source when a school actually asks, not speculatively now. |
| Teacher Remarks | **Net-new** — designed in §4. |
| Learning Compass Sessions | **Live**, dual-write per `migration-ledger.md` (`lib/compass/evidence.ts` already emits `compass_session` Evidence at tier 1, `pending_review`). This is the one evidence source that already proves the Evidence Domain Model's shape works end-to-end in production. |
| Holiday Learning | **Live** as `holiday_plans`, not yet evidence-tagged — a read-side gap for the timeline (§6), not a write-side one. |
| Attendance | **Net-new.** No table anywhere in the schema. Out of scope — no evidence this is needed before a real school asks. |
| Behaviour | **Net-new.** Same as attendance. |
| Parent Meetings | **Net-new.** Could reuse the `teacher_remarks` shape (§4) with a `source_type` discriminator rather than a separate table — cheaper than a parallel table, decide when built. |
| Interventions | **Partially live** — referenced throughout `migration-ledger.md` (Remedial Planner) but as *derived recommendations*, not as a logged evidence source of "an intervention happened and here's what came of it." Genuine gap if the latter is what's meant. |
| Future LMS imports | **Explicitly deferred** — this is exactly School Integration Pipeline Mode 3 (§1 of that document), already scoped as "deferred until a real school requests it." Not re-opened here. |

**Recommendation:** don't build homework/projects/practicals/attendance/
behaviour/parent-meetings tables speculatively. The Evidence Domain
Model's shape (learner, subject, source, confidence, trust tier, weight,
lifecycle) already accommodates any of them the moment one is actually
needed — adding a new `evidenceSource` enum value and, if it doesn't fit
`teacher_remarks`' shape, a purpose-built table, is cheap *because* the
domain model is already designed generically. Building all twelve now
would be exactly the "premature generalization this project has
consistently avoided" that `school-integration-pipeline.md` already
called out for OAuth connectors — same principle applies here.

---

## 6. The Longitudinal Learner Timeline

Because `assessments`/`learner_marks`/`holiday_plans` are already
`student_id`-scoped and permanent (§2), and `teacher_remarks` will be
too (§4), **the timeline is a read-side aggregation problem, not a
write-side one.** No new storage is required beyond what §2 and §4
already introduce.

**Proposed shape** — one new `lib/` function, not a new table:

```ts
// lib/academicEvidence/timeline.ts
type TimelineEntry =
  | { kind: 'assessment'; grade: number; term: number; year: number; ... }
  | { kind: 'remark'; grade: number; term: number | null; year: number; body: string; ... }
  | { kind: 'promotion'; fromGrade: number | null; toGrade: number; year: string; ... }
  | { kind: 'holiday_plan'; term: number; year: number; ... }

function getLearnerTimeline(studentId: string): Promise<TimelineEntry[]>
```

Implementation is a `Promise.all` fan-out across `learner_marks`
(joined to `class_assessments` for term/year/subjects), `teacher_remarks`,
`student_promotions`, and `holiday_plans`, filtered by `student_id`,
merged and sorted by date. Grade 7→12 grouping (the brief's diagram) is
a client/UI concern applied on top of this flat, chronologically-sorted
list — not a schema concern.

**Not built now** — this is the natural Phase-F deliverable (§8) once
§2 and §4 exist, since it has nothing to read until then.

---

## 7. Rule 5 — School-Configurable Assessment Types

Confirmed real: `class_assessments.assessment_type` is DB-CHECK-constrained
to six hardcoded values (§1.1), duplicated in the Zod enum at
`app/api/teacher/assessments/route.ts:13`. Both must change together —
relaxing only the Zod layer while the CHECK constraint remains would just
move the hardcoding one layer down, not remove it.

**Proposed schema (illustrative — not applied):**

```sql
CREATE TABLE assessment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id),   -- nullable: null = platform default, seeded for every teacher without a school
  teacher_id uuid REFERENCES teachers(id), -- nullable: for solo pilot teachers with no school entity yet (school is a free-text string on `teachers` today)
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, teacher_id, name)
);

-- class_assessments: drop the CHECK, add the FK
ALTER TABLE class_assessments
  DROP CONSTRAINT class_assessments_assessment_type_check,
  ADD COLUMN assessment_type_id uuid REFERENCES assessment_types(id);
  -- assessment_type (text) column kept temporarily for backward read compatibility during rollout, dropped in a later migration once assessment_type_id is backfilled and every reader migrated
```

**Why `teacher_id`-scoped as well as `school_id`-scoped:** per
`data-migration-strategy.md` §1's finding, `teachers.school` is a
free-text string today, not a real FK to `schools` — most of the current
50 pioneer teachers have no `school_id` at all. Scoping only by
`school_id` would leave every existing teacher with zero configured
types. Both scopes exist so a solo pilot teacher can configure their own
list today, and a school-integrated teacher (post School Integration
Pipeline) inherits the school's list once that exists — same pattern as
`grade_cohort`'s `standalone` escape hatch already does in
`teacher_classes` (`app/api/teacher/classes/route.ts:131-135`).

**Backward-compatible default:** on migration, seed every existing
teacher's `assessment_types` with the current six hardcoded values
(Opener/CAT/Midterm/Endterm/Exam/Assignment) so no existing teacher sees
a behavior change until they deliberately customize their list. This is
the same "additive, zero regression" pattern as §2's `status` column
default.

---

## 8. One Analytics Engine

Traced this session (see prior turn of this conversation for the full
walkthrough) — six computations of "what does this assessment/class show":

1. **Assessment page, Subject Analysis tab** — `analyzeSubjects()`
   (`lib/assessments/subjectAnalytics.ts`), computed **client-side**, from
   marks already in browser state. Highest/lowest/average/pass-rate/grade
   distribution, per subject, one assessment.
2. **Class Insights route** (`app/api/teacher/classes/[classId]/insights/route.ts`)
   — ad hoc risk calc from `latestAssessment` only (singular), plus
   `compass_sessions` activity. Not reused anywhere else.
3. **Teacher Analytics route** (`app/api/teacher/analytics/route.ts` →
   `lib/assessments/analytics.ts` → `repos.assessments.getAssessmentAnalytics`)
   — the most complete of the six: class means, subject means, grade
   distributions, per-learner rows, **already groups classes by
   `grade_cohort`** to combine streams. This is the one that should be
   the survivor, not a new fourth thing.
4. **Blueprint** (`lib/learnerIntelligence/blueprint.ts`) — reads
   Projection (per `migration-ledger.md`), a genuinely different
   question (aggregate learner state, not one assessment/class).
5. **Parent Pulse** (`lib/parentPulse/builder.ts`) — same, Projection-sourced.
6. **Career Intelligence** (`lib/learnerIntelligence/careerIntelligence.ts`) — same.

**The real duplication is only among #1, #2, and #3** — all three answer
"what happened in this class/assessment," the "traditional analytics"
layer the brief says must be kept. #4–6 already correctly consume one
shared Projection Engine per the existing Migration Ledger — that
consolidation is **already done**, this document does not need to redo
it, only make sure the new traditional-analytics layer feeds *into* it
the same way Compass evidence already does (§5 above), not around it.

**Consolidation plan for #1–3:**

- Extend `lib/assessments/analytics.ts`'s existing `AnalyticsData` shape
  (already has `mean`, `gradeDistribution`, `highestTotal`, `lowestTotal`,
  per-class and per-subject breakdowns — §5's brief list of "keep these"
  metrics is already ~80% present) to add the two genuinely missing
  traditional stats the brief names and this engine doesn't yet compute:
  **median, mode, mean points** (CBC points-scale, distinct from mean
  score — not currently computed anywhere in this engine).
- Replace `analyzeSubjects()`'s client-side computation (#1) with a call
  to this same engine, scoped to one assessment — currently a
  **different set of formulas** than #3 (e.g. #1's pass threshold is a
  flat 50%, #3's grade distribution uses the CBC EE/ME/AE/BE bands) that
  happen to agree today only because nobody has changed one without the
  other. This is the actual client/server-disagreement risk the brief
  names, not hypothetical.
- Replace #2's `latestAssessment`-only risk read with the same aggregate
  query #3 already does (`getAssessmentAnalytics` already fetches all
  assessments for a class's students — #2 currently re-fetches
  independently with weaker scope).
- **Intelligence layer (Learning Health, Momentum, Concept Mastery,
  Intervention Priority, etc.) is explicitly NOT built inside this
  engine.** Per the Migration Ledger's existing architecture, that's the
  Projection Engine's job, downstream of Evidence, not upstream. This
  document's "one engine" is the traditional-analytics layer only — the
  brief's "traditional analytics answer what happened, EduNexus
  Intelligence answers why" split maps exactly onto today's existing
  boundary between `lib/assessments/analytics.ts` (traditional) and
  `lib/projection/` (intelligence), and should stay that way rather than
  merging two engines that currently have a clean, correct seam.

---

## 9. Migration Roadmap

Phased so each phase is independently shippable, additive, and does not
block on the next. Ordered by dependency, not by the brief's rule
numbering — Rule 1+2 first per the earlier decision, since §2 and §4
are the only two phases anything else (the timeline, §6) depends on.

| Phase | Delivers | Depends on | Rough scope |
|---|---|---|---|
| **A** | `teacher_classes.status`/`archived_at` + `student_promotions` table (§2) | Nothing | ~1 migration, ~100 LOC (promotion endpoint + archive-at-year-end action) |
| **B** | `assessment_types` table + drop hardcoded CHECK/enum (§7) | Nothing (parallel to A) | ~1 migration, ~150 LOC (settings UI + API validation swap), backfill seed for existing teachers |
| **C** | `teacher_remarks` table + entry UI (§4) | Nothing (parallel to A/B) | ~1 migration, ~200 LOC |
| **D** | Traditional-analytics engine consolidation (§8) | Nothing (parallel, but touches live UI — do last of the additive phases to avoid stacking risk with A–C's own UI changes) | Code-only, no migration, ~300–400 LOC + one behavior-parity check (median/mode/mean-points formulas must match what #1/#2 currently show, or be flagged as an intentional correction) |
| **E** | Longitudinal timeline read API (§6) | A + C (needs `student_promotions` and `teacher_remarks` to have real rows) | ~150 LOC, one new `lib/` file, no schema |
| **F** | Rule 3 invariant documented in CLAUDE.md (§3) | Nothing | Docs-only, no code |

**Deliberately excluded from this roadmap:** merging `assessments` vs
`class_assessments`/`learner_marks` (owned by the Intelligence Ingestion
Engine's Evidence Store decision, unresolved there — not re-decided
here); any LMS/SMS import work (owned by School Integration Pipeline,
already scoped, already deferred); any new evidence-source table beyond
remarks (§5 — build when a school asks, not speculatively); Learning
Health/Momentum/Concept Mastery or any other Intelligence Layer signal
(owned by the Projection Engine's own roadmap, not this document's).

---

## 10. Open Questions — For You To Decide, Not Decided Here

1. **Does Phase A's `student_promotions` need a UI at all for the pilot**,
   or is a single admin/teacher action ("promote this class") sufficient
   without exposing the history table anywhere yet? Affects Phase A's
   LOC estimate meaningfully.
2. **Phase B's default six assessment types** — keep exactly today's
   English labels (Opener/CAT/Midterm/Endterm/Exam/Assignment), or is
   this the moment to also ask the 50 pioneer teachers what they'd
   actually name theirs, since the whole point of Rule 5 is that schools
   differ? Doing so pre-pilot vs. waiting for pilot feedback is a real
   choice.
3. **Is Parent Meetings (§5) worth building now as a `teacher_remarks`
   variant**, given it's nearly free once Phase C exists (`source_type`
   discriminator column), or should it wait for a school to ask, same as
   the other net-new sources?
4. **Phase D's behavior-parity question**: when the unified engine's
   pass-rate/grade-distribution formula disagrees with what
   `analyzeSubjects()` currently shows (client-side, different formula),
   should the fix silently correct the displayed numbers, or should
   teachers see a one-time note that the calculation was corrected? This
   is a trust question, not a technical one — same category as the
   Evidence Domain Model's §4 supersession-vs-conflict distinction.
5. **Sequencing A/B/C in parallel vs. serially** — they're independently
   shippable, but three schema migrations to production tables in one
   sprint is a different risk profile than one at a time with pilot
   observation between each. Given the operating charter's "observe
   before building," is the intent to land all three once the pilot
   ends, or stagger them with real usage in between each?

No schema or code changes should follow from this document until these
are settled and the pilot observation window this sprint's own framing
called for has actually happened.
