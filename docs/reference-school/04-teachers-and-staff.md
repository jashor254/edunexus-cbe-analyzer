# Reference School — Module 4: Teachers & Staff

Status: **FROZEN**. Architecture Approved · Business Scope Approved ·
Staff Domain Approved. No structural changes except bug fixes or
explicitly approved architectural revisions. Future modules must treat
this document as a stable dependency.

Depends on: [[01-school-profile-and-structure]] (frozen — roles,
departments as org concepts), [[02-academic-structure]] (frozen —
`departments` as real schema, subjects, grade levels), [[03-students]]
(frozen — student identity, referenced only, never redefined).

## Purpose

Module 4 defines the complete Teacher & Staff domain: employment identity,
department/subject attachment, teaching load, class-teacher assignment,
and professional records. It resolves the two ownership deferrals Modules
1–2 explicitly left open: **Head of Department assignment** and **teacher
attachment to Department**. It owns no timetable slot data, no attendance,
no assessment marks, and no discipline — those are later modules that will
reference Teacher/Staff the same way they reference Student.

---

## 1. Staff Identity

| Field | Notes |
|---|---|
| `id` | Internal UUID, immutable. |
| `employee_number` | School-issued, unique, immutable once assigned — never recycled, same convention as `students.admission_number`. |
| `tsc_number` | TSC (Teachers Service Commission) number — required for TSC-employed teaching staff, null for BoM-employed or non-teaching support staff. |
| `full_name` | Legal name. |
| `gender` | As per TSC/MoE reporting categories. |
| `date_of_birth` | Required. |
| `national_id_number` | Required for all adult staff (unlike students, this is not optional). |
| `photo` | Optional, added during onboarding. |
| `role_id` | FK to the role catalogue defined in Module 1 (Principal, DP Academics, HoD, Subject Teacher, etc.) — Module 1 defined the catalogue conceptually; this module is what attaches a real staff record to a real role. |
| `department_id` | FK to Module 2's `departments`, nullable — only staff whose role is department-scoped (HoD, Subject Teacher, Lab Technician) have one; Principal/DPs/admin roles do not. |
| `employment_status` | `active`, `on_leave`, `suspended` (administrative — same distinction as Module 3's student status), `resigned`, `retired`, `deceased`, `terminated`. |
| `employment_type` | `TSC` (government-employed), `BoM` (Board of Management-employed), `contract`, `part_time`. |
| `date_employed` | Date this staff member started at this school (not their total teaching career start — see Experience, Section 5). |

**Note on class-teacher role:** `is_class_teacher: boolean` plus
`class_teacher_of_class_id` (FK to Module 2's `classes`) live on the staff
record, not as a separate role — Module 1 modeled Class Teacher as a
role a Subject Teacher is "dual-hatted" with, and this module preserves
that: a Subject Teacher becomes a Class Teacher by gaining this
assignment, not by changing `role_id`.

## 2. Head of Department Assignment

Resolves Module 2's explicit deferral ("Module 4 assigns teachers and a
Head of Department to a Department").

- Exactly one staff member holds `is_head_of_department: true` per active
  Department at a time — enforced, matching Module 1's "each academic
  department is led by one HoD."
- HoD assignment is a **timestamped appointment**, not an overwrite: when
  a new HoD is appointed, the previous appointment is closed (end date
  set) rather than deleted, so departmental leadership history survives
  turnover — mirrors Module 3's timeline philosophy applied to staff.
- **Edge case — HoD vacancy:** a Department may temporarily have no active
  HoD (e.g. between appointments); the system represents this as "no
  current HoD" rather than forcing an assignment, with escalating
  approvals in the meantime falling to Dean of Studies (per Module 1's org
  chart, HoDs report to DP Academics via no intermediate — so a vacancy
  routes up, not sideways).

## 3. Subject & Class Attachment

- `staff_subjects`: many-to-many join between a staff member and the
  Subjects (Module 2) they are qualified/assigned to teach — this is
  qualification/assignment, not the timetable slot (Module 5 decides when
  and where they actually teach it).
- `staff_classes`: which Classes (Module 2: Grade + Stream + Academic Year)
  a staff member teaches at least one subject to — derived data in
  principle, but stored explicitly to support fast lookups (e.g. "who
  teaches Grade 10 East") without requiring a join through subjects/
  timetable every time.
- **Teaching load** is a computed/reported value (total weekly periods
  across all `staff_subjects` × classes taught), not a field this module
  hand-maintains — it becomes meaningful once Module 2's weekly period
  allocations and Module 5's timetable exist; this module only stores the
  raw assignments the computation will read.
- **Edge case — subject reassignment mid-term:** if a teacher leaves or is
  reassigned mid-term, the prior `staff_subjects`/`staff_classes` rows are
  closed (end date), not deleted, so mark-entry history in the future
  Assessment module can still be attributed to whoever actually taught at
  the time.

## 4. Employment Records

- **Contract details:** employment type (Section 1), contract start/end
  date (nullable end date for permanent TSC staff), job title.
- **Leave history:** `staff_leave` records — type (sick, maternity/
  paternity, study, compassionate, annual), start/end date, approval
  status, approver. This is *administrative* leave tracking, distinct from
  a future Attendance module's day-to-day staff attendance (Module 6),
  the same boundary Module 3 drew between administrative Suspended status
  and disciplinary suspension.
- **Documents:** TSC certificate, academic certificates, ID copy,
  employment contract, professional body registration (where applicable)
  — reusing the same versioned/verified/audit-trailed document model
  Module 3 defined for students, applied here to staff.

## 5. Qualifications, Experience, and Professional Development

- **Qualifications:** degree(s), teaching subjects trained in, institution,
  year obtained — a list, since staff commonly hold multiple.
- **Experience:** total years of teaching experience (career-wide, not
  just at this school — distinct from `date_employed` in Section 1, which
  is school-specific tenure).
- **Professional development:** a log of trainings/workshops attended,
  each with date, provider, and topic — administrative record only, no
  competency scoring or intelligence layered on top (that would be a
  future Teacher Intelligence concern, explicitly deferred per Module 1's
  "Future integration notes" on the Subject Teacher role).
- **Performance records:** administrative record of formal appraisals
  (date, appraiser, outcome) — not lesson-level quality data, which
  belongs to Dean of Studies' classroom-observation workflow once that's
  specified in a later module; this module only stores the *record that
  an appraisal happened*, not its instrument.

## 6. Timetable (placeholder only)

Module 4 does **not** define the timetable. It stores the inputs Module 5
needs (`staff_subjects`, `staff_classes`, teaching load) but the actual
grid — which period, which room, which day — belongs entirely to Module 5.
Flagged explicitly so the boundary isn't blurred by the temptation to
sketch a timetable field here.

---

## 7. Edge Cases

- **Teacher resignation:** `employment_status` → `resigned`, with an exit
  date. Existing `staff_subjects`/`staff_classes` assignments are closed
  (Section 3), not deleted — historical attribution (who taught this class
  in Term 2) survives the departure.
- **Teacher replacement:** the outgoing teacher's assignments close; the
  incoming teacher's assignments open with their own start date — there is
  a natural gap-or-overlap window (a few days of handover) which the model
  permits since assignments are date-ranged, not exclusive-in-time by
  constraint.
- **Mid-year HoD change:** covered in Section 2 (timestamped appointment,
  not overwrite).
- **Teacher teaching outside their department:** permitted — e.g. a
  Mathematics HoD occasionally covering a Computer Studies class in the
  Applied Sciences department. `staff_subjects` is not constrained to only
  subjects within the staff member's own `department_id`; `department_id`
  is "which department this person belongs to," not "which subjects they
  may teach."
- **Staff on long leave mid-term:** `employment_status` stays `active`
  (they remain employed) while a concurrent `staff_leave` record covers
  the period — a substitute's assignment is a separate, temporary
  `staff_classes`/`staff_subjects` entry with its own date range, not a
  status change on the original teacher.
- **Dual-role staff:** e.g. a Subject Teacher who is also the Career
  Coordinator — supported by allowing a staff member to hold a primary
  `role_id` plus additional non-exclusive role flags (mirroring how
  Class Teacher is modeled in Section 1) rather than assuming one role per
  person.
- **Non-teaching staff with no department:** Finance Officer, ICT
  Administrator, School Secretary, etc. have `department_id: null` and no
  `staff_subjects`/`staff_classes` rows at all — the schema must not force
  these to be populated for non-academic roles.

---

## 8. Module Boundaries

**In scope:** Staff identity, employment status/type, role attachment
(referencing Module 1's role catalogue), department attachment and HoD
assignment (resolving Module 2's deferral), subject/class assignment
(qualification and roster, not timetable), employment records (contract,
leave, documents), qualifications/experience/professional development,
appraisal record-keeping (record only, not instrument).

**Explicitly out of scope:** Timetable slot generation (Module 5), staff
day-to-day attendance (Module 6), student assessment/marking logic
(Module 7 — this module only establishes *who is eligible* to teach/mark
a subject), disciplinary action against staff (not yet scoped to any
module — flagged as a gap for a future HR/Discipline module rather than
force-fit here), payroll (Finance, Module 8, will reference
`employment_type`/`tsc_number` but this module does not compute pay),
Teacher Intelligence / classroom-quality AI (deferred to Module 12).

**Data ownership:** Module 4 owns `staff`, `staff_status_history`,
`staff_department_assignments` (including HoD appointment history),
`staff_subjects`, `staff_classes`, `staff_leave`, `staff_documents`,
`staff_qualifications`, `staff_professional_development`,
`staff_appraisals`. It references (never redefines) Module 1's role
catalogue, Module 2's `departments`/`subjects`/`classes`, and does not
touch `students` at all — the Student↔Teacher relationship only becomes
concrete once a Timetable or Assessment module needs it.

---

## Resolved Decisions

1. **Staff disciplinary action:** not covered by any frozen module and not
   on the 12-module roadmap. Left explicitly **out of scope** for the
   Reference School rather than invented a home for it — consistent with
   building the smallest correct slice first. If a real need arises later,
   it gets its own proposal against a specific gap, not a guess now.
2. **Support staff granularity:** kept generic — all support staff use the
   same `staff` shape with `department_id: null` (Section 1). Module 1
   already classified these roles as "likely out of scope for most future
   intelligence layers," so no category-specific fields (driver's license,
   food-handling certificate, etc.) are added unless a concrete workflow
   needs them.

---

## Module 4 Freeze Record

**Checkpoint 1 — Business rules complete:** Staff identity, employment
status/type, HoD assignment, subject/class attachment, and professional
records are each fully specified with concrete fields (Sections 1–5).

**Checkpoint 2 — Ownership clear:** Section 8 states what Module 4 owns
vs. references — resolves Module 2's HoD/department-assignment deferral,
introduces no new dependency on Modules 1–3 beyond referencing their
already-frozen entities.

**Checkpoint 3 — Edge cases documented:** Resignation, replacement,
mid-year HoD change, cross-department teaching, long leave/substitution,
dual-role staff, and non-teaching staff are all resolved with a concrete
mechanism (Section 7).

**Checkpoint 4 — Module boundaries respected:** No timetable slot,
attendance, assessment, payroll computation, or Teacher Intelligence logic
appears in this document; each is explicitly named and deferred to its
owning module (Section 8).

**Result: Module 4 Frozen.**
Architecture Approved · Business Scope Approved · Staff Domain Approved ·
Ready for Freeze · **Module Frozen.**

Proceeding to Module 5 — Timetables.
