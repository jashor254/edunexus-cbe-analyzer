# Reference School — Module 3: Students

Status: **FROZEN**. Architecture Approved · Business Scope Approved ·
Student Domain Approved. No structural changes except bug fixes or
explicitly approved architectural revisions. Future modules must treat
this document as a stable dependency.

Depends on: [[01-school-profile-and-structure]] (frozen — roles, houses),
[[02-academic-structure]] (frozen — grade levels, classes, streams,
pathways, academic years/terms).

## Purpose

Module 3 defines the complete Student domain: identity, lifecycle,
admission, guardianship, medical/administrative records, residence,
documents, and the permanent timeline that ties them together. The
Student record is the **single source of truth** every later module
references — no later module may redefine student identity. This module
owns no learning, assessment, attendance, behaviour, career, finance, or
intelligence data; it owns the person and their administrative record.

---

## 1. Student Identity

Core fields:

| Field | Notes |
|---|---|
| `id` | Internal UUID, immutable, never reused even if a record is archived. |
| `admission_number` | School-issued, unique, human-facing identifier. Immutable once assigned — never recycled, even after withdrawal, to keep historical references (report cards, certificates) unambiguous. |
| `full_name` | Legal name as per birth certificate/national ID. |
| `preferred_name` | Optional, used in day-to-day interactions (register, reports UI) without overwriting the legal name. |
| `gender` | As per KNEC/MoE reporting categories. |
| `date_of_birth` | Required. |
| `nationality` | Defaults to Kenyan; not hardcoded, since transfer/international students exist. |
| `birth_certificate_number` | Optional at admission (see Edge Cases — missing documents), captured when available. |
| `national_id_number` | Optional — only applicable to students who reach 18 while enrolled (common in Grade 12). |
| `photo` | Reference to a stored image; not required at admission, added during registration. |
| `current_status` | See Student Status below — always reflects the live state. |
| `date_admitted` | The date the *admission* was finalized (distinct from date of first attendance, which can lag for late admissions). |
| `expected_graduation_year` | Derived from current grade + academic calendar, but stored explicitly so it survives a repeat/hold-back without recalculation ambiguity. |
| `current_grade_level_id` | FK to Module 2's `grade_levels`. |
| `current_class_id` | FK to Module 2's `classes` (Grade + Stream for the active Academic Year). |
| `current_academic_year_id` | FK to Module 2's `academic_years`. |
| `current_pathway_id` | FK to Module 2's `pathways` — this is the concrete implementation of the "pathway belongs to the student, not the stream" decision frozen in Module 2. |

**Note on `current_term`:** not stored as a student field — term is
calendar state (Module 2 owns "what term is it right now"), not a property
of the student. A student's *term-scoped* records (marks, attendance) will
carry their own term FK when those modules are built.

## 2. Student Status

State machine — every transition is an event, never an in-place overwrite
(see Section 8, Student Timeline):

```
Applicant → Admitted → Active ⇄ Suspended (administrative)
                          │
                          ├─→ Transferred (out)
                          ├─→ Withdrawn
                          ├─→ Inactive (temporary leave)
                          └─→ Graduated → Alumni
                                             │
                                             └─→ Archived
```

- **Applicant** — pre-admission, no admission number yet assigned.
- **Admitted** — admission decision made, not yet registered/active.
- **Active** — currently enrolled and attending.
- **Suspended (administrative)** — explicitly **administrative only** (e.g.
  fee-related, pending document resolution) — this is *not* the
  disciplinary suspension role Module 1 assigned to Guidance & Counselling;
  behavioural/disciplinary suspension is out of scope here and belongs to
  the Attendance/Discipline module (Module 6). A student record must be
  able to distinguish the two without conflating them — disciplinary
  suspension will be modeled as its own record type in Module 6 that
  *references* the student, not as a value of this module's status field.
- **Transferred** — left for another school; record preserved, status
  frozen at the point of transfer.
- **Withdrawn** — left the school for a non-transfer reason (relocation,
  discontinuation).
- **Inactive** — temporary leave with an expected or possible return
  (medical, family emergency); distinct from Withdrawn because re-admission
  from Inactive is a lighter-weight event than a fresh application.
