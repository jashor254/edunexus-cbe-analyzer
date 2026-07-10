# Learning Intelligence Migration Strategy

Status: DRAFT — architecture decision, not yet executed. Phase 1 (below)
is the only phase complete.

This is an architecture decision, not a refactoring task and not a
migration sprint. It defines the long-term direction for how EduNexus's
Learning Intelligence Layer relates to the Core School Operating System,
and the concrete, sequenced path to get there without ever running two
permanent sources of truth.

---

## 1. Current Platform State

EduNexus currently has two unrelated worlds.

### World 1 — Core School Operating System

The new, correct architecture. Fully FK-scoped by `school_id`. Powers the
[Reference School](../reference-school/README.md) (v1, frozen, tested).
Covers schools, academic years, terms, grades, classes, streams,
subjects, departments, learners, guardians, school staff, and the
beginnings of assessments. This is the platform's operational **source of
truth going forward**.

### World 2 — Legacy schema

Free-text school scoping (`teachers.school` is a string, not a FK), keyed
by `student_id`/`teacher_id`. **This is not just old intelligence
plumbing — it is the live operational store for every real EduNexus user
today**: the 50 pioneer beta teachers and their real students exist only
here, not in Core. Roughly 14,000 LOC of intelligence logic (Learner
Model, Blueprint, Career Intelligence, Knowledge Graph, Compass,
Attention Feed, Assessment Intelligence, Holiday Planner) plus ~7,700 LOC
of frozen EILS/EIR all depend on this schema. None of it can read Core
data today. The one artifact that looks like a bridge between the two
schemas (`core_learner_intelligence`, a view defined in
`20260629_core_foundation.sql`) is dead: it references a join alias
before it's introduced, never appears in the generated types, and is
referenced by zero application code.

**This distinction matters for everything that follows**: World 2 is
simultaneously "the legacy intelligence schema" *and* "where real users
currently live." Any plan that treats it as purely disposable
intelligence debt will hit a wall the moment it tries to delete it.

---

## 2. Architectural Goal

EduNexus becomes a unified platform with exactly one operational source
of truth: the Core School Operating System. The Learning Intelligence
Layer is a **consumer** of Core, never an alternative operational
database, never a second place operational facts can be written.

```
Core School Operating System
        ↓
   Domain Models
        ↓
   Learner Context
        ↓
Learning Intelligence Layer
        ↓
   Applications
        ↓
     Users
```

No intelligence component queries operational tables directly, knows a
column name, or knows which database engine or ORM sits underneath.
Intelligence consumes domain models — stable platform concepts — not raw
rows.

---

## 3. What Is a Permanent Layer vs. a Temporary Crutch

The plan mandates one permanent abstraction (the domain/`LearnerContext`
layer) and forbids two different things that might look similar to it at
a glance. Naming the distinction explicitly, since it's easy to conflate:

**Mandated and permanent: the domain layer.** `LearnerContext` and its
sibling domain models sit in front of exactly **one** canonical schema
(Core). This is ordinary layering — a repository/domain boundary — not a
workaround. It exists so intelligence code never needs to change when
Core's schema evolves. This layer does not go away once migration is
complete; it's the permanent interface.

**Rejected: a permanent sync layer.** Mirroring Core data into legacy
tables (or vice versa) so both stay populated forever. Rejected because
it creates two operational sources of truth, permanently, with all the
drift/debugging/maintenance cost that implies. A *temporary* migration
script that moves data once, in one direction, during a cutover, is not
this — see §5, Phase 0.

**Rejected: a permanent bridging adapter.** A layer whose job is to hide
the fact that two *different, both-still-live* schemas exist, forever.
Rejected for the same reason as sync — it's a permanent crutch that lets
both worlds keep existing indefinitely instead of forcing the migration
to actually finish.

The domain layer is not a smaller version of the rejected adapter — it's
a different thing. The rejected adapter reconciles two live sources
indefinitely; the domain layer stands in front of the one source that
remains after migration completes.

---

## 4. Operational Boundary

Operational modules own operational data: admissions, enrollment,
attendance, assessments, teacher/staff records, timetables, finance,
communication, student identity. This is the Reference School's Modules
1–11 (frozen).

Learning Intelligence owns: predictions, recommendations, risk detection,
learning profiles, career guidance, adaptive learning, learning
analytics, attention signals, personalization, the knowledge graph.

Intelligence never writes operational data directly. A recommendation
(pathway change, intervention, subject support, career exploration,
parent engagement) flows back through the relevant operational workflow
for a human or process to accept — it does not silently mutate a Core
table.

---

## 5. Migration Roadmap

### Phase 0 — Real-User Data Migration (new — the gap in the original plan)

See [School Integration Pipeline](school-integration-pipeline.md) for the
concrete mechanism this phase runs through — legacy data is migrated via
the same ingestion pipeline built for real schools, not a bespoke script.

Before any legacy intelligence code is ported, the real people currently
living only in the legacy schema — the pioneer beta teachers and their
real students, currently addressed by `student_id`/`teacher_id`/free-text
`school` — need an operational home in Core. This is **not** the
permanent sync rejected in §3: it is a one-time (or small-number-of-times,
during a defined cutover window) migration of real operational records
into `schools`/`learners`/`school_users`/`classes`/`learner_enrollments`,
using the same `lib/core/*` functions and Core schema the Reference
School already validates.

