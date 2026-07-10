# Data Migration Strategy — Getting Real School Data to a Report

Status: ENQUIRY — documentation only. No migration code, no new tables.
This document answers a narrower question than
[Learning Intelligence Migration Strategy](learning-intelligence-migration-strategy.md):
not "how do we eventually move everything to Core," but "what does it
actually take to get ONE real report out for a real school, and what's
the cheapest honest path to that."

Depends on (treated as fixed facts, not re-litigated here): Core has no
working assessment pipeline (`class_assessments.class_id` FKs to legacy
`teacher_classes`); intelligence's only fuel is `assessments.subject_scores`;
the [School Integration Pipeline](school-integration-pipeline.md) design is
frozen but unbuilt; legacy schools are a free-text string
(`teachers.school`), not a real FK.

---

## 1. The Real Dependency Chain

Traced end-to-end against the actual code, two reports, both purely
`student_id`-scoped with **zero school/tenant filtering anywhere in the
chain** — every query runs through `BaseRepository` (`lib/repositories/base.ts:4-9`),
which uses a service-role client that bypasses RLS entirely. There is no
`teacher_id`/`school_id`/`school_name` check inside either report builder.

### Learner Blueprint (`buildLearnerBlueprint`, `lib/learnerIntelligence/blueprint.ts:216`)

| # | Table | Columns read | Keyed by | Query location |
|---|---|---|---|---|
| 1 | `students` | `name, grade, school, term, year, current_pathway` | `id` | `learner-model.repository.ts:404-408` |
| 2 | `learner_profiles` | full profile (25 columns) | `student_id` | `learner-model.repository.ts:88-93`, upsert `107-111` |
| 3 | `assessments` | `subject_scores` | `student_id`, ordered `created_at asc` | `learner-model.repository.ts:429-433` |
| 4 | `holiday_plans` | `plan_data, published_at` | `student_id`, `is_published=true`, `published_at >= now-45d` | `learner-intelligence.repository.ts:349-356` |
| 5 | `knowledge_nodes` | 14 columns | `subject, grade` (Grade 7 Math only — `blueprint.ts:112`) | `knowledge-graph.repository.ts:121-126` |
| 6 | `knowledge_edges` | 7 columns | `prerequisite_node_id IN (...)` | `knowledge-graph.repository.ts:57-60` |
| 7 | `strand_assessments` | `subject, strand, topic, rating` | `student_id` | `knowledge-graph.repository.ts:143-146` |
| 8 | `node_assessment_map` | `subject, strand, topic, node_id` | `grade` | `knowledge-graph.repository.ts:151-154` |

Tables 5–8 are **global reference data** (knowledge graph), not
per-student, not per-school — they already exist and require nothing from
a real school's import.

### Clinic Report (`buildClinicReport`, `lib/career/clinicReportBuilder.ts:662`) — diverges after the first two tables

| # | Table | Columns read | Keyed by | Query location |
|---|---|---|---|---|
| 1 | `students` | `id, name, grade, curriculum_type, date_of_birth, current_pathway` | `id` | `clinicReportBuilder.ts:668-672` |
| 2 | `assessments` | `subject_scores, created_at` (latest 5) | `student_id` | `clinicReportBuilder.ts:686-691` |
| 3 | `student_learning_context` | `recommended_pathway, first_subject, session_goal, overall_tier` | `student_id` | `clinicReportBuilder.ts:729-733` |
| 4 | `student_interests` | `interests` | `student_id` | `clinicReportBuilder.ts:746-750` |
| 5 | `student_career_interests` | `career_slug, notes` | `student_id` | `clinicReportBuilder.ts:754-759` |
| 6 | `student_career_matches` → `careers` (joined) | match fields + full career fields | `student_id` | `career.repository.ts:150-158` |
| 7 | `careers` | title/required_subjects etc. (multiple query shapes) | `slug` / `id` | `career.repository.ts:48-52, 102-105, 139-142` |

**The two reports share only `students` and `assessments` — everything
else is disjoint.** Blueprint and Clinic Report are not "mostly the same
chain"; they are two separate consumers of the same two foundational
tables plus entirely different enrichment data.

### The true minimum data contract

Stripping enrichment (holiday plans, strand assessments, career
interests — all optional, all degrade gracefully to empty/default when
absent) down to what's structurally required to produce *a* report at
all:

- **One `students` row** — NOT NULL columns per schema: `grade, level, name`.
- **At least one `assessments` row with populated `subject_scores`** — NOT
  NULL columns: `student_id, grade, term, year`.

That's it. Everything else — `learner_profiles` (auto-created via upsert
on first read), `holiday_plans`, `strand_assessments`,
`student_learning_context`, career interests/matches (auto-generated via
AI on first read if absent) — either self-initializes or degrades to an
empty/default section rather than blocking the report. **The entire
report's substantive output is gated on one thing: whether
`assessments.subject_scores` has real data in it.** Without it, the
report renders without erroring, but every capability/pathway/career
section is computed from an empty score array — technically successful,
substantively empty.

---

## 2. The Gap Matrix