- **Graduated** — completed Grade 12 successfully.
- **Alumni** — post-graduation state; retains read access to their own
  historical record (per Module 1's Student role, scoped appropriately).
- **Archived** — long-inactive record moved to cold storage *conceptually*,
  never actually deleted; see Edge Cases.

Every transition is recorded with: previous status, new status, effective
date, reason, and the staff member who performed it (or `system` for
automated year-end transitions like Active → Graduated).

## 3. Admission

Workflow stages: **Application → Admission Decision → Acceptance →
Registration → Document Verification → Orientation → Class Allocation.**

- **Admission source:** captures how the applicant reached the school —
  `standard` (normal KPSEA-based intake), `transfer` (from another
  school), `readmission` (returning from Inactive/Withdrawn), `mid_term`
  (joining outside the normal intake window).
- **Admission decision:** recorded with decision date, decision maker
  (Admissions Officer, escalated to DP Administration for exceptions per
  Module 1's role definitions), and outcome (accepted/rejected/waitlisted).
- **Class allocation:** happens at Registration, assigning
  `current_class_id` for the first time — must respect Module 2's class
  capacity rule (soft flag at 45, not a hard block), consistent with
  Module 2's frozen design.
- **Admission history:** every application a person has ever submitted is
  retained (see Edge Cases — duplicate applications) even if it didn't
  result in admission.
- **Admission notes:** free-text, staff-authored, attached to the
  admission record (not the ongoing student timeline) — administrative
  context for *why* a decision was made.
- **Late admission / mid-term admission:** admission remains valid at any
  point within an Academic Year; `date_admitted` and the student's first
  `current_term` reference reflect the actual joining point rather than
  assuming Term 1 start.

## 4. Guardians

- A student has **zero to many** guardians (temporarily zero is valid —
  see Edge Cases).
- Each Guardian record includes: relationship to student (parent, aunt,
  uncle, sibling, appointed guardian, etc.), full name, phone/email
  contacts, physical address, occupation, employer, preferred language,
  `is_primary_contact` flag, `is_emergency_contact` flag, `is_legal_guardian`
  flag, and communication preferences (SMS/email/call, opt-in per channel).
- **Multiple students, one guardian:** a Guardian is its own entity linked
  to students via a join table (`student_guardians`), not duplicated per
  student — this is what makes siblings sharing a guardian a natural case
  rather than an edge case requiring special handling (see Edge Cases).
- Exactly one guardian may be flagged `is_primary_contact` per student at
  a time (enforced), but multiple may be flagged `is_emergency_contact`.
- **Legal guardian flag** matters for consent-requiring actions in later
  modules (e.g. trip permission in Communication/Module 9) — Module 3 only
  stores the flag, it doesn't yet define what requires it.

## 5. Medical Information

Administrative only — no clinical/healthcare workflow (that boundary is
explicit, matching the School Nurse role's Module 1 scope):

- Blood group
- Allergies (list)
- Chronic medical conditions (list)
- Medication alerts (e.g. "carries own inhaler, no other action needed")
- Emergency instructions (free text, e.g. "contact guardian before any
  non-emergency treatment")
- Preferred hospital
- Medical emergency contact (may be a guardian or a separate contact)

**Access control note (carried forward from Module 1):** medical records
are the most access-restricted field group on the student — limited to
School Nurse, Boarding Master/Mistress, Principal, and the student's Class
Teacher (read-only, for day-trip/sports-day awareness). This module
defines the field group and its restricted-access intent; enforcing the
restriction is an implementation detail of whichever module builds
row-level security for `students` (likely bundled with this module's own
schema work, since medical fields live on/near the student record itself).

## 6. Residence

- `boarding_status`: `boarder` or `day_scholar`.
- If `day_scholar`: optional `transport_route_id` (school bus route,
  defined structurally in a later Transport concern — Module 3 only
  stores the reference) and a home/emergency location.
- If `boarder`: `dormitory_id` and bed/bunk reference, plus
  `house_id` (FK to Module 1's `school_houses` — **this is the module that
  introduces `school_houses` as real schema**, resolving Module 2's
  deferral of that table to "whichever module first needs house membership
  as data").
- **Emergency location** is captured regardless of boarding status — for
  day scholars it's typically the home address; for boarders it's the
  guardian's address, used only when a student needs to be sent home in an
  emergency.

## 7. Documents

Document types: Birth Certificate, Previous School Records, Transfer
Letter, Passport Photo, Parent/Guardian Identification, Admission Letter,
Consent Forms, Medical Documents.

Each document record supports:
- **Versioning** — a new upload creates a new version; old versions remain
  retrievable, never overwritten in place.
- **Verification** — `unverified` / `verified` / `rejected`, with verifier
  identity and date (Admissions Officer during intake; any relevant staff
  thereafter).
- **Expiry** — nullable; most documents don't expire, but some (e.g. a
  medical clearance for a specific term) do, and the system must represent
  "no expiry" distinctly from "expiry not yet set."
- **Audit history** — every upload, verification, and rejection is an
  event on the student's timeline (Section 8), not just a document-local
  log, so document activity is visible in the same chronological view as
  everything else.

## 8. Student Timeline

Every state-changing event on a student is recorded as an **immutable,
append-only** timeline entry — nothing is ever deleted or overwritten:

Examples: Applied, Admitted, Registered, Class Allocated, Guardian Added/
Updated/Removed, Medical Record Updated, Document Uploaded/Verified, Class
Changed, Stream Changed, Pathway Changed, Transferred (in/out), Withdrawn,
Status Changed to Inactive, Readmitted, Graduated, Moved to Alumni,
Archived, Restored from Archive.

- Each entry: event type, timestamp, effective date (may differ from
  timestamp — e.g. a transfer recorded today but effective next Monday),
  actor (staff member or `system`), and a structured payload describing
  what changed (previous value → new value, where applicable).
- The timeline is the **audit trail**, not a UI feed — later modules
  (Reporting, Module 11) may build views on top of it, but this module
  only guarantees its completeness and immutability.
- **Nothing disappears:** this is the literal mechanism that satisfies the
  "no historical academic record should ever be lost" requirement — status
  changes, class changes, and document activity are all timeline entries,
  not mutations that discard the prior value.

## 9. Transfers, Withdrawals, and Graduation

- **Internal class/stream transfer:** changes `current_class_id` within
  the same Academic Year; timeline records old and new class. Does not
  affect `admission_number` or any historical record.
- **External school transfer (out):** status → `Transferred`; a Transfer
  Letter document is expected (Section 7) but its absence doesn't block
  the status change — administrative reality is that paperwork sometimes
  lags the actual departure.
- **Temporary leave:** status → `Inactive`, with an optional expected
  return date. Does not consume a graduation-year slot recalculation.
- **Return from leave / readmission:** status → `Active`, using the
  `readmission` admission source (Section 3) rather than a brand-new
  application — the student's original `admission_number` and full history
  are retained and resumed, not recreated.
- **Graduation:** status → `Graduated` at Grade 12 completion, transitioning
  to `Alumni` — this is a Module 3 lifecycle event; the *academic decision*
  of whether a student meets completion requirements belongs to the
  Assessment module (Module 7), which will trigger this transition rather
  than Module 3 deciding it independently.
- **Transfer reversal:** if a transfer is recorded in error or the student
  doesn't actually leave, the status reverts to `Active` via a new timeline
  entry (not a silent undo) — the erroneous `Transferred` entry stays in
  the timeline, annotated as reversed, so the record of what happened is
  never lost even when what happened was a mistake.

## 10. Student Notes, Tags, and Flags

Scoped strictly to **administrative** context, to avoid overlapping with
behavioural/academic tagging that belongs to later modules (Attendance/
Discipline in Module 6, Learning Intelligence in Module 12, and the
existing Attention Feed concept elsewhere in the platform):

- **Student Notes:** free-text, staff-authored, timestamped, administrative
  context (e.g. "sibling of [student], guardian requested joint meetings").
  Not a behaviour log.
- **Student Tags:** short administrative labels (e.g. `scholarship-holder`,
  `sibling-discount`, `document-pending`) — structured, filterable, but
  deliberately generic; this module does not define an academic or
  behavioural tag taxonomy.
- **Student Flags:** administrative alerts requiring staff attention (e.g.
  `missing-birth-certificate`, `fee-balance-review`, `medical-alert`) —
  distinct from Notes in that Flags are meant to be resolved/cleared, not
  just recorded.
- **Explicit non-goal:** none of Notes/Tags/Flags in this module represent
  behaviour, discipline, or academic performance — those are owned by
  their respective future modules, which will reference the Student entity
  rather than extend this one.

---

## 11. Edge Cases

- **Twins:** two independent Student records; no special linkage beyond
  what a shared Guardian record naturally provides (both students'
  `student_guardians` rows point at the same guardian).
- **Students sharing a guardian:** the default case by design (Section 4)
  — a Guardian is its own entity, linked via join table, not duplicated.
- **Missing documents at admission:** admission proceeds; missing required
  documents are represented as `student_flags` entries
  (`missing-<document-type>`) rather than blocking the Admitted/Active
  status transition.
- **Late admission / mid-term admission:** covered in Section 3 — not a
  special case, a normal value of `admission_source` and `date_admitted`.
- **Name changes:** `full_name` is updatable (legal name changes happen —
  marriage is rare at this age but legal corrections, name amendments, and
  transliteration fixes occur); each change is a timeline entry preserving
  the prior value, never a silent overwrite.
- **Duplicate applications:** multiple Applicant records for the same
  underlying person are allowed to exist (Section 3 — full admission
  history retained) but should be flagged for Admissions Officer review
  via a `student_flag` (`possible-duplicate-application`) matched on
  name + date of birth + guardian contact — flagged, not auto-merged,
  since merging identity records is a judgment call for staff.
- **Duplicate admissions:** if the same person is admitted twice by
  mistake, the second `admission_number` is not silently deleted — one
  record is marked as the canonical `Active` one and the duplicate is
  transitioned to `Archived` with a timeline entry cross-referencing the
  canonical record's ID, preserving both audit trails.
- **Guardian changes:** guardians can be added, have flags changed (e.g.
  primary contact reassigned), or removed (e.g. following a custody
  change) — removal is a soft state (`is_active: false` on the join row),
  never a hard delete of the historical guardian relationship.
- **Student with no guardian (temporarily):** valid state — e.g. a
  transfer student's guardian paperwork hasn't been processed yet.
  Guardian count of zero does not block Active status, though it should
  surface as a `student_flag`.
- **Transfer reversal:** covered in Section 9.
- **Graduation corrections:** if a graduation was recorded in error (e.g.
  a student was actually short of requirements), the correction is a new
  timeline entry reverting status to `Active`, with the erroneous
  `Graduated` entry retained and annotated, matching the transfer-reversal
  pattern above — corrections are never silent edits.
- **Archived student restoration:** an Archived record can be restored to
  `Alumni` or `Inactive` (whichever is contextually correct) via an
  explicit `Restored from Archive` timeline entry; "archived" in this
  system is a status value, not a deletion — the record and its full
  timeline are always present, so restoration never requires recovering
  lost data, only changing status.

---

## 12. Module Boundaries

**In scope:** Student identity, status/lifecycle, admission workflow,
guardians, medical (administrative fields only), residence/boarding,
documents, timeline, transfers/withdrawals/graduation, administrative
notes/tags/flags.

**Explicitly out of scope:** Attendance, Assessments, Timetables, Subjects
(referenced via Module 2, not redefined), Teacher Allocation, Career
Intelligence, Adaptive Learning, Learning Analytics, Reports, Behaviour/
Discipline (beyond the administrative-only Suspended status, which
explicitly excludes disciplinary suspension), Finance, Communication.

**Data ownership:** Module 3 owns `students`, `student_status_history`,
`student_admissions`, `guardians`, `student_guardians`, `student_medical`,
`student_residence` (or fields inline on `students` — a schema-time
decision, not an architectural one), `student_documents`,
`student_timeline`, `student_notes`, `student_tags`, `student_flags`.
It also introduces `school_houses` as real schema (Section 6), resolving
the deferral both Module 1 and Module 2 left open. It does not own
`grade_levels`, `classes`, `streams`, or `pathways` — it only references
them (FKs into Module 2). Every future module (Attendance, Assessment,
Timetable, Career Services, Finance, Communication, Learning Intelligence)
references `students.id` as their student identity — none may redefine or
duplicate student identity fields.

---

## Module 3 Freeze Record

**Checkpoint 1 — Student lifecycle complete:** Full state machine
(Applicant → ... → Archived) with every transition described, including
reversal/correction paths (Section 2, 9, 11).

**Checkpoint 2 — Identity fields complete:** Section 1 defines every
required and optional identity field, with explicit notes on immutability
(`admission_number`, `id`) and derivation (`current_term` deliberately
excluded as calendar state, not student state).

**Checkpoint 3 — Administrative ownership clear:** Section 12 states
exactly what Module 3 owns vs. references, with one-way dependency on
Module 2 (grade/class/stream/pathway) and Module 1 (`school_houses`,
introduced here).

**Checkpoint 4 — Relationships defined:** Guardians (many-to-many via join
table), Documents (versioned, one-to-many), Timeline (append-only,
one-to-many), House/Dormitory (FK, boarders only).

**Checkpoint 5 — Edge cases documented:** All edge cases from the brief
(twins, shared guardians, missing documents, late/mid-term admission, name
changes, duplicate applications/admissions, guardian changes, rejoining,
transfer reversal, graduation corrections, archive restoration) are
resolved in Section 11 with a concrete mechanism, not just acknowledged.

**Checkpoint 6 — Module boundaries respected:** No attendance, assessment,
AI, analytics, career, finance, timetable, or reporting logic appears in
this document. Administrative Suspended status is explicitly distinguished
from disciplinary suspension (deferred to Module 6). Notes/Tags/Flags are
explicitly scoped away from behavioural/academic tagging.

**Result: Module 3 Frozen.**
Architecture Approved · Business Scope Approved · Student Domain Approved
· Ready for Freeze · **Module Frozen.**

The Student record is now the canonical identity every future EduNexus
module — Attendance, Assessment, Timetable, Career Intelligence, Finance,
Communication, and the Learning Intelligence Layer — must reference rather
than redefine.

Proceeding to Module 4 — Teachers & Staff.
