# Reference School — Module 10: Career Services

Status: **FROZEN**. Architecture Approved · Business Scope Approved ·
Career Services Domain Approved. No structural changes except bug fixes or
explicitly approved architectural revisions. Future modules must treat
this document as a stable dependency.

Depends on: [[01-school-profile-and-structure]] (frozen — Career
Coordinator role, reporting through Dean of Studies), [[02-academic-structure]]
(frozen — pathways, subjects), [[03-students]] (frozen — students, the
subject of career records), [[09-communication]] (frozen — announcements/
notifications, reused for event scheduling communication, not redefined
here).

## Purpose

Per the original brief: this module builds the **operational structure**
of Career Services only — sessions, visits, mentorship events, industry
partners, and a student's recorded career interests. It deliberately does
**not** build Career Intelligence (matching recommendations, pathway
fit-scoring, predictive guidance) — that is explicitly reserved for
Module 12, even though the live EduNexus platform already has a shipped
Career Intelligence feature elsewhere. This module's job is to give the
Reference School the same *operational* scaffolding a real career
department has, independent of whether any intelligence sits on top.

---

## 1. Career Department Structure

- The Career Coordinator (Module 1 role, reporting through Dean of Studies)
  is the sole staff owner of this module's records — no new role is
  introduced here.
- **Career Sessions:** scheduled talks/workshops, referencing Module 9's
  Announcement mechanism for notifying targeted students/guardians rather
  than this module inventing its own notification path.

## 2. University & TVET Visits

- A **Visit** record: institution name, type (`university`, `TVET`,
  `industry`), date, target audience (Grade Level or specific students),
  attendance roster (referencing Module 3 students, and optionally cross-
  checked against Module 6's attendance mechanism for the visit day if it
  displaces normal lessons).

## 3. Mentorship Events

- A **Mentorship Event** links external mentors (stored minimally — name,
  organization, contact; not modeled as full staff/guardian entities since
  they're not part of the school) to a cohort of students, with session
  notes recorded per event (not per student, unless one-on-one mentorship
  is explicitly the event type).

## 4. Student Career Interests

- A lightweight **Career Interest** record per student: self-reported
  interest areas (free text or a simple tag list, not a scored/derived
  profile — that derivation is explicitly Module 12's job), captured
  during Career Sessions or via a guardian/student-facing form (Module 9's
  messaging channel, not a new one).
- **Explicit non-goal:** this module stores what a student *says* they're
  interested in — it does not infer, score, or recommend anything from
  academic performance or capability data. That synthesis is Career
  Intelligence's job (Module 12), which will read this module's raw
  interest records as one input among several.

## 5. Career Documents & Industry Partners

- **Career Documents:** CVs/portfolios students build in Senior School
  (reusing Module 3's versioned document model, applied here rather than
  reinvented).
- **Industry Partners:** organizations the school maintains a relationship
  with — name, sector, contact, relationship notes — referenced by Visits
  and Mentorship Events rather than duplicated per event.

---

## 6. Edge Cases

- **Student changes pathway after expressing career interest:** the
  Career Interest record is not tied to or invalidated by pathway
  (Module 2's frozen decision that pathway is a student attribute,
  independent of stream) — interests and pathway are separate, both
  student-level facts this module and Module 3 respectively track.
- **Visit cancelled/rescheduled:** the Visit record's date is updated with
  a timeline-style history entry (previous date retained), not silently
  overwritten, consistent with every prior module's pattern.
- **Mentor becomes unavailable mid-program:** the Mentorship Event's
  mentor reference can be reassigned; prior session notes remain attributed
  to whoever actually ran them at the time.

---

## 7. Module Boundaries

**In scope:** Career sessions, university/TVET visits, mentorship events,
student-reported career interests (raw, unscored), career documents,
industry partner directory.

**Explicitly out of scope:** Any matching, scoring, recommendation, or
predictive logic (Career Intelligence — Module 12, and already
independently shipped elsewhere on the live platform, but not part of
this Reference School module), academic performance analysis (Module 11),
communication delivery mechanics (Module 9, reused not redefined).

**Data ownership:** Module 10 owns `career_sessions`, `institution_visits`,
`mentorship_events`, `mentors`, `career_interests`, `career_documents`,
`industry_partners`. It references (never redefines) Module 3's students
and documents model, Module 9's announcement/messaging mechanism.

---

## Module 10 Freeze Record

**Checkpoint 1 — Business rules complete:** Career sessions, visits,
mentorship events, interests, documents, and partners are each fully
specified (Sections 1–5).

**Checkpoint 2 — Ownership clear:** Section 7 states what Module 10 owns
(raw operational/interest data) vs. explicitly excludes (any intelligence
layer), matching the original brief's instruction not to build Career
Intelligence yet.

**Checkpoint 3 — Edge cases documented:** Pathway change independence,
visit rescheduling, and mentor reassignment are each resolved with a
concrete mechanism (Section 6).

**Checkpoint 4 — Module boundaries respected:** No matching/scoring/
predictive logic appears anywhere in this document, even though such a
feature already exists elsewhere on the live platform — this module
stays deliberately operational-only per the frozen roadmap.

**Result: Module 10 Frozen.**
Architecture Approved · Business Scope Approved · Career Services Domain
Approved · Ready for Freeze · **Module Frozen.**

Proceeding to Module 11 — Reporting & Analytics.