| Required field/table | Legacy location | Core location | Gap |
|---|---|---|---|
| Learner name/identity | `students.name` | `learners.first_name/last_name` | Both real, different shape — no gap, just a rename/split |
| Grade | `students.grade` (int, flat column) | *Not a column on `learners` at all* — derived via `learner_enrollments.class_id → classes.grade_id → grades` | Core requires a 3-table join for what legacy has as one column |
| School scoping | `students.school` (free text, no FK) | `learners.school_id` (real FK → `schools`) | **Core is strictly better here** — this is the one place Core already solves something legacy doesn't |
| Term/year | `students.term/year` (nullable ints) | `learner_enrollments.term_id → terms` (FK) | Core more correct, requires join instead of flat read |
| Pathway | `students.current_pathway` (text column, populated) | **Does not exist anywhere in Core schema** — documented in the frozen Reference School Module 2/3 docs but never built as a column or table | Total gap, not partial |
| Assessment scores | `assessments.subject_scores` (jsonb, keyed by student_id, real data for real users) | **Does not exist.** `class_assessments.class_id` FKs to legacy `teacher_classes`, not Core `classes` | **Total gap — this is the load-bearing one.** Every report's substantive content depends on this and only this. |
| `learner_profiles` (capability/risk/engagement state) | Real table, FK'd to `students.id` | **No Core equivalent table at all** | Total gap |
| `holiday_plans` | Real table, FK'd to `student_id`, optional nullable `school_id` (unused in read path) | No Core learner can have one (FK targets `students`, not `learners`) | Total gap (but this field is optional/enriching, not load-bearing) |
| `strand_assessments` / `node_assessment_map` / `knowledge_nodes` / `knowledge_edges` | Per-student (`strand_assessments`) + global reference (the other three) | Global reference tables have no student/learner FK at all — usable by either schema unchanged. `strand_assessments` (per-student) has no Core replacement | Reference data: no gap. Per-student signal: total gap, but Grade-7-Math-only and optional |
| `student_learning_context`, `student_interests`, `student_career_interests`, `student_career_matches` (Clinic Report inputs) | Real tables, all FK'd to `students.id` | No Core equivalent | Total gap, but all optional/auto-generating |
| `careers` (global reference) | Real table, no student FK | Same table, schema-neutral | No gap — already usable regardless of schema |

**The concrete consequence, stated plainly**: a Core-schema learner today
can have a name, a school, a class, guardians — a complete operational
record — and **zero path to a non-empty Blueprint or Clinic Report**,
because the one table that actually feeds either report
(`assessments.subject_scores`) has no working Core equivalent. This isn't
a partial gap to patch around; it's the entire reason "Core-first"
(§3b) is expensive.

---

## 3. Two Honest Paths

### (a) Legacy-First

**What it is**: build the importer from the frozen School Integration
Pipeline design, but point it at legacy tables (`teachers`, `students`,
`assessments`, `teacher_classes`, `class_students`) instead of Core
tables. Same validation/upsert/audit-trail shape the frozen design already
specifies — different target tables.

**What breaks**: nothing in the reading code. This is the entire appeal —
14,000+ LOC of intelligence logic and every report already reads this
exact schema in production for real pioneer beta teachers today. A
real school's imported data flows through a path that's already proven,
not a path being proven for the first time under a deadline.

