# Reference School — Module 6: Attendance & Discipline

Status: **FROZEN**. Architecture Approved · Business Scope Approved ·
Attendance & Discipline Domain Approved. No structural changes except bug
fixes or explicitly approved architectural revisions. Future modules must
treat this document as a stable dependency.

Depends on: [[01-school-profile-and-structure]] (frozen — Guidance &
Counselling role, Class Teacher role), [[02-academic-structure]] (frozen —
academic calendar, terms, period grid), [[03-students]] (frozen —
explicitly defers disciplinary suspension here, distinct from
administrative `Suspended` status), [[04-teachers-and-staff]] (frozen —
staff identity, referenced for staff attendance and discipline actors),
[[05-timetables]] (frozen — timetable slots, referenced for lesson-level
attendance).

Note on scope: the original 12-module roadmap named this module
"Attendance." Module 3 (frozen) already commits student disciplinary
suspension to "Module 6 (Attendance/Discipline)" as a record type distinct
from Module 3's administrative `Suspended` status. Since Module 3 cannot
be unfrozen, this module honors that commitment and covers **both**
Attendance and Discipline rather than leaving discipline an orphaned
reference with no owning module.

## Purpose

Module 6 owns whether people were actually present (students, and
separately, staff) against the schedule Module 5 defines, and it owns the
record of behavioural/disciplinary incidents and their outcomes. It does
not own assessment, grading, or any AI-driven pattern detection over this
data — that's Learning Intelligence (Module 12) and, for staff, a future
HR-flavored concern explicitly left unscoped by Module 4.

---

## 1. Student Daily Attendance

