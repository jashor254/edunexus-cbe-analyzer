# Reference School — Module 2: Academic Structure

Status: **FROZEN**. Architecture Approved · Business Scope Approved ·
Academic Structure Approved. No structural changes except bug fixes or
explicitly approved architectural revisions. Future modules must treat
this document as a stable dependency.

Depends on: [[01-school-profile-and-structure]] (frozen — school identity,
departments, roles).

## Purpose

Module 2 defines the academic backbone of Mwatate Ridge Senior School: the
calendar and structural entities that every later module (Students,
Teachers, Timetable, Attendance, Assessment) hangs off. It introduces no
students, teachers, attendance, assessments, timetables, finance, reports,
or intelligence features — those are later modules. Per the frozen
database philosophy in Module 1, this is also the first module allowed to
introduce production schema, and only for the entities it owns.

---

## 1. Academic Years

- An **Academic Year** spans one calendar year of CBC schooling (e.g. "2026").
- Exactly one Academic Year is `active` at a time; the system must reject
  activating a second one concurrently.
- An Academic Year owns 3 Terms (see below) and is the top-level container
  for promotion/progression decisions.
- **Edge case — year rollover:** the outgoing year isn't deleted or
  archived destructively; it's marked `closed` and remains fully readable
  (report cards, historical class rosters) indefinitely.
- **Edge case — mid-year school calendar shift:** if KNEC/MoE shifts term
  dates after the year is already active (this happens in real Kenyan
  schools), term dates must be editable without breaking data already
  recorded against that term.

## 2. Academic Terms

- Each Academic Year has exactly **3 Terms** (Term 1, Term 2, Term 3),
  matching the CBC calendar described in Module 1 (Term 1: Jan–Apr, Term 2:
  May–Aug, Term 3: Sep–Oct).
- Each Term has: start date, end date, a mid-term break window, and an
  exam window (used later by Modules 5/7 for timetabling and assessment).
- Terms are sequential and non-overlapping within a year.
- **Edge case — mid-term admission:** a student admitted mid-term (see
  Module 3) must still be assignable to the current term without requiring
  the term to be "restarted."
- **Assumption:** Terms do not span two Academic Years (no Kenyan school
  calendar currently does this); if this changes, Term would need a
  cross-year foreign key model — flagged, not built now.

## 3. Grade Levels & Form Levels