**The multi-school isolation question, examined precisely**: `students.id`
and `teachers.id` are UUIDs — globally unique regardless of which school's
import created them. **There is no cross-school data leakage risk in the
read path** (every query traced in §1 is `student_id`-keyed, and IDs
don't collide). The real risk is narrower than "the whole legacy stack is
unsafe" — it's bounded to two places:
1. **Import-time dedup**: if the importer looks up "does this student
   already exist" by name instead of a stable external ID, two schools
   with a same-named student could collide. The frozen pipeline design
   already specifies `external_id` uniqueness scoped to the *integration
   connection* — the fix here is making sure that scoping key also
   includes the school identity (`teacher.school_name` today), which the
   importer controls entirely; it does not require touching the 14,000
   LOC of intelligence code at all.
2. **Any future "list all students for school X" admin/reporting view**
   built on the free-text `school` string — none exists in either report
   traced in §1, but would need real scoping if built later.

**Smallest safe fix, concretely**: add a nullable `school_id` (FK →
`schools`) column to `students`/`teachers`/`assessments` as a small,
additive migration — not to gate every read (nothing reads it today, and
nothing in §1's chain needs it to), but to give the importer a real,
collision-proof key to dedupe against instead of the free-text string.
This is insurance, not a prerequisite — for a single pilot school, the
free-text string alone has zero collision risk since there's nothing to
collide with.

**Rough scope**: importer + mapping/validation logic (reusing the frozen
pipeline's design, redirected to legacy tables) — roughly 300–600 LOC.
Optional `school_id` FK migration — roughly 20–50 LOC. Zero changes to
the intelligence layer. **Low effort, low risk, fastest path to a real
report.**

### (b) Core-First

**What it actually requires, itemized against §1's real chain:**

1. **A working Core-native assessment pipeline.** Not a repoint of
   `class_assessments.class_id` — that table may already carry real
   production rows under the legacy FK's meaning, so this is schema
   design work (new Core-native table(s) for marks, or a discriminated
   dual-purpose table), not a one-line fix. This also means building the
   actual marks-import format (a real school's gradebook/report card data
   → Core), which the frozen School Integration Pipeline design covers
   for rosters but not assessments specifically.
2. **A Core-native `learner_profiles` equivalent** — no existing table to
   extend; this is new schema, keyed by `learner_id`, plus the repository
   methods to read/write it (`learner-model.repository.ts` currently has
   ~15 methods that would each need a Core-side counterpart or branch).
3. **Rewiring every read in §1's chain** — `learner-model.repository.ts`,
   `learner-intelligence.repository.ts`, `knowledge-graph.repository.ts`
   (the `student_id`-keyed `strand_assessments` call only),
   `career.repository.ts` — from `student_id`/`students` to
   `learner_id`/`learners` plus the join chains Core requires for fields
   legacy has as flat columns (grade, term, year — §2).
4. **A `pathway` concept built from scratch** — genuinely absent from
   Core (§2), not a migration, a new design decision.
5. **`holiday_plans`/`student_learning_context`/`student_interests`/
   `student_career_interests`/`student_career_matches`** — each needs
   either a new Core-scoped table or a second nullable FK column added
   alongside the existing `student_id` one, plus the repository/read-path
   changes to use it.

**What doesn't need work**: the knowledge graph tables and `careers` are
already schema-neutral (no student/learner FK at all) — genuinely no
Core-first cost here.

**Rough scope**: assessment pipeline (schema + import + read path)
~800–1,500 LOC; rewiring the ~15+ repository methods in §1's chain to
Core identity ~600–1,000 LOC; new `learner_profiles`-equivalent table +
repository ~300–500 LOC; the five enrichment tables (dual-FK or
parallel-table approach) ~400–800 LOC. **Total rough order: 2,500–4,000+
LOC of new/changed code**, plus multiple schema migrations touching
tables that may already carry real production data. **High effort,
medium-high risk, not realistic for an August timeline.**

---

## 4. The Plant Point

Given the cost gap between (a) and (b) — roughly 500 LOC and zero risk to
existing production behavior, versus 2,500–4,000+ LOC and real schema
risk — **the cleanest graft point for August is (a): the importer targets
legacy tables.**

This is explicitly **pilot-now, correct-later**, and the two tracks stay
separate on purpose:

- **Pilot track (now, for August)**: real school data → legacy `students`/
  `assessments`/`teacher_classes` via the importer → the existing, proven
  14,000 LOC of intelligence → real Blueprint/Clinic reports for a real
  school. Legacy stays authoritative for intelligence output through the
  pilot.
- **Core track (already in motion, separate timeline)**: the Reference
  School (v1, frozen) continues validating Core's *operational* shape.
  The [Learning Intelligence Migration Strategy](learning-intelligence-migration-strategy.md)'s
  Phases 0–13 proceed on their own schedule — informed by what the pilot
  actually needed once it's running, rather than guessed upfront.

These converge later, when the Core-first migration strategy's Phase 5+
(porting Learner Model itself) is actually undertaken — not before.
Building the pilot on legacy does not block or contradict that plan; it
just declines to gate a real deliverable behind it.

---

## 5. Open Questions — for you to decide, not decided here

1. **Is the August pilot one school or multiple?** This determines
   whether the free-text `school_name` collision risk (§3a) is
   theoretical or needs the `school_id` insurance column before launch.
2. **Does the pilot school have existing digitized assessment/marks
   data** (spreadsheet, existing SIS export), or would EduNexus be their
   first digital marks record? If the latter, the importer's scope
   shrinks significantly — roster import only, with teachers entering
   marks directly into the existing legacy mark-entry UI post-launch,
   no assessments-import path needed at all for August.
3. **What's the actual August deliverable** — a report existing, or a
   real teacher/parent logging in and seeing it? The latter needs an
   auth/account-provisioning path for the pilot school's real users,
   which is out of scope for what was costed here (this document only
   traced report *data* dependencies, not the login/account layer).
4. **Should the pilot write into the same production tables the current
   50 pioneer beta teachers use**, or should the pilot school be kept
   distinguishable within legacy (e.g., a reserved `school` string
   convention, or the `school_id` insurance column from day one) to make
   it trivially separable from existing beta data during testing and
   cleanup?
5. **Is there appetite for a narrow, parallel Core investment** — e.g.,
   only fixing the `class_assessments.class_id` FK, nothing else in §3b's
   list — done alongside the legacy-first pilot rather than fully
   deferred, so the Core track has one less blocker whenever it does
   pick up Learner Model? Or should Core-first stay entirely paused until
   the pilot is done?

---

## What I'd need before any build begins

Answers to §5, plus an explicit go-ahead on which path (a or b) to build
against — this document recommends (a) but does not decide it. If (a):
confirmation on whether the `school_id` insurance migration happens now
or is skipped for a single-school pilot. No schema or code changes should
follow from this document until those are settled.
