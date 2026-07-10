# EduNexus Reference School — v1

**Status: v1 — the canonical reference point for all school-data references
across EduNexus.** Any future feature, test, mock integration, or
intelligence-layer work that needs "a real school to point at" should
reference this school rather than inventing new fixture data.

## What v1 is

- **School:** Mwatate Ridge Senior School — fully fictional, CBC Senior
  School (Grade 10–12), seeded as real rows in the platform's existing
  Core schema (`schools`, `learners`, `school_users`, `classes`, ...), not
  a separate sandbox.
- **Identity:** `school.school_name = 'Mwatate Ridge Senior School'`.
  Look it up via `getReferenceSchool()` in [lib/core/school.ts](../../lib/core/school.ts)
  — never hardcode its UUID, since it will differ per environment
  (dev/staging/prod each have their own seeded copy).
- **Scale:** 9 classes (Grade 10/11/12 × East/West/Central), 48 staff
  (with real auth accounts), 405 learners (filled to real class capacity),
  405 guardians, 144 class↔subject↔teacher assignments, 16-subject CBC
  Senior catalogue.
- **Business design:** [01-school-profile-and-structure.md](01-school-profile-and-structure.md)
  through [11-reporting-and-analytics.md](11-reporting-and-analytics.md) —
  11 frozen modules covering org structure, academics, students, staff,
  timetables, attendance/discipline, assessment, finance, communication,
  career services, and reporting. These are frozen: don't reopen them:
  only fix bugs or file an explicit, approved revision.
- **Implementation:** [scripts/reference-school/](../../scripts/reference-school/)
  — idempotent seed scripts (`npm run seed:reference-school`) and an
  integration test suite (`npm run test:reference-school`, 10/10 passing)
  that verifies the seeded data matches the frozen design.

## How to reference it

```ts
import { getReferenceSchool } from '@/lib/core/school'

const school = await getReferenceSchool()
// school.id scopes every other Core query: classes, learners, school_users,
// learner_guardians, learner_enrollments, class_subjects, grade_subjects.
```

## Known gaps (found while building v1, intentionally not patched here)

1. **Assessment pipeline not wired to Core.** `class_assessments.class_id`
   still has a live FK to the legacy `teacher_classes` table, not Core's
   `classes`, even though `lib/core/assessments.ts` is written as if it
   targets Core. `05-seed-assessments.ts` detects this and skips gracefully.
   Fixing it is a platform decision, not a reference-school concern.
2. **Population reconciled to 405, not 960.** Module 1's frozen doc named
   an illustrative population of "960 students," but Module 2's frozen
   45-per-class capacity rule × 9 classes caps real full enrollment at 405.
   The frozen docs were not edited to match — this is a documented
   implementation-time reconciliation (see `04-seed-students.ts`).
3. **Staff role granularity.** The schema's `school_users.role` CHECK only
   allows `headteacher | deputy_headteacher | school_admin | teacher |
   parent` — Module 1's richer role catalogue (Dean of Studies, HoD,
   Career Coordinator, etc.) has no dedicated schema column and is mapped
   onto these four buckets in `03-seed-staff.ts`.

## Lifecycle

- **Re-seed:** `npm run seed:reference-school` (safe to re-run — every step
  checks for existing rows first).
- **Verify:** `npm run test:reference-school`.
- **Tear down:** `npx tsx --env-file=.env.local scripts/reference-school/cleanup.ts`
  (deletes the 48 auth accounts, then the `schools` row, which cascades to
  everything else).

## What comes after v1

Per an explicit decision on this project: **the Learning Intelligence
Layer (Module 12) is deferred until everything else stays settled** — v1
is the operational foundation the intelligence layer will eventually read
from, not something to build alongside it. Any future work that touches
this school should keep `npm run test:reference-school` green.
