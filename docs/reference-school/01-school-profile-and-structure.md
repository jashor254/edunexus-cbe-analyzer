# Reference School — Module 1: School Profile & Organizational Structure

Status: **FROZEN**. Architecture Approved · Business Scope Approved ·
Documentation Approved · Module Boundary Approved. No structural changes
except bug fixes or explicitly approved architectural revisions. Future
modules must treat this document as a stable dependency.

## Purpose

The EduNexus Reference School is a long-term architectural benchmark, not a
demo. Every future feature, workflow, AI capability, and intelligence
component must prove it integrates cleanly into this school before it is
considered production-ready. It is developed in independent, reviewable
modules, each covering one complete business domain. This document is
Module 1: school identity and governance structure only. It defines no
operational data (no students, teachers, subjects, classes, or timetables)
and no seed logic — per project convention, seed generation only happens
after a module's specification is reviewed and frozen.

This school is **100% fictional**. It is not modeled on any real
institution's structure, branding, staff, or student data. It is designed
to feel authentic to a genuine Kenyan senior secondary school while being
entirely synthetic, so that workflows, datasets, and edge cases can be
freely designed, scaled, and stress-tested without privacy concerns or
real-world constraints.

---

## 1. School Identity

| Field | Value |
|---|---|
| Name | Mwatate Ridge Senior School |
| Motto | "Bidii na Maarifa" — "Diligence and Knowledge" |
| Vision | To be a center of excellence producing disciplined, innovative, and globally competitive learners. |
| Mission | To nurture every learner's academic, moral, and creative potential through a holistic CBC pathway experience delivered by a professional, well-resourced teaching community. |
| Core Values | Integrity, Excellence, Discipline, Innovation, Service, Inclusivity |
| Branding | Colours: forest green & gold. Emblem: an open book over a rising sun, framed by two crossed stalks of wheat (symbolizing the region's agricultural heritage). |
| School Category | National-track senior school (Grade 10–12), mixed day & boarding |
| Ownership | Public — Ministry of Education / TSC-staffed |
| Curriculum | CBC Senior School: STEM, Social Sciences, and Arts & Sports Science pathways |
| Location | A fictional sub-county setting, deliberately not tied to a real county name, to keep the school unambiguously synthetic |
| School History | Founded as a mixed day school in 1985; upgraded to a National-track senior school under the CBC transition in 2023; grew from an initial cohort of 120 learners to its current population through three headteacher/principal tenures. |
| Contacts | Synthetic placeholders only — e.g. `info@mwatateridge.ac.ke.example`, a fictional P.O. Box, and a fictional phone number — none resolve to real infrastructure. |
| Population | 960 students |
| Teaching staff | 48 |
| Support staff | 22 |
| Boarding | 3 dormitories, ~650 boarders; ~310 day scholars |
| Transport | 2 school buses, 4 routes |
| Terms | 3 terms/year per the CBC calendar (Term 1: Jan–Apr, Term 2: May–Aug, Term 3: Sep–Oct), each with a mid-term break |
| Facilities | 2 science labs (Physics/Chemistry shared, Biology), 1 computer lab (30 workstations), library (8,000 volumes + digital catalogue), dining hall & kitchen, sick bay, 2 sports fields, 1 assembly hall |

---

## 2. Organizational Structure & Governance

```
Board of Management (BoM)
   │
Principal
   │
   ├── Deputy Principal — Academics
   │      ├── Dean of Studies
   │      │      ├── Heads of Department (one per academic department)
   │      │      ├── Career Coordinator
   │      │      └── Guidance & Counselling Coordinator
   │      └── Examinations Officer
   │
   ├── Deputy Principal — Administration
   │      ├── Finance Officer
   │      ├── Admissions Officer
   │      ├── School Secretary → Receptionist
   │      ├── ICT Administrator
   │      ├── Boarding Master/Mistress
   │      └── School Nurse
   │
   ├── Librarian
   └── Laboratory Technicians (dotted-line to HoD Sciences)
```

**Governance notes:**
- The Board of Management holds ultimate oversight and approves policy, budget, and the Principal's major decisions; it is not a day-to-day operating role and is out of scope for dashboards/permissions in this system.
- The Principal is the single point of final approval authority for the school (admissions exceptions, staff discipline, expenditure above delegated limits, external communication).
- The two Deputy Principal seats split the school along Academics vs. Administration — this split determines which later modules (Timetable/Assessment vs. Finance/Admissions) each DP has approval authority over.
- Career Coordinator and Guidance & Counselling Coordinator are academic support functions and report through the Deputy Principal — Academics chain (via Dean of Studies), alongside the Heads of Department, since guidance and career work is coupled to curriculum delivery and student academic progress rather than being a standalone cross-cutting function.

---

## 3. Departments

**Academic departments** (each led by one Head of Department):
1. Languages — English, Kiswahili, French
2. Mathematics
3. Sciences — Physics, Chemistry, Biology
4. Social Sciences — History, Geography, CRE
5. Applied Sciences — Agriculture, Computer Studies
6. Creative Arts & Humanities — Music, Art & Design

**Administrative departments:**
- Finance
- Admissions
- Registry / School Secretariat

**Support departments:**
- ICT
- Library
- Laboratories (shared service to the Sciences department)
- Boarding & Welfare (dormitories, nursing, discipline follow-up)

**Special units:**
- Career Services
- Guidance & Counselling

Each academic department owns its subjects' assessment moderation and holds
a standing weekly departmental meeting (mechanics defined in the Assessment
module, Module 7). Administrative and support departments do not have HoDs;
they report directly to the relevant Deputy Principal or Principal as shown
in the org chart above.

---

## 4. School Houses

| House | Colour | Notes |
|---|---|---|
| Amani | Blue | "Peace" |
| Ushindi | Red | "Victory" |
| Umoja | Green | "Unity" |
| Nuru | Yellow | "Light" |

- Every student belongs to exactly one house for the duration of their
  enrollment (house assignment persists across grade/stream changes).
- Each house has a House Captain (student leadership role, elected/appointed
  per term) and a staff House Patron/Matron who supervises house activities
  and discipline points.
- Houses compete in inter-house sports, drama, and academic quiz
  competitions; house points feed into an end-of-term house trophy.
- House relationships: houses are cross-cutting to streams and classes —
  a single class typically contains students from all four houses, which is
  intentional (it's the mechanism CBC schools use to mix streams for sport
  and co-curricular activities).

---

## 5. Roles

Full role definitions. Permissions and dashboard needs are described at the
level Module 1 can support (structural/organizational); they will be
sharpened once the modules that create the underlying data (Students,
Teachers, Timetable, Assessment, Finance) are frozen — each role's entry
below notes where that refinement will happen.

### Principal
- **Responsibilities:** Overall accountability for the school; final decision authority; represents the school to the Board of Management, Ministry of Education, and parents.
- **Permissions:** Full read access across all modules; approval authority over both DPs' domains; can override any lower-level approval.
- **Reporting line:** Board of Management.
- **Key daily activities:** Review overnight incident/discipline escalations, approve pending high-value expenditures, meet with DPs, handle escalated parent concerns.
- **Dashboard needs:** School-wide summary (attendance %, fee collection %, discipline incidents, exam calendar countdown); drill-down into any department.
- **Approval authority:** Final approval on admissions exceptions, staff actions, expenditure above delegated limits, external communications/circulars.
- **Future integration notes:** Will be the primary consumer of the eventual School Intelligence / Predictive Analytics layer (Module 12+) — dashboard should be designed with that future rollup in mind, without building it now.

### Deputy Principal — Academics
- **Responsibilities:** Owns academic calendar, timetable integrity, examinations oversight, teacher supervision (via Dean of Studies and HoDs).
- **Permissions:** Full access to Academic Structure, Timetable, Assessment modules; read access to Student records; no Finance access.
- **Reporting line:** Principal.
- **Key daily activities:** Resolve timetable conflicts, review exam readiness, sign off on mark entry deadlines, chair HoD meetings.
- **Dashboard needs:** Timetable conflict alerts, exam calendar, department-level performance trends (once Assessment module exists).
- **Approval authority:** Approves timetable changes, exam schedules, teacher substitutions, subject allocation.
- **Future integration notes:** Primary owner of Assessment Intelligence and Teacher Intelligence once those layers exist.

### Deputy Principal — Administration
- **Responsibilities:** Operations, finance oversight, admissions, facilities, boarding, ICT infrastructure.
- **Permissions:** Full access to Finance, Admissions, Facilities/Boarding modules; read access to Student records; no Assessment mark-entry access.
- **Reporting line:** Principal.
- **Key daily activities:** Review fee collection status, approve expenditures within delegated limit, oversee admissions intake, handle facilities issues.
- **Dashboard needs:** Fee collection %, defaulter list, admissions pipeline, facilities/maintenance tickets.
- **Approval authority:** Approves expenditures (within limit), fee waivers (within policy), admission of new/transfer students, boarding placements.
- **Future integration notes:** Consumer of future Financial Intelligence / Predictive Analytics on fee defaulting.

### Dean of Studies
- **Responsibilities:** Curriculum delivery quality, teacher classroom supervision, remedial program coordination.
- **Permissions:** Read/write on curriculum delivery records (Module 2+); read access to teacher performance notes.
- **Reporting line:** Deputy Principal — Academics.
- **Key daily activities:** Classroom observations, review scheme-of-work adherence, coordinate remedial sessions.
- **Dashboard needs:** Curriculum coverage tracker (per department, per term).
- **Approval authority:** Approves scheme-of-work deviations; recommends (does not finalize) teacher performance actions.
- **Future integration notes:** Direct consumer of Adaptive Learning / Curriculum Intelligence once built.

### Examinations Officer
- **Responsibilities:** Exam scheduling, question paper logistics/printing, invigilation rosters, results collation.
- **Permissions:** Full access to Assessment module's scheduling/logistics; restricted access to raw marks until moderation is complete (moderation workflow defined in Module 7).
- **Reporting line:** Deputy Principal — Academics.
- **Key daily activities:** Confirm exam room allocations, track printing status, chase missing marks from teachers.
- **Dashboard needs:** Exam readiness checklist, missing-marks tracker.
- **Approval authority:** Approves exam timetable, invigilation assignments; cannot alter marks after moderation freeze.
- **Future integration notes:** N/A for now — pure operational role.

### Head of Department (×6)
- **Responsibilities:** Subject moderation, departmental resourcing, mentoring subject teachers within the department.
- **Permissions:** Full access to their own department's teachers/subjects/assessments; no cross-department write access.
- **Reporting line:** Deputy Principal — Academics.
- **Key daily activities:** Review CAT/exam moderation, allocate teaching load within department, order lab/teaching resources.
- **Dashboard needs:** Department performance trend, teacher load balance, resource requests.
- **Approval authority:** Approves department-level scheme of work, moderates marks before they leave the department, approves department resource requests within budget.
- **Future integration notes:** Will consume department-level Assessment Intelligence.

### Subject Teacher
- **Responsibilities:** Lesson delivery, CAT/assignment setting and marking, mark entry.
- **Permissions:** Write access to marks/attendance for classes they teach only; read access to their students' prior academic records.
- **Reporting line:** Head of Department.
- **Key daily activities:** Deliver lessons, enter marks, record lesson attendance, flag struggling students to Class Teacher.
- **Dashboard needs:** Class list per subject, mark-entry status, upcoming CAT/exam deadlines.
- **Approval authority:** None (marks subject to HoD moderation).
- **Future integration notes:** Primary end-user of Teacher Intelligence / AI teaching assistants.

### Class Teacher
- **Responsibilities:** Daily register, first-line discipline, parent liaison for one assigned class.
- **Permissions:** Full read access to their class's student records; write access to daily attendance and behaviour notes.
- **Reporting line:** Dean of Studies.
- **Key daily activities:** Take register, follow up absentees, communicate with parents, compile class-level term reports.
- **Dashboard needs:** Class attendance summary, discipline incident log, fee-status flags for their class (read-only).
- **Approval authority:** Approves minor leave requests (e.g. early dismissal) for their class; escalates discipline beyond warnings.
- **Future integration notes:** Will be a key consumer of Parent Intelligence summaries.

### Career Coordinator
- **Responsibilities:** Career guidance sessions, university/TVET visit logistics, mentorship event coordination.
- **Permissions:** Read access to student academic records (for guidance context); write access to Career Services module records.
- **Reporting line:** Dean of Studies (under Deputy Principal — Academics).
- **Key daily activities:** Schedule career talks, log student career interests, coordinate with industry partners.
- **Dashboard needs:** Upcoming career events calendar, student interest register.
- **Approval authority:** Approves career event scheduling.
- **Future integration notes:** Will be the primary human-in-the-loop for Career Intelligence (explicitly deferred — Module 10 builds the operational structure only; intelligence comes in Module 12+).

### Guidance & Counselling Coordinator
- **Responsibilities:** Student welfare, discipline follow-up, family liaison for sensitive cases.
- **Permissions:** Read access to discipline and attendance records; write access to counselling case notes (access-restricted beyond Guidance, Dean of Studies, and Principal).
- **Reporting line:** Dean of Studies (under Deputy Principal — Academics).
- **Key daily activities:** Meet referred students, follow up on discipline cases, coordinate with parents on welfare concerns.
- **Dashboard needs:** Active case list, follow-up reminders.
- **Approval authority:** Recommends discipline outcomes; does not impose them.
- **Future integration notes:** Case notes are the most sensitive record type in the system — will need explicit access-control design when Module 6 (Attendance/Discipline) is specified.

### ICT Administrator
- **Responsibilities:** Systems administration, user account provisioning, backups, hardware/network maintenance.
- **Permissions:** System-admin access to provision/deactivate user accounts; no access to academic/financial content itself.
- **Reporting line:** Deputy Principal — Administration.
- **Key daily activities:** Handle account/access requests, monitor system health, run backup verification.
- **Dashboard needs:** System uptime, pending access requests, backup status.
- **Approval authority:** Approves new user account creation (technical, not academic/financial approval).
- **Future integration notes:** Owns eventual integration/API access management as the platform grows.

### Finance Officer
- **Responsibilities:** Fee invoicing, payment tracking, expense recording, payroll liaison.
- **Permissions:** Full access to Finance module; no access to Assessment/academic content.
- **Reporting line:** Deputy Principal — Administration.
- **Key daily activities:** Reconcile payments, chase defaulters, prepare financial reports.
- **Dashboard needs:** Collection rate, defaulter list, expense summary.
- **Approval authority:** Approves receipting of payments; escalates waivers/scholarships to DP Administration.
- **Future integration notes:** Consumer of future Financial Intelligence (defaulter prediction).

### Admissions Officer
- **Responsibilities:** New learner intake, transfer processing, document verification.
- **Permissions:** Write access to Admissions module; write access to create new Student records (Module 3) once admitted.
- **Reporting line:** Deputy Principal — Administration.
- **Key daily activities:** Process applications, verify documents, coordinate placement tests where applicable.
- **Dashboard needs:** Applications pipeline, pending document checklist.
- **Approval authority:** Recommends admission; DP Administration gives final sign-off for exceptions (e.g. mid-term admission, capacity overrides).
- **Future integration notes:** N/A for now.

### School Secretary
- **Responsibilities:** Correspondence, minute-taking for management meetings, document management.
- **Permissions:** Write access to Document Management (later module); read access to staff/student records for correspondence purposes.
- **Reporting line:** Deputy Principal — Administration.
- **Key daily activities:** Draft circulars, file minutes, manage incoming/outgoing correspondence.
- **Dashboard needs:** Pending correspondence queue, document filing status.
- **Approval authority:** None (executes on behalf of Principal/DPs).
- **Future integration notes:** N/A for now.

### Receptionist
- **Responsibilities:** Front office, visitor log, call handling, first point of contact for parents.
- **Permissions:** Write access to visitor log; read-only directory access to staff.
- **Reporting line:** School Secretary.
- **Key daily activities:** Log visitors, route calls/queries, hand off parent requests to the right department.
- **Dashboard needs:** Visitor log, today's expected visitors/appointments.
- **Approval authority:** None.
- **Future integration notes:** N/A for now.

### Librarian
- **Responsibilities:** Book lending/returns, digital resource catalogue, overdue tracking.
- **Permissions:** Full access to Library module (future module); read-only access to student directory for borrower lookup.
- **Reporting line:** Head of Department, Languages (nominal — library service is cross-departmental).
- **Key daily activities:** Process lending/returns, chase overdue books, catalogue new acquisitions.
- **Dashboard needs:** Overdue list, popular titles, inventory count.
- **Approval authority:** Approves fine waivers within policy.
- **Future integration notes:** N/A for now.

### Laboratory Technician
- **Responsibilities:** Equipment inventory, practical session preparation, safety compliance.
- **Permissions:** Full access to Laboratory module (future module); read access to practical lesson schedule.
- **Reporting line:** Head of Department, Sciences.
- **Key daily activities:** Prepare apparatus/reagents for scheduled practicals, log equipment condition, restock consumables.
- **Dashboard needs:** Upcoming practical sessions requiring prep, low-stock alerts.
- **Approval authority:** Flags safety non-compliance for HoD action; no independent approval authority.
- **Future integration notes:** N/A for now.

### School Nurse
- **Responsibilities:** Sick bay operations, medical record maintenance, emergency first response.
- **Permissions:** Write access to medical records (access-restricted — Nurse, Principal, Boarding Master/Mistress only); read access to student directory.
- **Reporting line:** Deputy Principal — Administration.
- **Key daily activities:** Treat sick-bay visits, log medical incidents, flag chronic conditions to Class Teacher/parents as needed.
- **Dashboard needs:** Today's sick-bay log, students with flagged chronic conditions.
- **Approval authority:** Authorizes emergency medical action pending parent contact; escalates to Principal for hospital referral.
- **Future integration notes:** Medical records will need the strictest access control of any record type when Module 3 (Students) is specified.

### Boarding Master/Mistress
- **Responsibilities:** Dormitory supervision, boarder welfare, evening/weekend discipline for boarders.
- **Permissions:** Full access to boarding roster and dormitory allocation; write access to boarder-specific discipline notes.
- **Reporting line:** Deputy Principal — Administration.
- **Key daily activities:** Evening roll call, dormitory inspections, weekend leave approvals for boarders.
- **Dashboard needs:** Dormitory occupancy, boarder leave requests, incident log.
- **Approval authority:** Approves boarder weekend/exeat leave; escalates serious incidents to Guidance & Counselling or Principal.
- **Future integration notes:** N/A for now.

### Parent
- **Responsibilities:** N/A (external stakeholder, not staff) — monitors child's progress, pays fees, receives communication.
- **Permissions:** Read-only access scoped to their own child/children's records only (academic, attendance, fees, discipline summary).
- **Reporting line:** N/A.
- **Key daily activities:** Check announcements, view child's results/attendance, make fee payments.
- **Dashboard needs:** Child summary card (per child, if multiple), payment history, unread announcements.
- **Approval authority:** None within the school system; approves/consents to school-initiated actions requiring parental sign-off (e.g. trip permission) once Communication module exists.
- **Future integration notes:** Primary consumer of future Parent Intelligence.

### Student
- **Responsibilities:** N/A (learner, not staff) — attends lessons, submits work, participates in co-curricular activities.
- **Permissions:** Read-only access to own timetable, results, and attendance; write access to own assignment submissions (once that module exists).
- **Reporting line:** N/A (Class Teacher is the point of contact).
- **Key daily activities:** Attend lessons, submit assignments, check own results/announcements.
- **Dashboard needs:** Today's timetable, upcoming deadlines, latest results.
- **Approval authority:** None.
- **Future integration notes:** Primary consumer of Adaptive Learning / Learning Analytics.

### Support Staff (cooks, groundskeepers, security, drivers)
- **Responsibilities:** Facility operations, catering, security, transport.
- **Permissions:** No academic system access; may have narrow operational access (e.g. driver sees bus route/roster only) defined when relevant modules are built.
- **Reporting line:** Deputy Principal — Administration.
- **Key daily activities:** Role-specific (catering, grounds maintenance, gate security, driving routes).
- **Dashboard needs:** Role-specific, minimal (e.g. driver sees today's route and passenger manifest).
- **Approval authority:** None.
- **Future integration notes:** Likely out of scope for most future intelligence layers; included here for completeness of the org structure.

---

## 6. Module 1 Boundaries

**In scope (this document):** school identity, branding, governance
structure, departments, houses, and full role definitions.

**Explicitly out of scope** (deferred to later modules per the roadmap
below): students, teachers as data records, subjects, classes, streams,
timetables, attendance, assessments, reports, fees, library inventory,
career intelligence, adaptive learning, AI features, analytics. No schema
or seed data is created by this module — it is documentation only.

---

## 7. Module Roadmap

1. School Profile & Organizational Structure *(this document)*
2. Academic Structure — grade levels, classes, streams, subjects, departments, academic calendar
3. Students
4. Teachers & Staff
5. Timetables
6. Attendance
7. Assessment
8. Finance
9. Communication
10. Career Services
11. Reporting & Analytics
12. Learning Intelligence Layer

This progression is maintained unless a compelling architectural reason
requires reordering.

---

## 8. Documentation & Seed Data Convention

Documentation and executable code are kept strictly separate:

```
docs/
└── reference-school/
    ├── 01-school-profile-and-structure.md
    ├── 02-academic-structure.md
    ├── 03-students.md
    ├── 04-teachers.md
    ├── 05-timetable.md
    ├── 06-attendance.md
    ├── 07-assessment.md
    ├── 08-finance.md
    ├── 09-communication.md
    ├── 10-career-services.md
    ├── 11-reporting.md
    └── 12-learning-intelligence.md

scripts/
└── reference-school/
    ├── seed-school.ts
    ├── seed-departments.ts
    ├── seed-staff.ts
    ├── seed-students.ts
    ├── seed-subjects.ts
    ├── seed-timetable.ts
    ├── seed-attendance.ts
    ├── seed-assessments.ts
    ├── seed-finance.ts
    └── seed-career.ts
```

Per module: design → document workflows → identify edge cases → review →
freeze the spec → *then* generate seed data → build implementation → QA →
integrate. No seed data is generated before a module's specification is
reviewed and frozen.

**Database philosophy:** the schema follows the module roadmap — never
create production tables because they might be needed later. Each module
introduces only the schema it requires, e.g. Module 2 introduces
`academic_years`, `terms`, `grade_levels`, `classes`, `streams`, `subjects`
(and `departments` if not already needed by Module 1); Module 3 introduces
student-related tables; Module 4 introduces teacher/staff tables. Module 1
itself required no production schema — it is documentation only. This
keeps migrations small, reviewable, reversible, and testable, and gives
each module clear, non-duplicated ownership of its own entities (e.g.
Academic Structure owns academic years/terms/grades/streams/subjects/
curriculum relationships; Students owns students/admissions/guardians/
transfers/status; Teachers owns teachers/employment/teaching allocation/
professional records; Assessment owns exams/assignments/rubrics/marks/
moderation/publishing/results — no module duplicates another's entities).

---

## Module 1 Freeze Record

**Checkpoint 1 — Documentation complete:** Business rules, responsibilities,
and module boundaries are fully documented above; nothing load-bearing left
ambiguous.

**Checkpoint 2 — Workflow complete:** This module has no operational
workflows of its own (no data, no transactions) — its "workflow" is the
reporting/approval structure captured in the org chart and per-role
Approval Authority fields. Alternative paths (e.g. Principal overriding a
DP) and future integration points are noted per role. No edge cases apply
at the structure-only level; edge cases begin in earnest in Module 2+ where
real workflows exist.

**Checkpoint 3 — Data ownership complete:** Module 1 owns no production
data (see Database Philosophy above). The org chart, department list,
house list, and role catalogue are the durable *reference* that later
modules' schemas will encode as actual rows once a module needs them to
exist as data (e.g. `departments` and `school_houses` tables are most
likely introduced in Module 2 or Module 4, not here).

**Result: Module 1 Frozen.** Proceeding to Module 2 — Academic Structure.
