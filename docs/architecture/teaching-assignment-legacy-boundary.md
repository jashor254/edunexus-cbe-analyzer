# Teaching Assignment — Canonical Source and Legacy Boundary

**Date:** 2026-08-13
**Status:** In force. Written during the `class_subjects` → Teacher Workspace convergence.
**Predecessor:** `school-controlled-roster-and-teaching-assignment-audit.md` (2026-08-12).

---

## The rule

**`class_subjects` is the canonical institutional teaching assignment.** It is the only
answer to "what has the school assigned this teacher to teach."

```
auth user
  → school_users   (role='teacher', is_active=true)      employment
  → class_subjects (teacher_id = school_users.id)        assignment
  → classes + subjects + schools                          institution
```

Read it through `lib/core/teachingAssignments.ts`. Write it through
`POST /api/core/subjects` (`action:'assign-teacher'`, `requireSchoolAdmin`). Nowhere else.

---

## Four id spaces, three legacy tables

There are **four** representations of "who teaches this class" in the live database.
Only the first is canonical. Confirmed live 2026-08-12/13.

| Table | `teacher_id` points at | Rows (live) | Status |
|---|---|---|---|
| **`class_subjects`** | **`school_users.id`** (a membership) | 144 | **CANONICAL** |
| `classes.class_teacher_id` | `school_users.id` | — | **Not a competitor** — this is the *homeroom/class teacher*, a genuinely different relationship from subject teaching. Both may be set; they mean different things |
| `teacher_classes` | `teachers.id` | 52 | **LEGACY** — teacher-owned private classroom. `teacher_id` NOT NULL, `subject` a free-text column on the class itself |
| `class_teachers` | **`auth.users.id`** | 1 | **ORPHAN** — see below |

`class_subjects.teacher_id` deliberately keys on the **membership**, not the person.
An assignment belongs to an employment relationship, so it ends when the employment
does and the class survives the teacher. Never store a `teachers.id` or an
`auth.users.id` there.

---

## `class_teachers` — do not use, do not extend

A fourth representation exists live and is **not** canonical:

```
class_teachers
  class_id    uuid NOT NULL   -- NO foreign key at all
  teacher_id  uuid NOT NULL   -> auth.users(id)
  subject     varchar(100)    -- nullable free text
  role        varchar(50)
  UNIQUE (class_id, teacher_id, subject)
```

- **1 row**, created 2026-06-12, `subject` NULL.
- **No migration file in this repository creates it.** Only incidental `ALTER`/RLS
  references exist (`20260525_performance_indexes.sql`, `20260525_rls_policies.sql`).
  It was created outside the migration history.
- `class_id` has **no FK**, though its single row does resolve to a Core `classes` row.
- It was missed by the 2026-08-12 audit because that audit enumerated tables from
  `supabase/migrations/`. Enumerate from the live database instead.

**Its only reader is broken.** `isTeacherOfLearner()`
([lib/api/middleware.ts:87](../../lib/api/middleware.ts)) walks
`learner_enrollments → class_teachers → teachers`, taking `class_teachers.teacher_id`
(an `auth.users.id`) and looking it up as a `teachers.id`. Proven against live data:

```
class_teachers.teacher_id matching teachers.id    : 0
class_teachers.teacher_id matching auth.users.id  : 1
```

The function therefore **always returns `false`**.

Five of its six callers are in `_frozen/`. **One is live**:
[app/api/learner-intelligence/career/route.ts:40](../../app/api/learner-intelligence/career/route.ts),
where it gates teacher access to a learner's career intelligence. It fails **closed** —
teachers are wrongly denied; nobody gains access they shouldn't have. So this is a
correctness defect, **not** a security hole.

> **NAMED FOLLOW-UP — broken career-intelligence teacher authorization.**
> `isTeacherOfLearner()` is non-functional and silently denies every teacher on
> `GET /api/learner-intelligence/career`. Deliberately **not fixed** during the
> convergence phase: mixing an authorization fix into a workspace diff is exactly
> what the phase's scope check exists to catch. The fix is small (drop the second
> hop and match `teachers.user_id`, or better, re-point the whole function at
> `class_subjects`/`learner_enrollments` and delete the `class_teachers` dependency),
> but it belongs to a bounded authorization phase with its own tests. Until then,
> treat any "teacher cannot see career intelligence" report as this bug.

Do not add readers or writers to `class_teachers`. It should be retired once
`isTeacherOfLearner` is re-pointed.

---

## Where `teacher_classes` remains legitimate

`teacher_classes` is **not** deleted, **not** migrated, and **not** canonical for
institutional assignment. It stays where it is genuinely the right answer:

| Site | Why it stays |
|---|---|
| `lib/teacherWorkspace/classListProjection.ts` | Lists a teacher's own private classes. Correct for a Solo Teacher; framed as "My Own Classes" for a school teacher |
| `lib/teacherWorkspace/classDetailProjection.ts` | Same, per class |
| `lib/teacherWorkspace/classInsightsProjection.ts` | Almost entirely evidence-derived; the evidence layer is legacy-keyed (below) |
| `lib/teacherWorkspace/dashboardProjection.ts` (`activeClasses`) | The private-class count. Kept **separate** from `teachingContext`; never summed with it |
| `POST /api/teacher/classes` | Solo Teacher class creation. Withdrawn from school teachers in the UI, still live for solo |
| `POST /api/teacher/classes/[classId]/students` | Solo Teacher roster building |
| `lib/core/permissions.ts::requireClassTeacher` | Gates legacy teaching artifacts. Has **no** Core equivalent yet (`requireClassSubjectAssignment` is unbuilt) |
| `class_assessments.class_id`, `class_students`, `assignments`, `compass_sessions`, `class_resources`, `class_calendar_events`, `class_announcements` | All FK to `teacher_classes(id)`. The evidence/gradebook/Compass id space is legacy and cannot redirect until it is ported or bridged — see `teacher-workspace-core-cutover-readiness.md` §5 |

