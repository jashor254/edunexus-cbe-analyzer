# Reference School — Module 5: Timetables

Status: **FROZEN**. Architecture Approved · Business Scope Approved ·
Timetable Domain Approved. No structural changes except bug fixes or
explicitly approved architectural revisions. Future modules must treat
this document as a stable dependency.

Depends on: [[01-school-profile-and-structure]] (frozen), [[02-academic-structure]]
(frozen — period grid, weekly period allocation, classes, subjects,
double-period flag), [[03-students]] (frozen — referenced only),
[[04-teachers-and-staff]] (frozen — `staff_subjects`/`staff_classes`,
referenced only).

## Purpose

Module 5 is where the abstract structure defined in Module 2 (period grid,
weekly period allocations) and Module 4 (which staff teach which subjects
to which classes) becomes a concrete, conflict-free weekly schedule. It
owns the timetable **slot** — day, period, class, subject, teacher, room —
and the machinery for detecting and resolving conflicts. It does not own
attendance (whether someone showed up to the slot), assessment, or any
scheduling for events already defined elsewhere (assembly/games reserved
slots came from Module 2; this module places them on the grid without
redefining what they are).

---

## 1. Timetable Scope

- A **Timetable** is scoped to one Academic Year + Term (Module 2) — a new
  timetable is generated/versioned at the start of each term rather than
  assumed to run unchanged all year, since subject allocation and staff
  assignment can shift between terms.
- A Timetable is composed of **Timetable Slots**: one row per (day, period,
  class) — since a Class can only be in one place at one time, `(day,
  period, class_id)` is a natural uniqueness constraint.
- Each slot references: `subject_id` (Module 2), `staff_id` (Module 4),
  `room_id` (Section 3), and whether it's a single or double period
  (matching the subject's `requires_double_period` flag from Module 2 — a
  double period occupies two consecutive slots, linked as a pair, not
  duplicated as independent rows).

## 2. Non-Subject Slots

- Reserved slots defined structurally in Module 2 (assembly, games, clubs,
  breaks, lunch) are placed onto the grid as **non-subject slots** —
  `subject_id: null`, with a `slot_type` (`assembly`, `games`, `lunch`,
  `break`, `club`) instead.
- These slots are generated once per Timetable from Module 2's period-grid
  definition and are not independently re-authored per class — all classes
  share the same assembly/lunch timing by default, though a `class_id`
  override exists for the rare case a stream's games slot differs (e.g.
  boarders vs. day scholars have staggered lunch).

## 3. Rooms