- Mwatate Ridge is a **Senior School** offering **Grade 10, 11, 12** under
  CBC (the "Form 3/Form 4" 8-4-4 legacy naming is retained only as an
  informal alias since some parents and older staff still use it — the
  system's canonical labels are Grade 10/11/12).
- A Grade Level does **not** itself carry a pathway. Pathways (STEM, Social
  Sciences, Arts & Sports Science, and others the curriculum policy
  defines — see Section 12) are offered starting at Grade 10, but pathway
  is a **per-student attribute**, assigned and changed via the Students
  module (Module 3). Grade Level only records which pathways are *offered*
  at that grade, not who is in which.
- **Edge case — repeat learners:** a learner repeating a grade must be
  representable without being treated as "new" — this is a Student-module
  concern (enrollment history), but Grade Level itself must not assume
  one-student-per-grade-per-year.

## 4. Classes & Streams

- A **Class** is the combination of a Grade Level + Stream for one Academic
  Year (e.g. "Grade 10 East").
- Each Grade Level has **3 streams**: East, West, Central — chosen as
  neutral geographic labels rather than ability-based *or pathway-based*
  labels (CBC discourages streaming by ability, and per architectural
  decision, streams are administrative groupings that stay academically
  neutral by default).
- **Streams are pathway-neutral.** A stream does not carry or imply a
  pathway. Within "Grade 10 East," students may independently belong to
  STEM, Social Sciences, Arts & Sports Science, or any other pathway the
  curriculum policy defines — the pathway belongs to the student (Module
  3), never to the stream. This is the default architecture; a school
  choosing to run pathway-specific streams instead would need an explicit,
  separately-configured override, not built now.
- **Class capacity rule:** each class has a maximum capacity of **45**
  students (Kenyan public senior-school norm); admission/placement logic in
  Module 3 must respect this cap but the cap itself is defined here as a
  property of the Class.
- A Class has exactly one **Class Teacher** (role defined in Module 1) —
  assignment of a specific teacher to a specific class is a Teacher-module
  (Module 4) concern; this module only defines that the slot exists.
- **Edge case — new class formation mid-year:** if enrollment surges,
  opening a 4th stream mid-year must not corrupt existing timetable/subject
  allocations for the other 3 streams (relevant once Module 5 exists;
  flagged here since Class is defined in this module).
- **Edge case — class capacity breach:** the system should be able to
  represent an over-capacity class (e.g. 46/45) as a *flagged exception*
  rather than a hard block, since real schools sometimes must exceed
  capacity temporarily — hard-blocking belongs to the Admissions workflow
  in Module 3, not to the Class entity itself.

## 5. Subject Catalogue & Categories

- **Subject Categories:** Compulsory, Pathway-specific (STEM / Social
  Sciences / Arts & Sports Science elective), and Co-curricular-linked
  (e.g. Music, Art & Design count toward both academic and co-curricular
  records).
- **Compulsory subjects** (all students, all pathways): English, Kiswahili,
  Mathematics, Community Service Learning.
- **Pathway subjects** — students select electives from their pathway's
  list; the minimum/maximum number of electives is not a fixed value in
  this catalogue but is governed by the Curriculum Policy Framework
  (Section 12), which can vary by Academic Year and by school.
- Each Subject belongs to exactly one **Department** (departments were
  defined in Module 1 — this module is what actually links Subject →
  Department as real data, since Module 1 didn't create subject rows).
- Each Subject is flagged `practical: boolean` — practical subjects
  (Physics, Chemistry, Biology, Agriculture, Computer Studies) require lab
  scheduling in Module 5 and lab resources in a later Laboratory module.
- **Edge case — subject discontinuation:** if a subject is dropped from the
  curriculum (rare but happens on syllabus review cycles), historical
  records referencing it must remain valid — Subjects are never hard
  deleted, only marked `retired`.
- **Edge case — cross-pathway elective:** CBC allows some electives to be
  taken across pathways in practice (e.g. a STEM student taking Business
  Studies as a 7th subject) — the catalogue must not hard-block this, even
  though it's the exception rather than the rule.

## 6. Curriculum Relationships

- Subject → Department (many subjects to one department, defined above).
- Subject → Pathway (many-to-many: a subject like Computer Studies can
  appear in both STEM and Social Sciences pathway lists).
- Grade Level → Pathway (many-to-many: records which pathways are *offered*
  at a grade — only Grade 10 and above, consistent with CBC's Senior School
  design — without implying any student or stream is tied to one).
- Student → Pathway is explicitly **not** defined here; it's a Module 3
  (Students) relationship. This module only defines what pathways exist and
  what's offered where.
- This module does **not** define Subject → Prerequisite relationships
  (e.g. "must have passed Grade 9 Integrated Science to take Grade 10
  Physics") — that's curriculum-sequencing intelligence, explicitly
  deferred to Module 12 (Learning Intelligence Layer) per the frozen
  roadmap, even though it might feel like it belongs here. Flagged so it
  isn't lost.

## 7. Weekly Teaching Periods & Lesson Period Structure

- The school week runs **Monday–Friday**, structured into fixed periods:
  8 teaching periods/day, each 40 minutes, with a 20-minute short break and
  a 60-minute lunch break — this is the period *grid*, not the timetable
  itself (actual lesson-to-period assignment is Module 5).
- Each Subject has a defined **weekly period allocation** (e.g. Mathematics
  = 6 periods/week, Music = 2 periods/week) — this is a property of the
  Subject/Grade combination, since allocation can differ by grade.
- Practical subjects additionally require **double periods** for lab
  sessions (defined as a property of the subject: `requires_double_period:
  boolean`), which Module 5's timetable engine must honor.
- **Edge case — assembly/games/clubs:** these occupy fixed weekly slots
  (e.g. Monday assembly, Wednesday afternoon games) that are *not* subjects
  but do consume period-grid time — represented as reserved, non-subject
  slots in the period grid so Module 5 doesn't double-book them.

## 8. Academic Calendar

- Composed from Academic Year + Terms + fixed annual events: opening day,
  closing day, mid-term break, exam weeks (per term), prize-giving day,
  KCSE-equivalent national assessment windows where applicable to Grade 12.
- The calendar is the single source of truth later modules query against
  (e.g. Attendance in Module 6 needs to know which days are school days vs.
  holidays; Assessment in Module 7 needs exam windows).
- **Edge case — public holidays falling on a school day:** the calendar
  must be able to mark an otherwise-instructional day as a holiday without
  requiring the whole term's date range to shift.

## 9. Promotion & Progression Rules

- At year-end, a student in Grade 10 normally progresses to Grade 11 in the
  next Academic Year, staying in the same stream unless reallocated.
- Progression is **not automatic data mutation** — this module defines the
  *rule* (what promotion normally looks like); the actual act of promoting
  a specific student's enrollment record is a Student-module (Module 3)
  operation performed at year-end rollover.
- **Edge case — repeat/hold-back:** a student who doesn't progress stays in
  the same Grade Level in the new Academic Year — the rule must not assume
  progression is mandatory.
- **Edge case — pathway change at Grade 11/12:** CBC generally locks
  pathway choice after Grade 10, but real schools do occasionally permit a
  late change for exceptional cases — representable as an approved
  exception, not a normal path.
- **Edge case — Grade 12 exit:** Grade 12 has no "next grade" — completion
  transitions the student to alumni status, which is a Student-module
  concern but the Grade Level structure here must not assume every grade
  has a successor.

## 10. Class Capacity Rules

Covered under Classes & Streams (Section 4) — restated here as its own
named rule per the requested scope: capacity is a property of the Class
entity (default 45), enforceable as a soft flag rather than a hard
constraint, with the actual admission decision logic living in Module 3.

## 11. Subject Allocation Rules

- "Subject allocation" at this module's level means: **which subjects a
  Class offers**, and **how many weekly periods each gets** — not which
  teacher teaches it (that's Module 4) and not the timetable slot (Module
  5).
- All streams within a Grade Level offer the **same full subject catalogue**
  — every compulsory subject and every pathway elective available at that
  grade — since streams are pathway-neutral (Section 4). A Class's subject
  offering is therefore a property of Grade Level, not of the individual
  stream.
- Because pathway electives are chosen per-student rather than per-stream,
  a given elective's actual roster cuts across all streams in a Grade
  Level (e.g. STEM students from East, West, and Central all take Physics
  together as one teaching group). This module records that a Subject's
  enrolled students are **not** coextensive with any one Class — it does
  not solve how that cross-stream group gets scheduled (that's Module 5)
  or how a student's pathway is recorded (Module 3).
- **Edge case — under-subscribed elective:** if too few students
  school-wide select a pathway elective, the same cross-stream grouping
  mechanism above absorbs it naturally — there's no separate "combine
  streams" case to design, since electives were never stream-scoped to
  begin with.

## 12. Curriculum Policy Framework

Rather than hardcoding elective counts, Module 2 defines a **configurable
curriculum policy** because these values change over time (syllabus
reviews) and could differ by school if the Reference School's model is
ever adapted elsewhere.

- A **Curriculum Policy** is scoped to an Academic Year (defaulting forward
  each year unless explicitly revised — a policy is not re-authored from
  scratch every year, but every year has one in force).
- Each Curriculum Policy defines, per Grade Level:
  - **Mandatory subjects** — a reference to the compulsory subject list.
  - **Optional subjects** — the pool of pathway electives available.
  - **Minimum required electives** and **maximum allowed electives** a
    student may carry (e.g. min 3, max 5 — illustrative, not fixed by this
    module).
  - **Pathway-specific requirements** — e.g. a rule like "STEM pathway
    electives must include at least one of Physics/Chemistry/Biology."
  - **School-specific overrides** — a policy can override a default rule
    for this school specifically, keeping the framework generic even
    though only one school (Mwatate Ridge) exists today.
- **Edge case — policy change mid-year:** a Curriculum Policy is versioned
  per Academic Year and never mutated retroactively — changing next year's
  policy must not alter what was valid for a student's already-completed
  year.
- **Edge case — grandfathering:** a student who started under an older
  policy's elective rules should be evaluable against the policy that was
  active when they made their selection, not the currently active one —
  this module records policy history to make that possible; enforcing it
  is a Module 3 (Students) concern.

## 13. Departments

Departments become a first-class Module 2 entity — they are part of the
academic framework (subjects need a real owner), not the staff structure.
Module 1 named the six academic departments as organizational concepts;
this module is what turns them into real, queryable data.

A Department has:
- **Name** — e.g. "Sciences."
- **Code** — short stable identifier, e.g. `SCI`, used in reporting and
  future timetable/room-code generation.
- **Description** — free text, one paragraph.
- **Academic Category** — Academic / Administrative / Support / Special
  Unit, matching Module 1's classification (Section 3 of that document),
  so non-academic departments named there (Finance, ICT, Library, etc.)
  can also be represented uniformly if a later module needs to reference
  them structurally — though only the 6 academic departments have Subjects
  attached to them via this module.
- **Status** — active / retired (a department is never hard-deleted once
  it owns historical subject/teacher records).
- **Future relationships** (not built now, noted for forward-compatibility):
  Head of Department assignment (Module 4 — Teachers), teaching load and
  workload reporting (Module 4+), department-level assessment moderation
  (Module 7), department-level analytics (Module 11+).

**Ownership split:** Module 2 *defines* Departments (the entity and its
core fields). Module 4 *assigns* teachers and a Head of Department to a
Department. Module 6 and later *use* Departments for reporting, workload,
assessments, and analytics. This keeps the dependency direction one-way —
later modules depend on Module 2's Department, never the reverse.

---

## Module 2 Boundaries

**In scope:** Academic Years, Terms, Grade Levels, Classes, Streams,
Departments, Subject Catalogue, Subject Categories, Department↔Subject
linkage, Pathway↔Subject/Grade linkage, the Curriculum Policy Framework
(elective min/max, mandatory/optional subjects, pathway-specific
requirements, school-specific overrides), weekly period allocation,
period-grid structure, academic calendar, promotion/progression rules
(rule definition, not execution), class capacity rules, subject allocation
rules (offering + period count, not teacher or timetable slot).

**Explicitly out of scope:** Students, Teachers, Attendance, Assessments,
Timetables (slot assignment), Finance, Reports, Learning Intelligence,
Adaptive Learning, Career Intelligence, AI Agents, prerequisite/sequencing
intelligence between subjects, Student↔Pathway assignment.

**Data ownership:** Module 2 owns the full academic framework —
`academic_years`, `terms`, `grade_levels`, `classes`, `streams`,
`departments`, `subjects`, `subject_categories`, `pathways`,
`curriculum_policies` (plus their per-grade elective/requirement rules),
and the join tables connecting them (`subject_pathways`,
`grade_level_pathways`, `subject_grade_periods`). It owns the academic
framework, not people or learning records: Module 4 assigns teachers
(including Heads of Department) to Departments; Module 3 assigns students
to pathways and classes; Module 6+ generates workload, assessment, and
analytics data that *reference* these entities without redefining them.
`school_houses` remains deferred to whichever module first needs house
membership as data (likely Module 3, Students).

---

## Module 2 Freeze Record

**Checkpoint 1 — Business rules complete:** Academic Years/Terms/Grades/
Classes/Streams/Departments/Subjects/Curriculum Policy are each fully
specified above with concrete fields and default values (illustrative
where the exact number is a policy value, e.g. elective min/max).

**Checkpoint 2 — Academic ownership clearly defined:** Section immediately
above states what Module 2 owns vs. what it explicitly defers to Modules
3/4/5/6+, with a one-way dependency direction (later modules depend on
Module 2, never the reverse).

**Checkpoint 3 — Edge cases documented:** Year rollover, mid-year calendar
shift, mid-term admission, repeat learners, class capacity breach, mid-year
stream formation, subject discontinuation, cross-pathway electives,
assembly/games slots, public holidays, repeat/hold-back, late pathway
change, Grade 12 exit, under-subscribed electives, policy change mid-year,
and policy grandfathering are all captured inline in their relevant
sections.

**Checkpoint 4 — Module boundaries respected:** No student, teacher,
timetable slot, attendance, assessment, finance, report, or AI/Learning
Intelligence logic appears anywhere in this document — every place one of
those would be relevant is explicitly flagged and deferred to its owning
module.

**Result: Module 2 Frozen.**
Architecture Approved · Business Scope Approved · Academic Structure
Approved · Ready for Freeze · **Module Frozen.**

Future modules — Students, Teachers, Timetables, Assessments, Career
Intelligence, Adaptive Learning, and the Learning Intelligence Layer — must
treat Module 2 as a stable dependency. No structural changes to this
document except bug fixes or explicitly approved architectural revisions.

Proceeding to Module 3 — Students.
