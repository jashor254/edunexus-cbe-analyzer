# Self-Serve School Onboarding — Freeze v1.0

## Status

```
SELF-SERVE SCHOOL ONBOARDING — FROZEN v1.0
```

This document closes the Phase 1–13A programme: a completely unknown principal
can discover EduNexus, create a school, configure it, provision teachers,
admit learners, and run a full academic year — entirely through the product
UI, with zero founder intervention — while teachers simply authenticate and
inherit the institutional structure prepared for them.

Application-side P0 count at freeze: **0**. One external release gate
remains — see [DR-07](#known-external-blocker).

---

## Operating model

- **School admin owns institutional structure**: school profile, academic
  years, terms, classes, subjects, learners, enrollments, class rosters,
  teachers, teacher lifecycle, class/subject teaching assignments, learner
  movement, term transitions, annual progression.
- **Teacher consumes institutional structure**: authenticate → EduNexus
  resolves school identity → *My Teaching* → assigned classes → current
  learners → teaching work. No teacher self-provisioning of institutional
  structure anywhere in the product.
- **Canonical roster** = `learner_enrollments` (never the legacy
  `class_students` table for admin-facing reads).
- **Canonical teaching assignment** = `class_subjects`, current row
  identified by `ended_at IS NULL`, history preserved via closed rows —
  never overwritten in place.

---

## Proven lifecycle

- **School birth**: public signup → `createSchool()` → first
  `school_admin` (server-assigned, never client-selected) → automatic
  academic activation (year, terms, default classes, grade-subjects) →
  School Office.
- **Teacher provisioning/activation**: admin invites by email → pending
  membership → admin may pre-assign classes/subjects before the teacher
  ever logs in → teacher accepts → active membership → *My Teaching*
  already populated, zero teacher writes.
- **Class operations**: per-class admin workspace — current roster,
  teaching coverage, move/withdraw learner, assign/reassign teacher — all
  reachable from Academic Structure, no hidden routes.
- **Learner admission/movement**: manual admission and CSV import both
  create canonical enrollments; a class move closes the old enrollment
  (`ended_at`) and opens a new current one — history never overwritten.
- **Term rollover**: school-level operation — every class's report cards
  finalize before the school's global current-term pointer advances once;
  a class-level failure cannot partially advance the school.
- **Annual progression**: destination class/term/year fully prevalidated
  before any source mutation — a learner can never be withdrawn,
  audit-logged, and left unenrolled anywhere by an incomplete destination.
- **Teacher departure/reinstatement**: departure closes current
  `class_subjects` and deactivates membership without touching history;
  reinstatement reuses the same membership/teacher/profile identity and
  never resurrects old assignments — new work is assigned separately.
- **Multi-teacher class bridging**: two or more subject teachers of the
  same Core class each get an independently-owned legacy bridge identity
  (`teacher_classes` row), keyed by `(coreClassId, teacherId)`, with no
  `class_code` collision.

---

## Historical invariants

- Learner identity is continuous — no re-creation on move, promotion, or
  repeat.
- Enrollment history is preserved — a superseded placement is closed
  (`ended_at`), never deleted or rewritten.
- Teacher tenure history is preserved — a closed `class_subjects` row
  remains queryable after reassignment or departure.
- Educational evidence (marks, evidence, projections) is never rewritten
  by institutional movement — a learner's or teacher's historical academic
  work is untouched by a later move, promotion, departure, or
  bridge-identity creation.

---

## Known external blocker

```
DR-07 — Hosted Supabase Auth SMTP / confirmation email delivery
```

This is Supabase project dashboard/Management API configuration, not
application code. No tool available to engineering sessions in this
environment can configure it. It is the **only** known blocker to real
public self-serve signup.

### DR-07 release gate

```
[ ] Configure hosted Supabase Auth SMTP
[ ] Run real external-email school signup smoke test
[ ] Confirm email → callback → school creation → School Office
```

Do not mark these complete without actually verifying them against a real
mailbox.

### Final smoke test spec (for whoever has dashboard access)

```
1. Open /signup?role=school
2. Use a never-before-used real email
3. Submit signup
4. Receive confirmation email
5. Click confirmation
6. Confirm redirect to school creation
7. Create a synthetic school
8. Land in School Office
9. Add one teacher
10. Assign teacher to one class/subject
11. Teacher activates
12. Teacher logs in
13. My Teaching already shows assigned class
```

Expected founder intervention: **0**.

---

## Known non-blocking technical debt

Evidence-backed only — not feature wishes:

- No teaching-load count shown on the Team roster row.
- No report-card cohort rollup outside the Promotion screen.
- No teacher bulk CSV import.
- `getClassSubjectHistory`'s UI toggle is minimal — no rich timeline
  visualization.
- A theoretical, unaddressed race: `ensureBridgedClass`'s lookup-then-insert
  has no lock/transaction, so two truly concurrent *first*-bridge calls for
  the exact same `(coreClassId, teacherId)` pair could both attempt insert.
  Pre-existing before the Phase 13A fix (which closed the *different-teacher*
  collision, the one actually reproduced); this narrower same-teacher
  double-submit race has never been observed and was explicitly left
  out of scope per that phase's own instruction not to build concurrency
  infrastructure speculatively.

---

## Architecture freeze rule

> Changes to institutional onboarding / school graph after v1.0 require
> evidence from real school usage, a security defect, or a data-integrity
> defect. Speculative convenience is not sufficient justification to reopen
> frozen onboarding architecture.

---

## Scope of this freeze

This freeze covers: onboarding, institutional setup, staff lifecycle,
learner institutional lifecycle, class structures, and term/year
progression.

It does **not** freeze — these remain active product-development domains:

- Blueprint
- Compass
- Career Intelligence
- Assessment intelligence
- Adaptive learning
- Parent/teacher intelligence surfaces

---

## Provenance

Closes the programme documented across this repository's Phase 1–13A work
(school activation, teacher/learner lifecycle, class operations, term/year
transitions, promotion safety, legacy bridge convergence). See
`docs/events/event-catalog.md` and `docs/events/payload-schemas.md` for the
event types this programme introduced, and the test suites listed in each
area's `lib/core/*.test.ts` file for direct behavioral proof.
