# Reference School — Module 7: Assessment

Status: **FROZEN**. Architecture Approved · Business Scope Approved ·
Assessment Domain Approved. No structural changes except bug fixes or
explicitly approved architectural revisions. Future modules must treat
this document as a stable dependency.

Depends on: [[01-school-profile-and-structure]] (frozen — Examinations
Officer, HoD moderation authority), [[02-academic-structure]] (frozen —
subjects, curriculum policy, exam windows, terms), [[03-students]]
(frozen — students, explicitly names Module 7 as the trigger for the
Graduated transition), [[04-teachers-and-staff]] (frozen — staff/
staff_subjects define who is eligible to set/mark a subject),
[[05-timetables]] (frozen — exam session placement/invigilation),
[[06-attendance-and-discipline]] (frozen — flags suspension/exam-window
conflicts for this module to resolve).

## Purpose

Module 7 owns everything that produces a mark or a result: assignments,
CATs, projects, practicals, exams (CBC continuous assessment model), the
rubrics that score them, the moderation workflow that checks them, and
the publishing step that makes them visible. It also owns the one
academic decision Module 3 explicitly deferred here: whether a Grade 12
student has met completion requirements and should be transitioned to
`Graduated`.

---

## 1. Assessment Types

- **Assignment** — teacher-set, any subject, informal weighting.
- **CAT (Continuous Assessment Test)** — scheduled, subject + term scoped,
  contributes to the CBC continuous assessment record.
- **Project** — subject or cross-subject (e.g. Agriculture practical
  project), longer-duration, often rubric-scored rather than marks-scored.
- **Practical Assessment** — for `practical: true` subjects (Module 2),
  scheduled into a lab/computer-lab room (Module 5), scored against a
  practical-specific rubric.
- **Midterm Exam / End Term Exam / Mock Exam** — scheduled into Module 5's
  exam sessions, invigilated, subject to full moderation (Section 4).
