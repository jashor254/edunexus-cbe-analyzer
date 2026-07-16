# Sprint 6C — Academic Operating Model Audit

**Mode: READ ONLY.** No code, schema, migration, route, repository, service, or test was modified. No school model is invented — every claim below is marked VERIFIED (confirmed by direct schema/code inspection or live query), LIKELY (strong indirect evidence, not exhaustively confirmed), or UNKNOWN (flagged rather than guessed).

**Builds on**: Stage 0, Stage 0.5, ADR-0002, and Sprints 5D–6B, all of which examined pieces of this lifecycle in isolation. This document is the first to walk the full chain end-to-end and to check for the organizational-structure entities (Departments, Exam Office, Timetable, etc.) none of the prior audits were asked to look for.

---

## Executive Summary

EduNexus's real, reachable academic operating model is **flatter and less institutionally structured than a real Kenyan secondary school** — there is no Department, Faculty, Subject Head, Dean of Studies, Exam Office, House System, Boarding, Pastoral, or Moderation/Invigilation concept anywhere in the schema or code (**VERIFIED absent**, all). The only organizational role that exists at all is "the class teacher" — and even that has two non-communicating representations (`teacher_classes.teacher_id`, ratified canonical by ADR-0002, vs. `classes.class_teacher_id`, Core, isolated). Administration and Academics are **not separated as domains** in the live, teacher-facing product — the same person (a class teacher) performs admission, teaching, assessment, and (on paper) promotion, with no registrar, exam office, or academic-coordinator role anywhere in between. Two concrete, previously-undocumented findings stand out: **the legacy promotion mechanism cannot represent graduation at all** (`student_promotions.to_grade` is `NOT NULL` — every promotion event must specify a next grade), and **the `students` table itself has no lifecycle/status column of any kind** — a student is either a row or not, with no formal exit state. Both of Promotion's two pipelines are, additionally, API-only with **zero UI** in either case.

---

## The Lifecycle Chain, Traced Node by Node

### Admission
- **VERIFIED**: the real, reachable admission path is `app/api/teacher/classes/[classId]/students/route.ts` — a class teacher adds one or more students directly to their own class, inserting into `students` (legacy) and `class_students` in the same request. No separate Admission/registrar role, route, or approval step exists.
- **VERIFIED**: a second, Core-native admission path exists — `app/api/core/learners/route.ts` — creating rows in `learners`, gated by school-staff-tier permissions (broader than just the class teacher). This is the more institutionally correct shape (a school-level, not classroom-level, action) but is the functionally-isolated Core pipeline (Stage 0.5: 3 confirmed callers, unclear HTTP-reachability).
- **Determination**: Administration and Academics are **not separated** in the path real production data flows through — the class teacher is simultaneously the admissions officer.

### Learner
- **VERIFIED**, unchanged from Stage 0.5: `students` (legacy, 499 rows, 68-file usage, de facto canonical) vs. `learners` (Core, 405 rows, effectively 1 repository + 3 callers). Not re-derived here.
- **NEW finding this session**: `students` has **no status/lifecycle column at all** — full column list confirmed live: `id, user_id, name, grade, date_of_birth, current_pathway, level, term, year, school, ..., teacher_id, selected_subjects, capability_profile, ..., upi` — no `status`, `is_active`, `graduated`, or `archived` field of any kind. Contrast with Core's `learners.status`, which is a real, typed `LearnerStatus` enum (`active | transferred | graduated | archived | deceased`, `types/core.ts:33-38`). **The table real production data lives in cannot represent a learner leaving the school in any form.**

### Grade, Class, Teacher Assignment, Subject Assignment
- **VERIFIED**, fully inventoried in Sprint 6B — not re-derived. Grade: 3 representations (Core `grades`, legacy raw integer, curriculum `sow_grades`). Class: `teacher_classes` (canonical-in-practice) vs. `classes` (Core, isolated). Teacher Assignment: `teachers.id` ratified canonical (ADR-0002). Subject Assignment: 4 representations (Core `subjects`, legacy free text, curriculum `sow_learning_areas`, and the hardcoded `lib/curriculum/subjects.ts` catalogue that actually drives the real teacher UI).

### Teaching
- **VERIFIED**: "Teaching" is not a distinct tracked entity — it is the composite of Teacher Assignment (who) + Class (where) + Subject Assignment (what), already covered above. No separate "teaching load," "lesson delivery," or "period" concept exists at the data layer (Timetable, below, is the closest candidate and does not exist).

### Assessment
- **VERIFIED**, from Sprint 5D–5I and 6B: `class_assessments`, `teacher_id`/`assessment_type_id` correctly resolved since Sprint 5F; `grade_id` FK exists but 0% populated (Sprint 6B); `term`/`year` are free text/int, never FK'd. Not re-derived.

### Evidence
- **VERIFIED**, from Stage 0.5's Fourth Law finding: `learner_evidence` is anchored to `students.id`, not `learners.id` — the Evidence/Intelligence stack is built on the same legacy identity the real Assessment/Class/Teacher chain uses, which is at least internally consistent even though it diverges from Core.