Without this phase, Phase 12 ("delete the legacy schema") is
unreachable — there will always be real users still depending on it.
This phase can run in parallel with Phase 2–3 domain model work, since it
doesn't depend on the domain layer existing yet; it only depends on
`lib/core/*`, which is already real and tested.

**Exit criteria:** every real teacher and student that exists in legacy
`teachers`/`students` also exists as a `school_users`/`learners` row in
Core, with enrollment/class/subject data carried across. Legacy rows are
not deleted yet — they become read-only historical record until Phase 12.

### Phase 1 — Operational Foundation ✅ Complete

Reference School operational, stable schema, stable tests, stable seed
data. Frozen. (See `docs/reference-school/`.)

### Phase 2 — Known Prerequisite Fixes

Two concrete blockers were found while building the Reference School and
will stop Phase 3/4 work cold if not addressed first:

1. **`class_assessments.class_id`** has a live FK to legacy
   `teacher_classes`, not Core `classes` — despite `lib/core/assessments.ts`
   being written as if it targets Core. Any `Assessment` domain model work
   hits this immediately. Needs a real schema decision (repoint the FK,
   or introduce a Core-native assessments table) before Phase 4 can model
   assessments meaningfully.
2. **`compass_sessions.learner_id`** is not a `students.id` or `learners.id`
   at all — per existing migration comments, it's the student's
   `auth.uid()` directly, with no FK constraint either way. Compass (Phase
   10) needs its own identity-reconciliation design, not a column rename,
   and that design should happen now, not be discovered mid-phase.

### Phase 3 — Core Domain Models

No AI, no predictions, no analytics. Establish canonical platform
concepts as plain domain types (not database tables, not ORM entities):
`Learner`, `Guardian`, `Teacher`, `Subject`, `Department`, `Class`,
`AcademicYear`, `Term`, `Assessment`, `School`, `CurriculumPolicy`. These
become the vocabulary every later phase uses.

### Phase 4 — LearnerContext

Implement `LearnerContext`, connected entirely to Core — no legacy
schema dependency. Represents everything intelligence needs about a
learner: learner ID, school ID, current academic year/term/grade/stream,
subject selection, guardian relationships, current status, curriculum
policy, pathway, historical progression, class membership. Every
intelligence module will consume this object; none will request a raw
`student_id` or `learner_id` directly.

### Phase 5 — Port Learner Model

The first and most foundational subsystem — Blueprint, Career
Intelligence, and Holiday Planner all sit on top of it today. Make it
consume `LearnerContext`. Remove `student_id` assumptions entirely.
Validate outputs against the Reference School's seeded data.

### Phase 6 — Regression Gate

Compare old (legacy) vs. new (Core-native) Learner Model outputs for
correctness, performance, maintainability, complexity, and developer
experience, using the Reference School as the fixture in both directions
(legacy-schema comparison needs Phase 0's migrated data, or a
parallel legacy fixture — decide which when this phase starts). **Only
proceed past this gate once confidence is high.** Phases 7–13 are not a
committed schedule — they're gated behind this checkpoint actually
passing.

### Phase 7 — Port Blueprint
### Phase 8 — Port Career Intelligence
### Phase 9 — Port Knowledge Graph
### Phase 10 — Port Attention Feed
### Phase 11 — Port Compass (using the identity-reconciliation design from Phase 2)
### Phase 12 — Port remaining intelligence services (Assessment Intelligence, Adaptive Learning, EILS/EIR successors if still wanted)

### Phase 13 — Delete Legacy Schema

Explicit objective, not implied. Reachable only because Phase 0 already
moved every real operational record into Core, and Phases 5–12 already
removed every intelligence dependency on legacy tables. The legacy schema
was always transitional, never part of the long-term architecture.

---

## 6. Development Rules (apply to every phase)

Every migration step must satisfy: business correctness, architectural
correctness, regression safety, Reference School compatibility,
deterministic testing, and backward compatibility where genuinely needed
during cutover. No duplicated business logic between old and new paths
beyond what a phase's own regression gate requires. No hidden
synchronization. No second permanent source of truth. No permanent
compatibility hack surviving past the phase that required it.

---

## 7. Success Criteria

- The Reference School — and every real school migrated in Phase 0 —
  operates entirely on the Core School Operating System.
- Every Learning Intelligence subsystem consumes Core domain models via
  `LearnerContext` (or its siblings for non-learner-scoped concerns).
- No intelligence subsystem references a legacy identifier
  (`student_id`, `teacher.school_name`) or legacy table.
- No permanent synchronization exists between two schemas.
- No permanent adapter exists reconciling two live schemas (the domain
  layer in front of the one remaining schema is not this — see §3).
- The legacy schema has been fully removed, including the real
  operational data that used to live only there (migrated in Phase 0).
- All tests pass, including a regression suite comparing pre/post outputs
  for every ported subsystem.
- The architecture is simpler than before: schema evolution now only
  touches the Core domain layer, not every intelligence subsystem
  individually.

---

## 8. Guiding Principle

EduNexus is not migrating code. It is evolving its architecture. The
goal is not merely making existing intelligence work against a new
schema — it's establishing a domain-driven platform where Core is the
single operational source of truth, the domain layer provides stable
business abstractions, and Learning Intelligence builds insight,
personalization, prediction, and recommendation capability on top of
those abstractions. Every decision here optimizes for the platform
EduNexus intends to own years from now, not for the easiest short-term
migration — but "years from now" starts with Phase 0 actually accounting
for the real users who depend on this working today.