- Every Assessment record carries: `type`, `subject_id` (Module 2),
  `class_id` or specific student roster (for cross-stream electives, per
  Module 2's frozen decision that a subject's roster isn't coextensive
  with one Class), `term_id`, `academic_year_id`, `set_by_staff_id`
  (must appear in that subject's `staff_subjects`, Module 4), `max_score`,
  `weight` (contribution to the term's overall subject score).

## 2. Rubrics

- A **Rubric** is a set of scoring criteria (each with a description and a
  point range) attached to an Assessment — used for Projects and
  Practicals primarily, optional for Assignments/CATs which more commonly
  use a flat mark out of `max_score`.
- Rubrics are department-owned templates (Module 2's `departments`) that
  can be reused across multiple Assessments within that department, not
  authored fresh every time.
- A student's rubric-scored result is the sum of per-criterion scores,
  which must not exceed the rubric's total — enforced at entry, not just
  at review.

## 3. Marks Entry

- Marks are entered by the Subject Teacher who set the assessment (or any
  staff member in `staff_subjects` for that subject/class, covering
  co-teaching), one row per student per Assessment.
- **Missing marks:** a student with no attendance record excused for that
  assessment (cross-referencing Module 6) and no mark entered is flagged
  `mark-missing`, not defaulted to zero — zero is a scored outcome
  (student sat it and scored nothing), missing is an unscored gap, and
  the two must remain distinguishable through moderation and reporting.
- **Edge case — student on disciplinary suspension during exam window:**
  this is the conflict Module 6 flags without resolving. Module 7's
  policy: a suspended student is marked `did-not-sit` (distinct from both
  a zero and a missing mark) unless the Principal explicitly authorizes
  the student to sit despite suspension — recorded as an override, not a
  silent default.

## 4. Moderation

- Before marks leave a department, the relevant Head of Department
  reviews and moderates them (per Module 1's HoD approval authority,
  exercised concretely here) — moderation is a status transition
  (`entered` → `moderated`) on the Assessment as a whole, not per student.
- **Moderation freeze:** once moderated, the Examinations Officer's
  logistics role (Module 1) explicitly cannot alter marks (matching
  Module 1's role definition verbatim) — any post-moderation correction
  requires reopening the Assessment (Section 6), not a direct edit.
- **Cross-department moderation is out of scope** — each department
  moderates only its own subjects' assessments, consistent with Module 1's
  "no cross-department write access" for HoDs.

## 5. Publishing & Results

- Once moderated, an Assessment's results move to `published` — visible to
  the student and their guardians (per Module 1's Student/Parent role
  definitions), never before.
- **Grading:** raw marks are converted to CBC performance levels (e.g.
  Exceeding/Meeting/Approaching/Below Expectation) via a grading scale
  that is a **Curriculum Policy** concern (Module 2's frozen framework
  already anticipates school-specific/year-specific configurability) —
  this module reads the active grading scale, it does not define a new,
  separate configuration mechanism.
- **Ranking:** class or grade-level ranking is computed from published,
  weighted subject scores — a reporting-style computation, but produced
  here since it's a direct function of this module's own data; broader
  cross-term/cross-year trend analysis is Module 11's concern.
- **Performance trends** (student-over-time, class-over-time) are
  explicitly **not** built here — Module 7 is the system of record for
  individual results; trend analysis and any inference on top of results
  is Module 11 (Reporting & Analytics) or Module 12 (Learning
  Intelligence), which will query this module's published results rather
  than this module computing trends itself.

## 6. Corrections & Reopening

- A published or moderated Assessment can be **reopened** by the HoD
  (with Principal approval if already published, since publishing exposes
  the result externally) — reopening creates a new moderation cycle; the
  prior mark and moderation state are retained as history, not overwritten,
  matching the append-only pattern used since Module 3.
- **Exam corrections** (e.g. a marking error discovered after results are
  out) follow the same reopen-and-remoderate path — there is no separate
  "quick fix" mechanism that bypasses moderation, since that would
  reintroduce the exact risk moderation exists to catch.

## 7. Graduation Trigger

- Resolves Module 3's explicit deferral: "the academic decision of whether
  a student meets completion requirements belongs to the Assessment
  module."
- At Grade 12, Term 3 completion, once all required subjects' final marks
  are `published` for a student, this module evaluates completion against
  the active Curriculum Policy's mandatory-subject list (Module 2) and, if
  met, fires the `Graduated` transition on the Module 3 student record —
  Module 7 triggers it, Module 3 still owns the actual status field and
  timeline entry (no duplication of that ownership).
- **Edge case — incomplete requirements at Grade 12 exit:** if a student
  hasn't met requirements, no automatic transition fires; the case is
  flagged for Dean of Studies/DP Academics review (supplementary exam,
  conditional pass, or repeat) rather than the system silently blocking or
  silently passing the student.

---

## 8. Module Boundaries

**In scope:** Assessment types (Assignment/CAT/Project/Practical/Exam),
rubrics, marks entry, moderation workflow, publishing, CBC grading-scale
application (reading Module 2's policy, not redefining it), ranking
computed from this module's own results, corrections/reopening, the
Graduation completion check and trigger.

**Explicitly out of scope:** Exam room/invigilator scheduling (Module 5 —
this module only produces the assessment content and marks, not the
logistics), attendance during assessments beyond the excused/did-not-sit
distinction (Module 6), cross-term/cross-year performance trend analysis
(Module 11), any AI-assisted marking, prediction, or personalization
(Module 12), Finance (exam fees, if any, are Module 8's concern).

**Data ownership:** Module 7 owns `assessments`, `rubrics`,
`rubric_scores`, `marks`, `moderation_records`, `grading_scales` (or
reads them if modeled as part of Module 2's `curriculum_policies` — an
implementation-time choice), `assessment_reopenings`. It references
(never redefines) Module 2's subjects/terms/curriculum policy, Module 3's
students (and triggers, but does not own, the Graduated status), Module 4's
staff/staff_subjects, Module 5's exam sessions, and Module 6's attendance/
suspension records.

---

## Module 7 Freeze Record

**Checkpoint 1 — Business rules complete:** Assessment types, rubrics,
marks entry, moderation, publishing/grading/ranking, corrections, and the
graduation trigger are each fully specified (Sections 1–7).

**Checkpoint 2 — Ownership clear:** Section 8 states what Module 7 owns
vs. references; the Graduation trigger explicitly respects Module 3's
ownership of the status field while resolving the deferral Module 3 left
open, without unfreezing it.

**Checkpoint 3 — Edge cases documented:** Missing vs. zero vs. did-not-sit
marks, suspension/exam-window conflict resolution, and incomplete
graduation requirements are each resolved with a concrete mechanism
(Sections 3, 7).

**Checkpoint 4 — Module boundaries respected:** No timetable logistics,
finance, or intelligence/trend-analysis logic appears in this document;
each is named and deferred to its owning module.

**Result: Module 7 Frozen.**
Architecture Approved · Business Scope Approved · Assessment Domain
Approved · Ready for Freeze · **Module Frozen.**

Proceeding to Module 8 — Finance.