**The invariant that must not be reversed:** a private `teacher_classes` row must never
be presented as an institutional assignment. A school teacher with zero `class_subjects`
rows sees zero assignments and an honest empty state — never a fallback to their own
private classes. Pinned by `lib/core/teachingAssignments.test.ts` test 11.

---

## Teacher self-join — CLOSED 2026-08-13

`POST /api/teacher/profile` called `ensureSchoolMembership(userId, schoolName)`, which
matched the teacher's free-text school name case-insensitively and, on a hit, inserted a
`school_users` row via `repos.schools.addSchoolUser(...)` — `is_active` defaulting to
**true**, `invited_by` NULL, `joined_at` set, **no invitation and no administrator
consent**. Since `resolveSchoolCoverage()` grants coverage on any active `role='teacher'`
membership at an entitled school, typing a school's name was enough to inherit its paid
entitlement.

**Proven live before removal**, against a synthetic entitled school:
`resolveSchoolCoverage()` returned `'covered'` (assertion `actual: 'covered'`,
`expected: 'not_covered'`). This was an authorization boundary, not an onboarding
nicety.

Replaced by `recordSchoolNameForReconciliation()`, which **writes nothing** and only logs
(`matched_school_id`, `awaiting_admin_link`) so a founder retains the reconciliation
backlog of teachers who named a school EduNexus has not yet linked them to. The profile
`school` field survives as descriptive employment text with no authority.

Membership now originates only from: `createSchool()` (creator → `school_admin`),
`inviteSchoolMember()` (`requireSchoolAdmin`-gated), and `acceptTeacherInvitation()`
(role read from the admin-written row, never from the invitee).

Pinned by `lib/testing/teacherSelfJoin.http.integration.test.ts` (11 tests), which failed
5/11 before the fix and passes 11/11 after — including the control case that an
**admin-provisioned** teacher at the same school *is* still covered.

**Historical footprint (read-only, untouched):** 39 active memberships carry the
self-join signature (`invited_by` NULL, `joined_at` set, `role='teacher'`). **All 39 are
at schools with `school_entitlement_status='none'`**, so none is currently drawing paid
coverage. They need evidence-based review before any mutation — a separate data-hygiene
pass, not this one.

---

## Not solved here

- ~~**Assignment history.**~~ **CLOSED 2026-08-13** (migration
  `20260813120000_class_subjects_assignment_history.sql`). `class_subjects` gained
  `started_at` / `ended_at`; the total `UNIQUE(class_id, subject_id)` was replaced by a
  partial unique index `WHERE ended_at IS NULL`, so many historical tenures may share a
  class+subject while at most one is current. Replacement closes the outgoing row and
  inserts a new one instead of upserting over it, and
  `deactivateSchoolMembership()` now closes a departing teacher's current assignments.
  All 144 live rows were backfilled as current with `started_at = created_at`. Pinned by
  `lib/core/teacherLifecycle.test.ts` (22 tests).

  **Vacancy** is the absence of a current row — no placeholder teacher, no sentinel id.
  **Co-teaching remains unsupported**, deliberately: the partial index still permits only
  one current teacher per class+subject, and uniqueness was not weakened for a capability
  no pilot school has asked for.
- ~~**Auto-provisioning.**~~ **CLOSED 2026-08-13.** Teacher routes now call
  `resolveExistingOwningSchool()`, which resolves an active membership or returns
  `null` and **never creates a school**. `resolveOwningSchool()` is retained but
  `@deprecated`/DORMANT with zero production callers — kept only because the
  `provision_teacher_school` RPC's `service_role`-lockdown tests exercise it. A private
  class belonging to no institution now carries `school_id = NULL`, which is the honest
  value (both columns are nullable). Proven by `lib/core/autoProvisionCleanup.test.ts`
  (11 tests) and the rewritten
  `app/api/teacher/classes/institutionOwnershipEnforcement.http.integration.test.ts`.
- **Assessment authorization.** Still `requireClassTeacher` on `teacher_classes`
  ownership, with no school-membership check and no `class_subjects` branch.
- **SOW context.** `class_subjects` and the KICD curriculum catalogue are different id
  spaces; pre-population needs a subject → learning-area resolution.
- **Historical synthetic schools.** 6 rows carry
  `provisioning_source='teacher_first_write_auto_provision'`, created 2026-08-03/04.
  All are orphaned test residue (0 members, 0 classes, 0 learners, 0 assignments, 0
  entitlement, creators deleted) — **no real school was ever auto-provisioned in
  production.** Left in place; a data-hygiene pass owns their removal.
- **Fixture cleanup is FK-order-sensitive.** `class_subjects.teacher_id → school_users`
  and `teacher_classes.school_id → schools` are both `ON DELETE NO ACTION`, so deleting
  a fixture school silently fails while either row survives. Any test that creates a
  school must clear `class_subjects` and `teacher_classes` first, and must log delete
  errors rather than discard them — silent cleanup failure is how synthetic schools
  accumulate unnoticed.