### Reports
- **VERIFIED**, from Stage 0.5: two pipelines — Core's `school_report_cards`/`term_subject_summaries` (zero production rows) and the legacy AI auto-report path via `assessments` (the only one producing real parent-facing output). Not re-derived.

### Promotion
- **VERIFIED**, extending Sprint 6A/6B with new detail: two tables (`learner_promotions`, Core; `student_promotions`, legacy), both currently zero live rows. **New this session**: neither has any UI at all — confirmed by direct inspection of `app/api/teacher/students/[studentId]/promote/route.ts`'s own code comment: *"No UI yet — API surface only, per the confirmed 2026-07-13 scope decision."* Both promotion pipelines are, today, API-only, unreachable by any real teacher through the product.
- **VERIFIED, decisive finding**: `student_promotions.to_grade integer NOT NULL` — the legacy promotion table's schema makes it **structurally impossible to record a graduation event**, since every row must specify a next grade. Core's `learner_promotions.to_class_id` is nullable specifically to represent "graduated out," and `promotion_type` includes `'graduated'` as a real, valid value (`20260629_core_foundation.sql:551-552`) — but that table has zero adoption.

### Graduation / Exit
- **VERIFIED**: graduation logic exists in code — `lib/core/promotions.ts:38-42` sets `learners.status = 'graduated'` and `graduation_date` when `promotion_type === 'graduated'` — but only inside the Core pipeline, which (a) has no reachable UI and (b) writes to the `learners` table that Stage 0.5 found functionally isolated from the rest of the platform.
- **VERIFIED**: the legacy promote route (`app/api/teacher/students/[studentId]/promote/route.ts`) has **zero references to graduation, `to_grade`, or `from_grade`** in its own request schema (`PromoteSchema` requires `toGrade: z.number().int().min(1).max(12)`) — matching its underlying table's `NOT NULL` constraint. **Conclusion**: there is currently no reachable path, through any UI or any actively-used API surface, by which a real pilot teacher can formally graduate or exit a student from the system. A Grade 9 or Form 4 student's departure is not a modeled event anywhere in the live product.

---

## Specific Questions

