# Reference School — Module 11: Reporting & Analytics

Status: **FROZEN**. Architecture Approved · Business Scope Approved ·
Reporting Domain Approved. No structural changes except bug fixes or
explicitly approved architectural revisions. Future modules must treat
this document as a stable dependency.

Depends on: all prior modules ([[01-school-profile-and-structure]],
[[02-academic-structure]], [[03-students]], [[04-teachers-and-staff]],
[[05-timetables]], [[06-attendance-and-discipline]], [[07-assessment]],
[[08-finance]], [[09-communication]], [[10-career-services]] — all frozen).
This module is purely a read layer over them.

## Purpose

Module 11 aggregates and presents data that Modules 1–10 already own — it
introduces no new facts, only views, rollups, and export formats. This is
the explicit boundary that keeps it from becoming Learning Intelligence
(Module 12): everything here is a **direct computation or projection**
over existing records (sums, averages, filters, formatted documents), not
an inference, prediction, or AI-generated judgment.

---

## 1. Student Reports

- **Report Card:** per student, per term — published Assessment results
  (Module 7), attendance summary (Module 6), a Class Teacher remark field
  (free text, staff-authored, stored on the report itself since it's
  specific to that document, not duplicated into Module 3's student
  notes), and ranking (Module 7's computed ranking, read here, not
  recomputed).
- **Cumulative Academic Record:** a student's full result history across
  terms/years, straightforwardly assembled from Module 7's published
  results — no trend inference, just chronological assembly.

## 2. Teacher & Department Reports

- **Teacher Workload Report:** teaching load (Module 4's stored
  assignments × Module 2's period allocations), attendance record (Module
  6's staff attendance).
- **Department Performance Report:** aggregate published results (Module
  7) grouped by department (Module 2's subject→department linkage) — an
  average/distribution computation, not a diagnostic one.

## 3. Attendance & Behaviour Reports

- **Attendance Report:** per student/class/school-wide, over a date range
  — a direct rollup of Module 6's daily/lesson attendance records.
- **Behaviour Report:** incident counts and outcomes (Module 6) per
  student/class/house, over a date range — access-restricted consistent
  with Module 6's counselling-note restrictions (a Behaviour Report
  including counselling case notes is only visible to Guidance, Dean of
  Studies, and Principal; an incident-count-only version is visible more
  broadly, e.g. to a Class Teacher for their own class).

## 4. Parent Reports

- A **Parent Report** is a guardian-facing bundle of their child/children's
  Report Card, attendance summary, and fee balance (Module 8) — assembled
  per guardian (Module 3's `student_guardians`), not per student, since a
  guardian with multiple children at the school expects one consolidated
  view.

## 5. School Performance & Inspection Reports

- **School Performance Report:** school-wide rollups (mean scores by
  subject/grade, overall attendance rate, fee collection rate) — the
  Principal-facing summary named in Module 1's Dashboard Needs for that
  role, now given a concrete report form.
- **Inspection Report:** a formatted export bundling the records a
  Ministry of Education inspection typically requests (enrollment
  numbers, staff qualifications from Module 4, curriculum compliance from
  Module 2's Curriculum Policy, facilities list from Module 1) — assembled
  from existing data, not a new data source.

## 6. Financial Reports

- **Collection Report:** invoiced vs. collected, by term/grade (Module 8).
- **Expense Report:** categorized expense totals (Module 8) over a date
  range.
- **Defaulter Report:** students currently flagged as defaulters (Module
  8's flag mechanism), for Finance Officer/DP Administration action.

## 7. Export & Delivery

- Every report above supports **PDF**, **Excel**, and **Print** output —
  a rendering concern applied uniformly across report types, not
  redesigned per report.
- Reports can be delivered through Module 9's existing channels
  (notification of availability, or attached to a Circular for mass
  distribution) — this module does not build a second delivery mechanism.

---

## 8. Edge Cases

- **Report requested for a transferred/withdrawn student:** fully
  supported — Module 3 never deletes student records, so historical
  reports remain generable indefinitely, correctly reflecting the
  student's status at the time each underlying record was created.
- **Report spanning a mid-year Curriculum Policy or Fee Structure change:**
  the report reflects whatever policy/structure version was actually in
  force for each record at the time (Modules 2 and 8's versioning already
  guarantees this) — this module doesn't need its own versioning logic,
  only correct joins against the versioned source data.
- **Conflicting data at report time (e.g. an Assessment still under
  moderation):** unmoderated/unpublished results are excluded from Report
  Cards and rankings by definition (Module 7 only exposes `published`
  results) — this module doesn't need a special exclusion rule of its own,
  it simply never sees unpublished data.
- **Large export (whole-school report):** an operational/performance
  concern for implementation, not an architectural one — flagged so it
  isn't forgotten, not solved here.

---

## 9. Module Boundaries

**In scope:** Student/teacher/department/attendance/behaviour/parent/
school-performance/inspection/financial reports, PDF/Excel/Print export,
delivery via Module 9's existing channels.

**Explicitly out of scope:** Any predictive, diagnostic, or AI-generated
insight (Module 12 — this is the hard line separating "reporting" from
"intelligence" per the original brief's phasing), new data creation of any
kind (this module only reads).

**Data ownership:** Module 11 owns no primary data — only report
*definitions/templates* and generated report *artifacts* (e.g. a stored
PDF snapshot of a term's report card, kept for audit purposes even if
underlying data later changes). All facts it displays are owned by
Modules 1–10 and referenced, never duplicated or redefined.

---

## Module 11 Freeze Record

**Checkpoint 1 — Business rules complete:** All named report types
(student, teacher/department, attendance/behaviour, parent, school-
performance/inspection, financial) and export/delivery are each fully
specified (Sections 1–7).

**Checkpoint 2 — Ownership clear:** Section 9 states Module 11 owns no
primary data, only report definitions and generated artifacts — the
cleanest possible dependency direction (everything flows in, nothing new
flows out except formatted views).

**Checkpoint 3 — Edge cases documented:** Reports on transferred students,
mid-year policy changes, unmoderated data exclusion, and large exports are
each resolved or explicitly flagged as an implementation concern (Section
8).

**Checkpoint 4 — Module boundaries respected:** No predictive/diagnostic/
AI logic appears anywhere in this document — the line to Module 12 is
explicit and absolute.

**Result: Module 11 Frozen.**
Architecture Approved · Business Scope Approved · Reporting Domain
Approved · Ready for Freeze · **Module Frozen.**

All 11 operational modules of the Reference School are now frozen. The
school can, on paper, run a complete academic year without any AI or
intelligence layer — satisfying the original brief's core test. Module 12
(Learning Intelligence Layer) is the only remaining module, and per the
brief's Guiding Principle, it should only be designed once the operational
foundation above is validated as sufficient — a checkpoint for you before
proceeding, not an automatic next step.