- One record per student per school day: `present`, `absent`, `late`,
  `excused`. Taken by the Class Teacher (per Module 1's role definition)
  at the start of the day against the academic calendar (Module 2) — a
  non-school day (holiday, mid-term break) has no attendance record at
  all, not a record marked "n/a."
- **Late arrivals** capture an arrival time; still counts toward the day's
  attendance but is distinguishable from on-time presence for reporting.
- **Excused absence** requires a reason and, optionally, a linked document
  (reusing Module 3's document model — e.g. a medical note) or a linked
  Guardian permission request (Section 5).

## 2. Lesson-Level Attendance

- One record per student per Timetable Slot (Module 5) — finer-grained
  than daily attendance, taken by the Subject Teacher for their period.
- **Relationship to daily attendance:** independent, not derived — a
  student marked present for the day can still be absent from one lesson
  (stepped out, skipped a class), and this module does not auto-reconcile
  the two into a single number; any such rollup is a reporting concern
  (Module 11), not an attendance-recording concern.
- Lesson-level attendance is only recorded for standard subject slots —
  non-subject slots (assembly, games, lunch) from Module 5 are out of
  scope for per-student lesson attendance.

## 3. Staff Attendance

- One record per staff member per school day: `present`, `absent`, `late`,
  `on_leave` (cross-referencing Module 4's `staff_leave` when applicable,
  rather than duplicating leave data — a staff day marked `on_leave` here
  should point at the corresponding `staff_leave` record).
- Distinct from Module 4's employment-level leave tracking: `staff_leave`
  is the *administrative approval* that leave is happening; this module's
  daily record is the *operational fact* of who showed up, which the ICT/
  Administration side needs for substitution triggering (Module 5).

## 4. Attendance Summaries

- Per-student, per-term attendance percentage — computed from Section 1's
  daily records, not separately entered.
- Automatic threshold flagging (e.g. attendance drops below a configurable
  percentage) surfaces as a `student_flag` (Module 3's flag mechanism,
  reused rather than reinvented) — this module produces the signal, not a
  new alerting system.
- **Edge case — repeat late arrivals:** the system counts and surfaces
  lateness frequency (not just today's lateness) as part of the same
  summary, since persistent lateness is itself the discipline-relevant
  pattern schools track.

## 5. Guardian-Initiated Permission Requests

- A **Permission Request** (early dismissal, planned absence, medical
  appointment) is submitted referencing a student and reviewed by the
  Class Teacher (per Module 1's "approves minor leave requests" authority)
  or escalated to Guidance & Counselling / DP Administration for
  exceptional cases.
- Approved requests automatically produce an `excused` attendance record
  for the relevant day/slot (Section 1/2) rather than requiring duplicate
  manual entry.

---

## 6. Discipline: Incidents

- A **Discipline Incident** references: the student, the reporting staff
  member, date/time, category (e.g. `uniform`, `conduct`, `academic-
  integrity`, `attendance-related`, `safety`), severity (`minor`,
  `moderate`, `major`), and a description.
- Incidents are logged by any staff member but reviewed/actioned by the
  Class Teacher (first line, per Module 1) with escalation to Guidance &
  Counselling for repeated or severe incidents, and to the Principal for
  the most severe (matching Module 1's approval-authority chain exactly —
  this module does not invent a new escalation path).
- **House points:** minor incidents may result in a house-points deduction
  (referencing Module 1's `school_houses`, made real in Module 3) — this
  is the mechanism by which the House system (introduced structurally in
  Module 1, given schema in Module 3) becomes operationally meaningful.

## 7. Discipline: Outcomes

- **Outcomes** include: verbal warning, written warning, parent meeting
  (references a Guardian from Module 3), community service, **disciplinary
  suspension**, expulsion recommendation (Principal + Board of Management
  decision — BoM involvement is recorded but BoM itself remains outside
  system permissions per Module 1's governance notes).
- **Disciplinary suspension** is modeled as its own record here — start
  date, end date, reason, approving staff member — and is explicitly
  **not** a value of Module 3's `current_status` field. While a
  disciplinary suspension is active, this module's record is the source
  of truth; Module 3's student record is unaffected (no status mutation),
  preserving the boundary Module 3 already committed to.
- **Counselling case notes** (Guidance & Counselling's sensitive record
  type, flagged in Module 1 as needing the strictest access control) live
  here, access-restricted to Guidance & Counselling, Dean of Studies, and
  Principal only — matching Module 1's reporting-line decision that
  Guidance sits under Dean of Studies.

## 8. Edge Cases

- **Attendance correction:** if a Class Teacher mis-marks a student
  absent who was actually present, the correction is a new timestamped
  entry referencing and superseding the erroneous one — never a silent
  overwrite, consistent with the append-only philosophy used throughout
  Modules 3–5.
- **Student on disciplinary suspension during exam window:** this module
  flags the conflict (suspension dates overlapping Module 2's exam
  window) for Examinations Officer/DP Academics attention; resolving it
  (whether the student sits the exam) is a Module 7 (Assessment) policy
  decision, not something this module decides unilaterally.
- **Incident involving multiple students:** one Incident record per
  involved student, optionally cross-referenced via a shared
  `incident_group_id` so they're visibly linked without merging into a
  single ambiguous record.
- **False/withdrawn incident report:** an incident can be marked
  `retracted` with a reason — retained in the record (never deleted) but
  excluded from house-points/summary calculations once retracted.
- **Staff attendance vs. substitution:** a staff member marked `absent`
  for the day should be cross-checked against Module 5's substitution
  records — an unfilled Timetable Slot for that staff member surfaces the
  same `substitution_needed` flag Module 5 already defines, rather than
  this module inventing a second gap-tracking mechanism.

---

## 9. Module Boundaries

**In scope:** Student daily and lesson-level attendance, staff daily
attendance, attendance summaries/threshold flagging, guardian permission
requests, discipline incidents, discipline outcomes (including
disciplinary suspension, kept distinct from Module 3's administrative
status), house points, counselling case notes (record-keeping only).

**Explicitly out of scope:** Assessment/marks (Module 7), payroll
implications of staff attendance (Finance, Module 8), pattern detection or
predictive flagging beyond simple threshold rules (Learning Intelligence,
Module 12), staff disciplinary action (still an unscoped gap per Module
4's freeze record — not addressed here either, since this module's
discipline scope was explicitly inherited from Module 3 and covers
students only).

**Data ownership:** Module 6 owns `student_daily_attendance`,
`lesson_attendance`, `staff_daily_attendance`, `permission_requests`,
`discipline_incidents`, `discipline_outcomes`, `house_points`,
`counselling_case_notes`. It references (never redefines) Module 3's
students/guardians/flags/houses, Module 4's staff/staff_leave, and Module
5's timetable_slots/substitutions.

---

## Module 6 Freeze Record

**Checkpoint 1 — Business rules complete:** Attendance (daily, lesson,
staff), summaries, permission requests, discipline incidents, and
outcomes are each fully specified (Sections 1–7).

**Checkpoint 2 — Ownership clear:** Section 9 states what Module 6 owns
vs. references; disciplinary suspension is explicitly kept out of Module
3's status field, resolving the deferral Module 3 committed to without
unfreezing it.

**Checkpoint 3 — Edge cases documented:** Attendance correction,
suspension/exam-window conflict, multi-student incidents, retracted
incidents, and staff-absence/substitution cross-check are each resolved
with a concrete mechanism (Section 8).

**Checkpoint 4 — Module boundaries respected:** No assessment, finance, or
intelligence/pattern-detection logic appears in this document; each is
named and deferred to its owning module. Staff discipline remains an
explicitly acknowledged gap, not silently absorbed here.

**Result: Module 6 Frozen.**
Architecture Approved · Business Scope Approved · Attendance & Discipline
Domain Approved · Ready for Freeze · **Module Frozen.**

Proceeding to Module 7 — Assessment.