**1. What belongs exclusively to Administration?**
**VERIFIED**: School (`schools`), Academic Year/Term (`academic_years`/`terms`, Core-only, no live legacy equivalent as a real entity), School-user role/membership (`school_users`, per ADR-0002's own Permissions-domain ruling). These have no legacy/teacher-facing competing representation — they are Core-only concepts, for better or worse (better-designed, worse-adopted).

**2. What belongs exclusively to Academics?**
**VERIFIED**: Assessment content (marks, scores, CBC levels), Evidence, Grading/Ranking computation. These exist only in the legacy/teacher-facing surface with no Core competitor of their own (Core's assessment tables extend the same physical `class_assessments`, not a separate academic-content table).

**3. Which entities cross both domains?**
**VERIFIED**: Learner (admission is arguably administrative, but the same `students` row is the academic subject of every assessment); Class (an administrative unit of organization that is also the unit teaching happens in); Teacher Assignment (an HR/administrative fact that is also the academic authority to grade). None of these are cleanly separated in this codebase — the same table often serves both purposes at once (e.g., `teacher_classes` is simultaneously the administrative roster and the academic teaching unit).

**4. Which entities already have canonical ownership?**
**VERIFIED**: Teacher identity (`teachers.id`, ADR-0002). School (`schools`, uncontested, no duplicate found anywhere in this series). Streams/Subject-as-Core-entity have no legacy competitor of their own shape (Stage 0.5), though Sprint 6B found Subject does have other competitors from a different angle (curriculum/SOW, hardcoded catalogue).

**5. Which entities still have competing ownership?**
**VERIFIED**: Learner (`students`/`learners`), Class (`teacher_classes`/`classes`), Grade (3-way), Subject (4-way), Enrollment (`class_students`/`learner_enrollments`), Promotion (`learner_promotions`/`student_promotions`), Academic Year/Term (real entity vs. free text). All previously catalogued in Stage 0.5/Sprint 6A/6B; restated here only to answer this sprint's specific question, not re-derived.

**6. Which entities are duplicated?**
Same list as Question 5 — in this codebase, "competing ownership" and "duplicated" describe the same set of findings; no entity was found with competing ownership that *wasn't* also a duplication (i.e., no case of two systems legitimately sharing one canonical table).

**7. Which important school entities are completely missing?**
See the full checklist below — this is the section with the most new information this sprint.

---

## School-Entity Gap Analysis

Checked by direct schema search (`information_schema`, migration file grep) and application-code search. None were assumed present or absent without a search.

| Entity | Status | Evidence |
|---|---|---|
| **Departments** | **VERIFIED absent** | No table; the one text match ("heads of department," `20260628_eios_foundation.sql:190`) is a comment describing a report's *audience*, not an entity. |
| **Faculties** | **VERIFIED absent** | Zero matches anywhere in schema or code. |
| **Subject Heads** | **VERIFIED absent** | No role, no table. `SchoolUserRole` (Core) and legacy `teachers.role` both cap out at `school_admin/headteacher/deputy_headteacher/teacher/parent` (Core) or `parent/school_admin/teacher/admin` (legacy) — no subject-level authority role exists. |
| **Dean of Studies** | **VERIFIED absent** | Zero matches. |
| **Exam Office** | **VERIFIED absent** | Zero matches. |
| **Timetable** | **VERIFIED absent** | No table, confirmed in Sprint 6A and re-confirmed this session; no "period," "lesson slot," or scheduling concept of any kind exists. |
| **Attendance** | **VERIFIED absent** | No table, confirmed in Stage 0.5 and re-confirmed this session. |
| **Behaviour/Discipline** | **VERIFIED absent as a domain** | The only text matches are a projection-category enum value (`'behaviour'`, `learner_projections.sql:20`) and a `learner_profiles.learning_behaviour` data column (a capability/learning-style descriptor, not a discipline-incident record) — neither is an incident-tracking or pastoral-discipline system. |
| **Pastoral** | **VERIFIED absent** | Zero matches. |
| **House System** | **VERIFIED absent** | Zero matches. |
| **Boarding** | **VERIFIED absent** | Zero matches (the only "boarding" substring hits were false positives on "onboarding"). |
| **Academic Coordinators** | **VERIFIED absent** | No role, no table. |
| **Class Teacher** | **VERIFIED present — the one organizational role that exists** | `teacher_classes.teacher_id` (legacy, ratified canonical by ADR-0002) and `classes.class_teacher_id` (Core, isolated) both model this concept, but as an ownership foreign key, not a named organizational title with any distinct authority beyond "created/owns this class." |
| **Moderation** | **VERIFIED schema exists, VERIFIED zero implementation** | `assessment_quality_flags` (a statistical-anomaly table — `quality CHECK IN ('reliable','suspect','invalid')`, `bimodal`, `all_same`, `teacher_notified`) exists in schema but has **zero application-code references anywhere** (confirmed by repo-wide search — only the generated `database.types.ts` mentions it). This is the closest thing to a Moderation concept in the entire platform, and it is completely dormant. |
| **Invigilation** | **VERIFIED absent** | Zero matches. |

---

## Dependency/Ownership Summary (per this sprint's five determinations)

- **Which domain owns each entity**: Administration (Core-native, RAS-recognized) owns School, Academic Year/Term, Permissions/Membership. Academics (legacy-native, de facto canonical) owns Assessment content, Evidence, the real Learner/Class/Teacher-Assignment data. No entity in this audit was found owned by neither or governed by a third, separate "Academics office" domain distinct from the teacher themselves.
- **Which domains consume each entity**: consistent with Sprint 6A/6B's dependency graph — Learning Compass and the curriculum/SOW pipeline consume their own separate Grade/Subject structures, bypassing both Administration's and Academics' representations entirely.
- **Where duplicate ownership exists**: Learner, Class, Grade, Subject, Enrollment, Promotion, Academic Year/Term — the full list from Question 5.
- **Where identity changes**: at every legacy↔Core boundary — `teachers.id` vs `school_users.id` (resolved, ADR-0002); `students.id` vs `learners.id` (documented, Stage 0.5, not resolved); numeric grade vs `grades.id` vs `sow_grades.id` (Sprint 6B); free-text subject vs `subjects.id` vs `sow_learning_areas.id` vs the hardcoded catalogue (Sprint 6B).
- **Where administrative responsibility ends / academic responsibility begins**: **it doesn't, cleanly, anywhere in the live product.** The class teacher is the admissions officer, the class administrator, the subject authority, and the assessor, in one continuous, unseparated role. This is not itself a defect — it may accurately reflect how a small Kenyan pioneer school actually operates today — but it means any future attempt to introduce Administration/Academics as separate *authorization* domains (as opposed to separate *data tables*, which Core already attempted) would be modeling something that does not exist in current practice, not formalizing something that already does.

---

## What This Document Does Not Do

Per its own scope: it does not recommend building Departments, Timetable, Attendance, or any other missing entity — no evidence gathered here shows a current, unmet need for any of them (no support ticket, product-roadmap note, or user-facing error was found demanding one). It does not choose between the multiple real-world models a school could operate under (single class-teacher-does-everything vs. a fuller departmental structure) — both are consistent with what a CBC Junior/Senior school in Kenya could plausibly be, and this document's job was to report what exists, not to pick a target state.

---

## Validation

Explicitly confirmed this session:
- **0** production files modified
- **0** schema changes
- **0** migrations
- **0** repository, route, or service edits
- **0** tests modified
- Only this document and the implementation log entry were written.

## Stop Condition

STOP after this audit. No implementation performed. No school model invented. No entity recommended for creation without direct evidence of need (none found for any of the absent entities). Awaiting further instruction before any Sprint 6D.