- A **Room** is a physical teaching space: classroom, laboratory (Physics/
  Chemistry lab, Biology lab — per Module 1's facilities list), computer
  lab, or the assembly hall.
- Each Room has a `capacity` and a `room_type` (`classroom`, `lab`,
  `computer_lab`, `hall`) — practical subjects (Module 2's
  `practical: true` flag) can only be scheduled into a `room_type: lab` or
  `computer_lab` room matching the subject (Physics/Chemistry/Biology
  share the two science labs per Module 1; Computer Studies requires the
  computer lab).
- **Home room convention:** most non-practical classes are scheduled in
  their own assigned home classroom by default (reducing unnecessary room
  changes), with practical subjects and any explicit exception moving to a
  specialized room.

## 4. Conflict Detection

Three conflict classes the system must detect (not silently allow) when a
slot is created or edited:

1. **Class conflict** — the same Class already has a slot at that
   (day, period) — the natural-key uniqueness from Section 1 makes this a
   hard constraint, not just a check.
2. **Staff conflict** — the same staff member is already assigned to a
   different Class at that (day, period). Hard constraint — a teacher
   cannot teach two classes simultaneously.
3. **Room conflict** — the same Room is already booked for a different
   Class at that (day, period). Hard constraint for labs/hall (single
   physical space); home classrooms are exempt from this check by
   convention (Section 3) since each class already "owns" its home room
   for non-practical periods.

- **Substitution is not a conflict-detection exception** — see Section 5;
  a substitute teacher fills an existing slot temporarily rather than
  creating a second conflicting assignment.

## 5. Teacher Substitutions

- A **Substitution** record references an existing Timetable Slot plus a
  substitute `staff_id`, a date (substitutions are per-occurrence, not a
  timetable-wide reassignment — the underlying slot's regular teacher is
  unchanged for future weeks), and a reason (`leave`, `training`,
  `emergency`).
- The substitute must still pass the Staff Conflict check (Section 4) for
  that specific date/period — a substitution doesn't bypass conflict
  detection, it just doesn't require altering the base timetable.
- **Edge case — no available substitute:** the system represents an
  unfilled slot as a flagged gap (`substitution_needed`, no `staff_id`
  assigned) rather than blocking the leave/absence from being recorded
  elsewhere (Module 4's `staff_leave`) — staffing gaps are a visibility
  problem for the Examinations Officer/Dean of Studies to solve, not
  something this module auto-resolves.

## 6. Exam Timetabling

- Exam scheduling (per Module 2's per-term exam window) reuses the same
  Timetable Slot machinery but with `slot_type: exam` and typically wider
  time blocks than a normal period (an exam slot can span multiple
  contiguous periods, modeled as one slot with a duration rather than
  forcing it into the standard period grid).
- Exam slots additionally require **invigilator assignment**, which is
  conceptually a `staff_id` on the slot, but distinct from the *teaching*
  staff conflict check (Section 4) — a teacher can invigilate an exam for
  a subject they don't teach, so invigilator assignment does not check
  against `staff_subjects` (Module 4), only against the same Staff Conflict
  (double-booking) rule.
- Full exam workflow ownership (question papers, moderation, results) is
  Module 7's — this module only places exam sessions on the calendar/room
  grid and assigns invigilators.

## 7. Timetable Publishing & Versioning

- A Timetable starts in `draft` status while being built, then moves to
  `published` — once published, students/staff/parents can view it (a
  future Communication/UI concern, not modeled here).
- **Edge case — mid-term timetable change:** a published timetable can
  still be edited (a room becomes unavailable, a new teacher joins), but
  each edit is timestamped and the prior slot state is retained (not
  overwritten) — same append-only philosophy as Module 3's timeline and
  Module 4's assignment history, applied to timetable slots.
- **Edge case — timetable regeneration:** if a school regenerates the
  whole timetable from scratch mid-term (rare, but happens after a major
  staffing change), the old Timetable version is marked `superseded`
  rather than deleted, and a new Timetable row (still scoped to the same
  Academic Year + Term) becomes the active one — this is why Timetable
  itself is a versioned entity, not assumed to be exactly one row per term.

---

## 8. Module Boundaries

**In scope:** Timetable (versioned, per year+term), Timetable Slots
(subject and non-subject), Rooms, conflict detection (class/staff/room),
substitutions, exam session placement + invigilator assignment,
publishing/versioning.

**Explicitly out of scope:** Attendance (whether a student/teacher actually
showed up to a slot — Module 6), Assessment content/marks/moderation
(Module 7 — this module only reserves the exam's time and room), Room
inventory/maintenance beyond the scheduling need (a future Facilities
concern, not named in the 12-module roadmap — flagged as a gap, not
invented here), Finance, Reporting, Career/Learning Intelligence.

**Data ownership:** Module 5 owns `timetables`, `timetable_slots`, `rooms`,
`substitutions`, `exam_sessions` (if exam scheduling is modeled as a
distinct table rather than a `slot_type` on `timetable_slots` — an
implementation-time choice, not architectural). It references (never
redefines) Module 2's `classes`/`subjects`/`academic_years`/`terms`/period
grid, and Module 4's `staff`/`staff_subjects`.

---

## Resolved Decisions

1. **Room inventory ownership:** Rooms have no dedicated module in the
   12-module roadmap, and Timetable is the first module that needs them as
   real data, so basic Room identity/capacity/type is defined here
   (Section 3) — the smallest correct slice, not a full Facilities module.
   If lab equipment/inventory tracking is needed later, it extends this
   `rooms` table rather than requiring a new module.
2. **Exam session modeling:** exams are modeled as a `slot_type` on
   `timetable_slots` rather than a separate table — they reuse the same
   conflict-detection machinery (Section 4) and only need the added
   duration/invigilator semantics noted in Section 6, which don't justify
   a parallel structure.

---

## Module 5 Freeze Record

**Checkpoint 1 — Business rules complete:** Timetable versioning, slot
structure, room typing, conflict detection, substitution, and exam
placement are each fully specified (Sections 1–7).

**Checkpoint 2 — Ownership clear:** Section 8 states what Module 5 owns
vs. references — draws on Module 2's period grid/subjects/classes and
Module 4's staff/staff_subjects without redefining either.

**Checkpoint 3 — Edge cases documented:** No available substitute,
mid-term timetable change, and full timetable regeneration are each
resolved with a concrete mechanism (Sections 5, 7).

**Checkpoint 4 — Module boundaries respected:** No attendance, assessment
content/marks, finance, or intelligence logic appears in this document;
each is explicitly named and deferred to its owning module (Section 8).

**Result: Module 5 Frozen.**
Architecture Approved · Business Scope Approved · Timetable Domain
Approved · Ready for Freeze · **Module Frozen.**

Proceeding to Module 6 — Attendance.
