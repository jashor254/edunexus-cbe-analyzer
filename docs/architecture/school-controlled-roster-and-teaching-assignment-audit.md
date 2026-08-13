# School-Controlled Roster & Teaching Assignment Audit

**Date:** 2026-08-12
**Type:** Read-only trace. No code changed, no migration written, no table touched, no invitation flow removed.
**Predecessors this builds on (and does not re-litigate):** `school-first-operating-model-audit.md` (2026-08-03), `teacher-workspace-core-cutover-readiness.md` (2026-08-03), `canonical-domain-evolution-blueprint.md`. Where this audit contradicts the Evolution Blueprint, it says so explicitly (§3).

---

## 1. Executive Verdict

**The teaching-assignment domain already exists, is correct in shape, and is almost entirely unconsumed.**

`class_subjects` (`school_id`, `class_id`, `subject_id`, `teacher_id → school_users.id`) is a real, admin-gated, school-owned teaching-assignment table. It has a service (`assignSubjectTeacher`), an API (`POST /api/core/subjects` action `assign-teacher`), and — contrary to what the 2026-08-03 audits assumed — **a working admin UI** at `app/teacher/core-office/academic/structure/page.tsx`. A school admin can, today, create Grade 7 East and assign Mathematics → Peter to it.

What does not exist is the other half of the loop: **nothing reads that assignment back to a teacher.** There is no "list the classes assigned to this teacher" query anywhere in the codebase — only `listClassSubjects(classId)`, the inverse. The teacher dashboard reads `teacher_classes WHERE teacher_id = <teachers.id>`, the legacy teacher-owned private-classroom table, and every number a teacher looks at (averages, gradebook, risk, Compass) is keyed to the legacy id space.

So Peter can be assigned, and Peter will not see it.

The second structural finding is smaller but harder: **`school_users.user_id` is `NOT NULL REFERENCES auth.users(id)`.** A school admin cannot provision a teacher who has not already signed up. The invitation flow returns `{status:'no_account'}` and stops. Admin-first provisioning, as specified in §7 of the brief, is not representable in the current schema.

Everything else in the brief's locked model — school-owned classes, class survives teacher, learner attached to class not teacher, entitlement on the school not the seat, identity survives employment, history survives people — is **already true in Core**.

**Verdict: no major rebuild. One missing read direction, one nullable column, one deactivation cascade, and a UI redirect.**

---

## 2. Current Institutional Data Model

The five concepts in §2 of the brief are separated — in Core. They are collapsed in Legacy. Both are live.

| Concept | Core table (school-first) | Legacy table (teacher-first) | Separated? |
|---|---|---|---|
| **A. Identity** — who is Peter | `auth.users` + `profiles` (`role`, `secondary_role`) + `teachers` (business identity) | same `teachers` row | Yes — three distinct rows, contract stated in `lib/core/teacherOnboarding.ts:9-17` |
| **B. Employment / membership** — where Peter works | `school_users` (`school_id`, `user_id`, `role`, `is_active`, `invited_by`, `joined_at`), `UNIQUE(school_id,user_id,role)` | `teachers.school` — a **free-text string** | Yes in Core; Legacy has no membership concept at all |
| **C. Teaching assignment** — what Peter teaches | `class_subjects` (`school_id`, `class_id`, `subject_id`, `teacher_id → school_users.id`), `UNIQUE(class_id,subject_id)` | `teacher_classes.subject` — a **free-text NOT NULL string on the class itself** | Yes in Core; Legacy conflates class + subject + teacher into one row |
| **D. Class** — Grade 7 East | `classes` (`school_id`, `grade_id`, `stream_id`, `academic_year_id`, `class_teacher_id` nullable, `capacity`, `display_name`) | `teacher_classes` (`teacher_id` **NOT NULL**, `subject` NOT NULL, `class_code`, `school_id` nullable) | Yes in Core; Legacy class cannot exist without a teacher |
| **E. Learner enrollment** — Jane in 7 East | `learners` + `learner_enrollments` (`learner_id`, `class_id`, `term_id`, `academic_year_id`, `status`), `UNIQUE(learner_id,term_id)` | `students` + `class_students` (`class_id → teacher_classes`, `student_id`) | Yes in Core; Legacy roster hangs off the teacher's private class |

Plus, correctly separated and worth naming because the brief asks about them:

- **Subject catalogue** — `subjects`, a global seeded CBC list (32 rows, `code` unique, `category` ∈ pre_primary/primary/junior_secondary), public-read RLS.
- **School subject offering** — `grade_subjects` (`school_id`, `grade_id`, `subject_id`, `is_compulsory`). This is the school-specific layer over the global catalogue.
- **Entitlement** — `schools.school_entitlement_status` + expiry, resolved by `lib/core/schoolEntitlement.ts`. Not a per-teacher seat.

**Diagram of what is actually wired today:**

```
                    ┌──────────────────────────────────────┐
 CORE (school-first, admin-gated, correct, mostly unread)   │
                    │                                       │
 schools ──► academic_years ──► terms                       │
    │                                                       │
    ├──► school_users ◄─────────── auth.users (NOT NULL FK) │
    │        │  (membership; is_active = the whole lifecycle)│
    │        ▼                                              │
    ├──► classes ──► class_subjects ──► subjects            │
    │      │            ▲ teacher_id                        │
    │      │            └── points at school_users.id       │
    │      ▼                                                │
    └──► learner_enrollments ──► learners ──► learner_guardians
                    │                                       │
                    └───────────────────────────────────────┘
                                    ╳  no read path
                                    ╳  to the teacher UI
 ───────────────────────────────────────────────────────────
 LEGACY (teacher-first, what the teacher actually sees)
                                                            
 teachers ──► teacher_classes ──► class_students ──► students
                 (teacher_id NOT NULL,                      
                  subject = free text)                      
                      │                                     
                      ├──► class_assessments ──► learner_marks
                      ├──► assignments / submissions (gradebook)
                      └──► compass_sessions                 
                                                            
 schemes_of_work / lesson_plans / records_of_work            
   └── teacher_id only. `school` is a TEXT column.           
```

---

## 3. Class Ownership Verdict

**Split. Core resolved; Legacy violates the rule; Legacy is the one in use.**

Answering the brief's ten questions per table:

| Question | Core `classes` | Legacy `teacher_classes` |
|---|---|---|
| Who owns the class? | School (`school_id`) | Nominally the teacher (`teacher_id` NOT NULL) |
| Is `school_id` canonical? | Yes (nullable in the DDL, but every write path sets it) | No — added 2026-08-02 as a **nullable backfill column**, historical rows are NULL |
| Is `teacher_id` mandatory? | No — `class_teacher_id` is nullable | **Yes, NOT NULL** |
| Can the class exist without a teacher? | **Yes** | **No** |
| What happens if the teacher changes? | Update `class_subjects.teacher_id` / `classes.class_teacher_id` | Nothing exists to change it — the class *is* the teacher's |
| Does deactivating a teacher threaten the class? | No, but see the cascade gap below | The class becomes orphaned, unowned, unreachable |
| Are learners attached to class or teacher? | **Class** (`learner_enrollments.class_id`) | Class — but the class is the teacher's, so transitively the teacher |
| Multiple teachers per class? | **Yes**, one per subject | No |
| One teacher, many classes? | Yes | Yes |
| Different teachers, different subjects, same class? | **Yes** | **No** — subject is a column on the class |

**The desired principle "Grade 7 East belongs to School X, Peter merely has an assignment there" is structurally true in `classes`/`class_subjects` and structurally false in `teacher_classes`.**

This directly contradicts `canonical-domain-evolution-blueprint.md`, which designates `teacher_classes` as the *evolution target* for the Class domain on file-count grounds (34 files vs 1). That call was made on usage evidence, not on institutional correctness, and it is incompatible with the model now locked in this brief. **Flagging it, not resolving it** — but the two documents cannot both stand.

**Confirmed cascade gap (unchanged since 2026-08-03, re-verified this pass):** `deactivateSchoolUser(schoolUserId)` (`lib/core/school-users.ts:98`) flips `school_users.is_active = false` and nothing else. `class_subjects.teacher_id` and `classes.class_teacher_id` have no FK cascade, no trigger, and no application-layer cleanup. A departed teacher's assignment rows point at their now-inactive membership indefinitely.

---

## 4. Subject Model Verdict

Three-layer, and correct:

1. **Global catalogue** — `subjects`, seeded once, `UNIQUE(code)`, `category`, `is_core`. Grade-aware only via `category` (pre_primary / primary / junior_secondary). Public-read.
2. **School offering** — `grade_subjects` (`school_id`, `grade_id`, `subject_id`, `is_compulsory`). Seeded per school by `seedGradeSubjectsForSchool()`, admin-editable.
3. **Assignment** — `class_subjects` binds subject + class + teacher.

- Not teacher-owned. Not a string. Grade-aware (via `grade_subjects` + `category`).
- **Not pathway-aware.** No senior-secondary pathway modelling in `subjects` — the catalogue tops out at Grade 9 (`junior_secondary`), and `20260707_senior_secondary_grades.sql` extended `grades` but not the subject catalogue's category CHECK. For CBC Senior (Grade 10–12) pilot schools this is a real gap.
- Legacy's subject model is `teacher_classes.subject TEXT NOT NULL` plus `teaching_subject` and `selected_subjects text[]` — three competing subject representations on one legacy row.

**Can EduNexus represent the brief's example without duplicate institutional classes?**

```
7 East (one classes row)
  class_subjects: (7East, Mathematics, Peter)
  class_subjects: (7East, Integrated Science, Mary)
8 North (one classes row)
  class_subjects: (8North, Mathematics, Peter)
7 West (one classes row)
  class_subjects: (7West, Integrated Science, Mary)
```

**Yes. Exactly, with no duplication.** `UNIQUE(class_id, subject_id)` permits this and prevents nothing needed. Verified against `lib/core/classes.workflow.test.ts:136-158`, which already round-trips it.

---

## 5. Teacher Provisioning Today

Every way a person becomes a teacher at a school:

| # | Flow | Entry point | Who controls school | role | status | subjects | classes |
|---|---|---|---|---|---|---|---|
| 1 | **Admin invites existing account** | `POST /api/core/teachers {action:'invite'}` → `inviteSchoolMember()` | **Admin** (`requireSchoolAdmin`) | **Admin** (server allowlist `INVITABLE_SCHOOL_ROLES = ['teacher','school_admin']`) | Admin creates `is_active:false` (pending) | nobody | nobody |
| 2 | **Teacher accepts** | `POST /api/core/teachers {action:'accept'}` → `acceptTeacherInvitation()` | invitation's own row | **read from the invite row, never from the body** | teacher flips to active | teacher supplies a free-text `subject` onto their `teachers` row (cosmetic, non-institutional) | nobody |
| 3 | **Admin assigns subject+class** | `POST /api/core/subjects {action:'assign-teacher'}` → `assignSubjectTeacher()` | Admin | — | — | **Admin** | **Admin** |
| 4 | **Teacher self-signup** | `app/(auth)/signup` role=teacher, `app/auth/callback` | **nobody** — creates a `teachers` row with a free-text `school` string and no membership | — | live immediately | self | self |
| 5 | **Auto-provisioning on first write** | `POST /api/teacher/classes` → `resolveOwningSchool()` → `provision_teacher_school()` RPC | **the teacher** — invents a school named `"{name}'s School (pending setup)"` and makes themselves its **`school_admin`** | **self** | active | self | self |
| 6 | **Fuzzy name attach** | `POST /api/teacher/profile` → `ensureSchoolMembership()` | free-text school-name similarity | inferred | active | self | self |
| 7 | **Founder/ops** | `app/admin/core-schools/new`, `app/admin/schools/*` | founder (`requireGrowthUser`, server-only allowlist) | founder | founder | — | — |
| 8 | **Bulk teacher CSV** | **does not exist** | — | — | — | — | — |

**Flows where the teacher controls institutional facts that belong to the school: #4, #5, #6.**

#5 is the sharpest. `provision_teacher_school` is `SECURITY DEFINER`, correctly locked to `service_role` since 2026-08-04 (an earlier PUBLIC-execute hole was closed), but its *purpose* is still to manufacture a one-teacher fictional school and grant that teacher `school_admin` over it. It also selects the first active `school_users` row **regardless of role** — a user whose only membership is `role='parent'` at a school would have that school returned as the owner of their new classes.

Learner provisioning, by contrast, is now clean: `POST /api/core/learners` and `POST /api/core/learners/import` are both `requireSchoolAdmin`-gated, and the roster import (`lib/core/learnerRoster.ts`, ≤1500 rows, CSV) explicitly refuses to write evidence, guardians, or classes.

---

## 6. Teaching Assignment Domain — Is There a Canonical Representation?

**Yes. `class_subjects` is authoritative, and it is the only real candidate.**

Enumerating every competing representation found:

| Representation | What it is | Verdict |
|---|---|---|
| **`class_subjects`** | `(school_id, class_id, subject_id, teacher_id→school_users.id)`, `UNIQUE(class_id,subject_id)`, admin-gated write, indexed on all four | **CANONICAL.** Subject-teacher assignment |
| `classes.class_teacher_id` | nullable FK → `school_users.id` | **Not a competitor** — this is the *homeroom/class teacher*, a genuinely different relationship. `academicBridge.ts:128-139` treats it as the class-level assignment gate. Two relationships, no double-write found |
| `teacher_classes.teacher_id` | NOT NULL FK → `teachers.id` | **Legacy ownership, not assignment.** Where every teacher-facing read currently goes |
| `teacher_classes.subject` / `teaching_subject` / `selected_subjects[]` | free-text strings | Legacy. Three overlapping subject fields on one row |
| `teachers.subject` / `teachers.grade_levels[]` | free text on the person | **Profile decoration, not assignment.** Set by the teacher at signup |
| `class_resources` / `class_calendar_events` / `class_announcements` | all FK → `teacher_classes(id)` | Consumers of the legacy class, not assignment representations |

**Missing columns on `class_subjects`, measured against the brief's §11 sketch:**

- no `academic_year_id` (year scoping is inherited from `classes.academic_year_id`)
- no `status` / `is_active` / `ended_at` — **assignment history is not representable**
- no `assigned_at` / `assigned_by`
- `teacher_id` is NOT NULL — **a class-subject cannot exist as "unstaffed, needs a teacher"**

**Consumption:** `class_subjects` appears in exactly 19 lines across 4 non-test, non-worktree files — `lib/database.types.ts`, `lib/repositories/teacher.repository.ts` (the two methods), `lib/teacherWorkspace/dashboardProjection.ts` (in a comment saying it *should* be the source), and the reference-school seed scripts. **It is written by one admin UI and read by nothing a teacher sees.**

---

## 7. Account Before / After Provisioning

**Admin-first provisioning of a teacher without an account is NOT supported. This is a schema constraint, not a UI gap.**

`school_users.user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` (`20260629_core_foundation.sql:219`).

The invitation flow already documents this honestly rather than papering over it:

- `findAuthUserByEmail(email)` (`teacher.repository.ts:480`) — comment reads *"there is no way to reference someone who hasn't signed up yet."*
- `inviteSchoolMember()` returns `{status:'no_account', email}` and writes nothing.
- The Team UI shows: *"No EduNexus account exists for that email yet — ask them to sign up at edunexus.co.ke first, then invite this same address."*

So the brief's §7 sequence — admin types Peter's name, email, subjects, classes; Peter signs up later; EduNexus recognizes and attaches — **cannot happen today.** Peter must sign up first, then be invited, then accept, then be assigned.

Per the brief's instruction, no placeholder auth users are proposed here. Note only that `learner_guardians.user_id` is *nullable* — the same schema already models "a person the school knows about who may not have an account" one table over. That is the shape of the eventual answer; it is not a recommendation to make it now.

---

## 8. Existing Account Case

**Fully supported. This is the strongest part of the current model.**

`school_users` is `UNIQUE(school_id, user_id, role)` — not unique on `user_id`. One `auth.users` row can hold memberships at many schools simultaneously, in different roles, active and inactive.

- Peter is a Solo Teacher → invited → gains a `school_users` row. His `teachers` row, his `schemes_of_work`, his tokens, his subscription are untouched. `acceptTeacherInvitation()` reuses the existing `teachers` row if present (`teacherOnboarding.ts:193-202`).
- Peter is a parent → invited as teacher → gains a *second* `school_users` row. No duplicate identity.
- Peter teaches at School A → invited to School B → two active memberships.

**No duplicate-Peter path exists.** The invite is keyed by email → `auth.users.id`.

**But two resolvers silently pick an arbitrary school:**

- `repos.schools.findSchoolUserByUserId(userId)` — unscoped, `.single()`, used by `resolveOwningSchool` **and by `GET /api/core/my-membership`**, which is what every admin screen calls to learn "which school am I acting for." Its own comment concedes it "picks one membership if a user belongs to more than one school."
- `findSchoolUser(userId, schoolId)` — correctly scoped, filters `is_active=true`, but uses `.single()`, which throws on two active rows for the same school (schema-legal at different roles).

`resolveSchoolCoverage` is the one resolver that got this right: it *scans* memberships rather than assuming one (`school.repository.ts:110-121`).

---

## 9. Teacher Who Is Also a Parent

**Contexts are separated, and the money is separated correctly.**

`lib/payments/access.ts:83-127`:

```
profiles.role + profiles.secondary_role
  isTeacherRole = primary=='teacher' || secondary=='teacher'
  if isTeacherRole && FEATURE_ACCESS[f].teacher == 'free':
      resolveSchoolCoverage(user)          ← school entitlement
      covered → free, tier 'teacher'
      not covered → FALL THROUGH
  parent-tier features (clinic, compass, career) → never hit the school path
  → personal subscription → first-SOW-free → token balance
```

Against the brief's five prohibitions:

| Must not | Actual |
|---|---|
| destroy parent role/context | **Safe.** Provisioning writes `school_users` only. `acceptTeacherInvitation` deliberately writes `profiles.role='teacher'` and never `school_admin` — commented at `teacherOnboarding.ts:204-211` |
| convert Family subscription | **Safe.** `subscriptions` is never read or written by any provisioning path |
| merge payment wallets | **Safe.** `token_balances` untouched |
| school pays for Peter's family use | **Safe.** Parent-tier features skip the coverage branch entirely |
| Peter pays for school teaching use | **Safe when covered.** Falls through to personal pricing when the school is not entitled — correct and deliberate ("absence of proof is never treated as coverage") |

One real risk, already noted in §5: `provision_teacher_school` picks the first active `school_users` row **without filtering role**, so a parent-only membership can become the owning school of a teacher's institutional writes. `resolveSchoolCoverage` does not have this bug; the provisioning RPC does.

`profiles.role` / `profiles.secondary_role` are now trigger-protected against self-promotion to `admin` (`20260812190000`).

---

## 10. Admin Capability Matrix

| Capability | Service | API | UI | Classification |
|---|---|---|---|---|
| List teachers | `listTeacherMemberships()` | `GET /api/core/teachers?list=true` | `app/teacher/core-team` | **WORKING** |
| Add teacher (has account) | `inviteSchoolMember()` | `POST …{action:'invite'}` | core-team | **WORKING** |
| Add teacher (no account) | — | — | — | **MISSING — schema blocked** (§7) |
| Edit teacher details | — | — | — | **MISSING** (name/phone live on the teacher's own `teachers` row, self-edited) |
| Change teacher role | `updateSchoolUserRole()` | via re-invite at a new role | core-team (re-invite) | **PARTIAL** — works, but expressed as "invite again," not "change role" |
| Deactivate teacher | `deactivateSchoolMembership()` / `deactivateSchoolUser()` | `POST /api/core/teachers {action:'deactivate'}` | `core-team` → "Remove access" | **WORKING** (closed 2026-08-13) — also closes the teacher's current `class_subjects` assignments; self-removal refused |
| Reactivate teacher | `addSchoolUser()` upserts `is_active:true` | via re-invite | core-team | **PARTIAL** — reachable only by re-inviting |
| Assign subject to teacher | `assignSubjectTeacher()` | `POST /api/core/subjects {action:'assign-teacher'}` | `core-office/academic/structure` | **WORKING** |
| Assign class to teacher | same call | same | same | **WORKING** |
| Change subject/class assignment | same call (upsert) | same | same | **WORKING but destructive** — overwrite, no history |
| Unassign (leave class-subject vacant) | — | — | — | **MISSING** — `teacher_id` is NOT NULL |
| See a teacher's current assignments | — | — | — | **MISSING** — only the inverse (`listClassSubjects(classId)`) exists |
| Create class | `createClass()` | `POST /api/core/classes` | structure page | **WORKING** |
| Auto-initialize classes | `activateSchool()` | `POST /api/core/school` | school creation | **WORKING** — years, terms, streams, classes, settings in one pass |
| Create learner | `admitLearner()` | `POST /api/core/learners` | `core-admissions` | **WORKING** |
| Import learners (CSV) | `importLearnerRoster()` | `POST /api/core/learners/import` | `core-admissions/import` | **WORKING** |
| Promote learners | `runAnnualPromotion()` | `POST /api/core/promotions` | `core-office/academic/promotion` | **WORKING** |
| Transfer learner | `transferLearner()` | `POST /api/core/transfers` | `core-office/academic/transfer` | **WORKING** |
| Grant school entitlement | `setSchoolEntitlement()` | `PATCH /api/admin/schools/[id]/entitlement` | `app/admin/schools` | **WORKING — founder only** |

Admin surfaces are role-gated correctly (`ADMIN_TIER_ROLES`) but live under `/teacher/*` URLs. Addressing problem, not permissions problem.

---

## 11. Teacher Capability Matrix + Login Reality

**Where "My Classes" comes from — traced end to end:**

```
app/teacher/dashboard/page.tsx
  → getTeacherDashboardProjection(userId)        lib/teacherWorkspace/dashboardProjection.ts:53
      → teachers WHERE user_id = userId
      → teacher_classes WHERE teacher_id = teachers.id   ← "activeClasses"
      → schemes_of_work WHERE teacher_id                 ← "activeSchemes"

GET /api/teacher/classes
  → resolveTeacher(userId)
  → getTeacherClassListProjection(teacher.id)
      → teacher_classes WHERE teacher_id
```

**Answer to the brief's §13:** the teacher dashboard shows **only classes they created themselves.** Not assigned classes. Not school classes. Not a mixture — a single legacy source. `class_subjects` is never consulted on any teacher-facing read path.

`dashboardProjection.ts:11-16` says so in its own header: redirecting this projection's source to `school_users`/`class_subjects` is "the later, separate Core-redirect step."

| Teacher action | Should require | Actual |
|---|---|---|
| See my classes | assignment made by the school | **inverted** — the teacher made the class |
| See my subjects | assignment | not modelled on the read path at all |
| Create a class | never (school teacher) | **allowed**, and auto-provisions a school if they have none |
| Create a learner | never | **allowed** (`POST /api/teacher/classes/[id]/students`) |
| Record lesson/assessment | school membership + assignment | `requireClassTeacher` → `teacher_classes.teacher_id` equality only, **no membership check** |
| Take attendance | membership | correct on Core (`requireSchoolMembership`) |
| Publish reports | never (admin's) | legacy `generate-reports` has no publish gate |
| Change own role/assignments | never | cannot via Core API; **can** via flows #4/#5/#6 in §5 |

---

## 12. Assignment Cardinality

Proven against schema + `lib/core/classes.workflow.test.ts`:

| Shape | Core | Legacy |
|---|---|---|
| One teacher → many classes | **YES** | yes |
| One teacher → many subjects | **YES** | one subject per class row |
| One class → many teachers | **YES** (one per subject) | **NO** |
| One class → many subjects | **YES** | **NO** |
| Teacher replacement on a class-subject | **YES, but destructive** — `upsert onConflict:'class_id,subject_id'` overwrites `teacher_id` in place. No prior-holder row survives | n/a |
| Co-teaching (two teachers, same class+subject) | **NO** — `UNIQUE(class_id,subject_id)` + single `teacher_id` column | **NO** |
| Vacant post (class-subject with no teacher) | **NO** — `teacher_id NOT NULL` | **NO** |

The brief's canonical example —

```
7 East: Mathematics → Peter, English → Grace, Integrated Science → Mary
```

— is **fully supported today in Core** and **impossible in Legacy**, which would require three separate `teacher_classes` rows named "Grade 7 East," each owned by a different teacher, each with its own roster.

**Architecture assuming class → one teacher: `teacher_classes`, and every one of the 128 files that reads it.**

---

## 13. SOW / Lesson Plan / Record of Work Ownership

**Purely teacher-owned. No institutional attachment whatsoever.**

| Table | Owner column | School | Class | Academic period | RLS |
|---|---|---|---|---|---|
| `schemes_of_work` | `teacher_id → teachers.id` NOT NULL | **`school` — a TEXT column** | none | `term int`, `year int` (plain integers, no FK) | `teacher_id = auth_teacher_id()` |
| `lesson_plans` | `teacher_id → auth.users.id` | none | none | via `sow_id` | `teacher_id = auth.uid()` |
| `records_of_work` | `teacher_id → teachers.id` NOT NULL | **`school` — a TEXT column** | none, only `scheme_id` | `term text`, `year int` | `teacher_id = auth_teacher_id()` |

`POST /api/sow/generate` takes `{learningArea, grade, curriculumMode}` from the request body. Nothing is derived from an assignment, a class, a term, or a school.

**Answer to the brief's §14:** the teacher manually selects **all** institutional context. Every field a SOW needs — subject, grade, term, year, curriculum mode — already exists on the assignment side (`class_subjects.subject_id`, `classes.grade_id`, `terms.is_current`, `school_settings.curriculum_type`). Pre-population is a pure read-path change requiring no schema work. It is not built.

**Answer to the brief's §15 (does the institution retain artifacts when Peter transfers?):** **No.** RLS is `teacher_id = auth_teacher_id()` with no school branch. Peter's SOWs, lesson plans and records of work remain in the database, attached to Peter, and become invisible to the school the moment he leaves. Nobody at the school can read them, and a replacement cannot inherit them. The rows survive; the institution's access to them does not.

This is the single largest divergence between the current model and "the school owns the structure."

---

## 14. Assessment Authorization

```
canManageAssessment(client, schoolId, classId)      permissions.ts:142
  → admin-tier membership?  → allow
  → requireClassTeacher(client, classId)            permissions.ts:98
       → teacher_classes WHERE id=classId AND teacher_id=<my teachers.id>
```

**No school-membership check on the teacher branch. No `class_subjects` check anywhere.** Authorization for teaching work is teacher-self-ownership of a legacy row.

Read access is more nuanced and actually correct in intent: `canViewLearner` / `canManageLearnerRecord` derive teacher access from `class_students → teacher_classes` (current teaching relationship) plus the legacy `students.teacher_id`-of-record column, mirroring the RLS functions. That correctly implements CLAUDE.md's "`teacher_id` is who entered this, not who may read this."

**The gap the brief asks about:** "does 'teacher belongs to school' implicitly expose too much?" — the opposite is true. Membership grants nothing on the assessment write path; *legacy class ownership* grants everything. A teacher cannot assess a learner in a class assigned to them via `class_subjects`, because no code path consults it. And an admin-tier member of any school can `canManageAssessment` on **any** `classId`, since the admin branch never verifies that the class belongs to `schoolId`.

There is **no `requireClassSubjectAssignment` primitive.** `canManageClass` is admin-only despite a doc comment implying otherwise.

---

## 15. Teacher Transfer Out (Peter Leaves School A)

Against the brief's ten required outcomes:

| Required outcome | Actual | Mechanism |
|---|---|---|
| Peter's identity survives | **YES** | nothing deletes `auth.users` / `profiles` / `teachers` |
| Personal context survives | **YES** | `subscriptions`, `token_balances` untouched |
| Historical school records survive | **YES** | `learner_marks`, `class_assessments`, `learner_evidence` keep `teacher_id` as attribution |
| Previous SOWs survive | rows yes, **school access no** | §13 |
| Lesson plans survive | rows yes, **school access no** | §13 |
| RoW survives | rows yes, **school access no** | §13 |
| Assessments/evidence survive | **YES** | evidence is immutable-after-creation by DB trigger |
| Peter loses school-covered access | **YES, ≤60s lag** | `resolveSchoolCoverage` requires `is_active=true`; `access.ts` caches 60s, documented |
| Peter loses active teaching assignments | **NO** | `class_subjects.teacher_id` still points at his inactive membership. No cascade, no trigger, no cleanup call |
| Grade 7 East survives | **YES** in Core / **NO** in Legacy | Core `classes` has no teacher dependency; `teacher_classes` is orphaned |
| Learners survive | **YES** | `learner_enrollments.class_id`, never teacher-keyed |
| Subjects survive | **YES** | catalogue is global |

**What breaks:** the assignment rows. `deactivateSchoolMembership()` is the right function, correctly documented, and **has no caller** — no API route, no UI, no cascade. Today "Peter leaves" is a manual SQL `UPDATE school_users SET is_active=false`, and even that leaves `class_subjects` stale.

---

## 16. Replacement Teacher (Mary Replaces Peter)

Against the brief's six requirements:

| Requirement | Actual |
|---|---|
| Class is NOT recreated | **YES** — `assignSubjectTeacher` upserts on `(class_id, subject_id)`; the `classes` row is untouched |
| Learners are NOT re-imported | **YES** — `learner_enrollments` never references a teacher |
| School does NOT repay | **YES** — entitlement is on `schools`; Mary inherits through her own membership. `schoolEntitlement.test.ts:302` pins "retirement with no replacement leaves the seat vacant and the school entitled" |
| Mary logs in and finds 7 East Mathematics waiting | **NO** — nothing reads `class_subjects` on the teacher side (§11). She would see an empty dashboard and be offered "create a class" |
| Peter's historical artifacts are NOT rewritten as Mary's | **YES** for evidence/marks (immutable, attribution-only). **N/A** for SOW/LP/RoW — they are not the school's to transfer (§13) |
| Peter → inactive/historical on that class-subject | **NO** — the upsert overwrites `teacher_id` in place. There is no row recording that Peter ever taught 7 East Mathematics. Assignment history does not exist |

So: **the data side of replacement works and is non-destructive to learners and entitlement. The two failures are (a) Mary cannot see it, and (b) Peter's tenure is erased rather than closed.**

---

## 17. School-to-School Transfer (A → B)

| Requirement | Actual |
|---|---|
| Identity unchanged | **YES** |
| School A membership → inactive/historical | **YES**, mechanically — `is_active=false` retains the row, `invited_by`, `joined_at`, `created_at` |
| School A assignments → inactive/historical | **NO** — §15 |
| School B membership active | **YES** — `UNIQUE(school_id,user_id,role)` permits a second row |
| School B assignments new | **YES** |
| School A educational history preserved | **YES** at the row level; School A's own access to Peter's planning artifacts is lost (§13) |
| School B access derived only from School B entitlement | **YES** — `resolveSchoolCoverage` scans all active memberships and grants on *any* entitled one. Correct here, though note it means a teacher active at an entitled School A **and** an unentitled School B is covered while working at B |

**Can one user safely hold historical + new memberships? At the data layer, yes. At the resolver layer, no.** `findSchoolUserByUserId` (unscoped, `.single()`) backs `GET /api/core/my-membership`, so a two-school teacher's admin screens resolve to an arbitrary school. There is no school-selector UI anywhere.

---

## 18. Retirement / Hold / Status Semantics

**One boolean. `school_users.is_active`.**

There is no `status` enum on `school_users`. The five states the brief names (active / inactive / on hold / departed / retired) all collapse to `is_active=false`.

What `is_active=false` actually does, verified:

| Effect | Happens? |
|---|---|
| Membership inactive | **YES** — `findSchoolUser` filters `is_active=true` |
| Login disabled | **NO**, and correctly so — identity is untouched |
| School entitlement unavailable | **YES** — `resolveSchoolCoverage` requires active membership |
| Teaching assignments inactive | **NO** — the §15 gap |
| RLS access to school data revoked | **YES** — every Core policy checks `su.is_active = true` |

**Is one boolean sufficient for pilot?** For the *behaviour* the brief wants — yes. Hold, transfer, retirement and replacement all produce the same required system state ("stop inheriting entitlement, keep identity, keep history"), and `deactivateSchoolMembership`'s own header already declares itself the canonical operation for all of them.

**One real consequence:** pending-invite and deactivated are indistinguishable. Both are `is_active=false`. `resolveMembership` returns `null` for both, so `getTeacherReadiness()` reports `isSchoolMember: false` for a genuinely-invited teacher — it cannot see a pending invitation at all, because `findSchoolUser` filters on `is_active`. `joined_at` (null for never-accepted, set for departed) is the discriminator that exists but is unused.

No new statuses are proposed here, per the brief.

---

## 19. Replacement Slot / Seat Licensing

**No seat model exists, and none is needed.**

Grepped for `max_teachers`, `teacher_limit`, `seat`, `maxTeachers` across `lib/` and `app/`: **zero hits** outside one test name.

Entitlement is a property of the school (`schools.school_entitlement_status`, expiry) resolved through membership. `setSchoolEntitlement()`'s header states it directly: *"Staff turnover never requires re-granting: entitlement lives on the school, and members inherit it through `school_users`."*

If teacher-count pricing is ever wanted, `SELECT count(*) FROM school_users WHERE school_id=? AND role='teacher' AND is_active=true` is already the correct and available measure. **A literal "teacher slot" is not needed. Do not build one.**

---

## 20. Learner Lifecycle & Movement

| Admin capability | Service | Gate | Status |
|---|---|---|---|
| Admission | `admitLearner()` / `onboardLearner()` | `requireSchoolAdmin` | **WORKING** |
| Bulk admission | `importLearnerRoster()` | `requireSchoolAdmin` | **WORKING** (≤1500 rows) |
| Class placement | `enrollLearner()` → `learner_enrollments` | admin | **WORKING** |
| Promotion | `runAnnualPromotion()` | `requireSchoolAdmin` | **WORKING** |
| Transfer | `transferLearner()` | `requireSchoolAdmin` | **WORKING** |
| Exit | `learners.status` ∈ active/transferred/graduated/archived/deceased | admin | **WORKING** |

**Is class membership historical or destructive?** **Historical.**

- `learner_enrollments` is `UNIQUE(learner_id, term_id)` — one row **per term**, so 7 East (Term 1–3 2026) and 8 East (Term 1–3 2027) are six separate rows, all retained.
- `runAnnualPromotion` calls `withdrawActiveEnrollments` (status → withdrawn/transferred) then `enrollLearner` for the new class. Status transition, never delete.
- `transferLearner` uses the same withdraw path.
- **Verified this pass** (the 2026-08-03 audit flagged this as unconfirmed): grepped every `.from('learner_enrollments')` call in `lib/` and `app/` — **no `.delete()` anywhere**, including in `promotions.ts`. That open question is now closed.
- `learner_promotions` is a full audit log (`from_class_id`, `to_class_id`, `from/to_academic_year_id`, `promotion_type`, `processed_by`), with a duplicate-promotion guard and a `20260723120000` uniqueness migration.

**Jane's Grade 7 evidence survives her move to Grade 8.** `learner_evidence` is learner-keyed and immutable after creation by DB trigger. Nothing in the promotion path touches it.

---

## 21. Academic Year Transition Readiness

| Question | Answer |
|---|---|
| Are classes year-scoped? | **Yes** — `classes.academic_year_id` |
| Are learners promoted by modifying `class_id`? | **No** — a new `learner_enrollments` row per term |
| Are new classes created yearly? | Supported (`createClass` takes `academic_year_id`); `activateSchool()` creates the first year's set. No "roll forward last year's classes" helper exists |
| Are old memberships preserved? | **Yes** — enrollments are per-term rows, plus the `learner_promotions` log |
| Are teaching assignments year-scoped? | **Indirectly only.** `class_subjects` has no `academic_year_id`; it inherits scope from `classes.academic_year_id` |
| Can 2026-Peter coexist with 2027-Mary? | **Yes, if they are different `classes` rows** (different academic years) — each carries its own `class_subjects`. **No, within one class row** — the upsert overwrites |

**Readiness: adequate, with one asterisk.** Year transition for *learners* is architecturally sound. Year transition for *teaching assignments* works only because classes are year-scoped; mid-year staff changes on the same class have no history.

---

## 22. Bulk Teacher Provisioning — Priority

**Can one teacher with multiple subjects and classes be represented in a flat CSV?**

Not in one row. `first_name,last_name,email,subject,class` forces one row per assignment:

```
Peter,Mwangi,peter@x.com,Mathematics,Grade 7 East
Peter,Mwangi,peter@x.com,Mathematics,Grade 8 North
Mary,Wanjiru,mary@x.com,Integrated Science,Grade 7 East
```

That is representable — the importer would group by email, invite once, then assign N times. It is not clean, but it is not blocking either.

**It is blocked by something else entirely: every one of those emails must already have an EduNexus account (§7).** A bulk teacher import that fails on row 1 with "no account" for 25 of 30 teachers is not a workflow.

**Priority for the first 2–3 pilot schools: P2.**

A JSS pilot school has 10–25 teachers. Inviting 25 people through an existing working UI is an afternoon. Importing 400 learners one at a time was genuinely impossible — which is exactly why `learnerRoster.ts` was correctly P0. The asymmetry is real and the brief's warning ("do not call bulk teacher CSV P0 merely because it would be nice") is the right call. Bulk teacher provisioning becomes P1 only after §7 is solved, and it should be built *on top of* that solution, not before it.

---

## 23. Admin Setup Experience — Derived From Evidence

`activateSchool()` already provisions academic year, terms, grades, streams, **classes**, and settings in a single pass at school creation. So the brief's instinct is right: **do not make the admin recreate classes.**

The evidence-derived sequence is:

```
1. Confirm school            POST /api/core/school → activateSchool()
                             (years, terms, streams, classes, settings — automatic)
2. Review / adjust classes   /teacher/core-office/academic/structure     EXISTS
3. Import learners           /teacher/core-admissions/import             EXISTS
4. Add teachers              /teacher/core-team (invite by email)        EXISTS, account-gated
5. Assign subjects+classes   structure page → assign-teacher             EXISTS
6. Ready                     — nothing reads step 5 back to the teacher  MISSING
```

**Five of six steps are built.** The setup experience is not a missing product; it is a missing sixth step and an unbranded URL namespace.

---

## 24. Invitation Flow Verdict

**KEEP. Repurpose the label, not the mechanism.**

Mapped against the brief's five options: **A (fallback for account linking) + B (principal handoff), with C partially true for the word "invitation."**

Evidence:

1. **It is not redundant — it is the only teacher-provisioning path that exists.** `inviteSchoolMember` is the sole writer of a `school_users` teacher row outside `provision_teacher_school` (the anti-pattern) and `createSchool` (the creator's own admin row).
2. **It does not conflict with admin-provision-first — it *is* admin-provision-first.** `requireSchoolAdmin` gates it; the role comes from a server allowlist; the invitee cannot alter it; `acceptTeacherInvitation` reads the role from the row a trusted admin wrote and explicitly never from the request body. The authorization design is exactly what the locked model requires.
3. **It is how a school gets its own principal.** Before it existed, `school_admin` was assignable in one place only — `createSchool()`, to the creator — so a founder-created school could not be handed to its real principal without SQL. That is option B, and it is load-bearing.
4. **The "invitation" *UX* is the weak part**, not the mechanism. There is no email, no token, no link — `school_users.is_active` is the entire state machine. What the admin does is *provision a pending membership*; what the teacher does is *claim it*. The word "invitation" oversells the first and undersells the second.
5. **The account precondition is the real limitation**, and it belongs to `school_users.user_id NOT NULL`, not to the invitation design.

**Recommendation: retain every function unchanged. Reframe the UI from "Invite a teacher" to "Add a teacher," and reframe the teacher side from "Accept invitation" to a first-login auto-claim of any pending membership matching their email.** That is a wording and read-path change, not a rewrite, and it converts the existing flow into exactly the admin-provisions-first model without deleting anything.

---

## 25. Security Verdict

Testing the corrected model against the brief's six prohibitions:

| Must not be possible | Status |
|---|---|
| Self-declared admin | **CLOSED** (`20260812190000`). `teachers.role` / `profiles.role` self-promotion to `admin` blocked by OLD/NEW-comparing triggers, and nine RLS policies stopped trusting the self-written value. The migration documents the live exploit it closed |
| Self-assigned teacher classes | **OPEN.** `POST /api/teacher/classes` lets any teacher create a class; `provision_teacher_school` grants them `school_admin` over a school it invents for them |
| Self-assigned subjects | **OPEN** on the legacy side (`teacher_classes.subject` is teacher-supplied free text). **CLOSED** on Core (`assign-teacher` is `requireSchoolAdmin`) |
| Cross-school membership escalation | **CLOSED.** `requireSchoolAdmin(schoolId)` proves admin authority *at that school*; `INVITABLE_SCHOOL_ROLES` is a server allowlist; `20260726090000_fix_school_users_self_escalation.sql` hardened the RLS |
| Cross-school learner access | **CLOSED on Core** (every policy joins `school_users` on the row's `school_id`). **Not enforceable on Legacy** — `students`/`teacher_classes` have no real school scope; `permissions.ts:243-250` documents that the join itself is the only isolation boundary |
| Client-controlled `school_id` | **CLOSED on Core.** Every route takes `schoolId` from the body but verifies it via `requireSchoolAdmin`/`requireSchoolMembership` before use |
| Client-controlled privileged role | **CLOSED.** Zod `z.enum(INVITABLE_SCHOOL_ROLES)`, plus the accept path reading role from the row |
| Self-granted entitlement | **CLOSED.** `requireGrowthUser` (founder, server-only allowlist) + `trg_guard_school_entitlement` rejecting the write for `authenticated`/`anon`, because the "schools: own update" RLS policy (`created_by = auth.uid()`) is satisfied by every auto-provisioned teacher for their own school |
| Self-granted subscription | **CLOSED** (`20260812170000_subscriptions_close_self_grant.sql`) |

**Two open items, both the same root cause:** the legacy teacher-first write paths. Neither is a new hole; both are the residue the 2026-08-03 audit named and nothing has yet frozen.

One additional finding not previously recorded: **`canManageAssessment`'s admin branch never verifies that `classId` belongs to `schoolId`.** An admin-tier member of School A passing School B's `classId` with School A's `schoolId` passes the check. Low severity today (all Core data is fixture-only), real once two schools are live.

---

## 26. Schema Verdict

**B — MOSTLY. One canonical relationship needs repair, and the repair is four columns.**

Not C: the teaching-assignment domain is **not** structurally missing. `class_subjects` exists, is school-owned, is admin-gated, is indexed, points `teacher_id` at a *membership* rather than a person (the institutionally correct indirection), and already supports every cardinality the brief requires except co-teaching.

Not D: there is no genuine competition for the *assignment* concept. `classes.class_teacher_id` is a different relationship (homeroom), `teacher_classes.teacher_id` is ownership not assignment. Legacy competes with Core on **Class** and **Learner**, not on Assignment.

Not A: `class_subjects` cannot express three things the locked model needs —

1. **A vacant post.** `teacher_id NOT NULL` means a class-subject with no teacher cannot exist. "Grade 7 East needs a Mathematics teacher" is unrepresentable.
2. **Assignment history.** No `status`, no `ended_at`. Replacement overwrites; Peter's tenure vanishes.
3. **Co-teaching.** `UNIQUE(class_id, subject_id)` + one `teacher_id` column.

Plus one cross-cutting schema fact: **`school_users.user_id NOT NULL`** blocks admin-first provisioning (§7).

**Proof this is "mostly" and not "no":** the reference-school integration test seeds staff into `class_subjects` and the workflow test round-trips assignment, reassignment and idempotency. The table works. It is under-expressive, not absent.

---

## 27. UI Verdict

Classified per the brief's vocabulary:

| Gap | Classification |
|---|---|
| Teacher "My Teaching" showing assigned classes | **RESOLVED 2026-08-13** — `listTeachingAssignmentsByUser` + `lib/core/teachingAssignments.ts`, rendered by `components/teacher/MyTeaching.tsx` |
| Admin sees a teacher's current assignments | **PARTIAL** — the teacher-direction read now exists (`listTeachingAssignmentsByUser`); no admin-facing screen renders it per teacher yet |
| Admin deactivates a teacher | **RESOLVED 2026-08-13** — `POST /api/core/teachers {action:'deactivate'}` + "Remove access" on `core-team` |
| Assignment cleanup on deactivation | **RESOLVED 2026-08-13** — `closeCurrentAssignmentsForMembership()`, invoked by `deactivateSchoolMembership()` |
| Vacant / historical assignment | **RESOLVED 2026-08-13** — `class_subjects.started_at`/`ended_at` + partial unique index; vacancy = no current row |
| Teacher authorization from assignment | **AUTHORIZATION MISSING** — no `requireClassSubjectAssignment`; `canManageClass` is admin-only |
| Provision a teacher with no account | **DOMAIN MISSING** — `school_users.user_id NOT NULL` |
| No-school / pending / deactivated teacher state | **UI MISSING** — `getTeacherReadiness()` returns the signal shape; nothing renders it, and it cannot currently distinguish pending from departed |
| Multi-school context selector | **UI MISSING + SERVICE MISSING** — `my-membership` picks arbitrarily |
| Admin assigns subject + class | **ALREADY WORKS** (`core-office/academic/structure`) |
| Admin invites teacher / lists team | **ALREADY WORKS** (`core-team`) |
| Admin imports learners | **ALREADY WORKS** (`core-admissions/import`) |
| Classes auto-initialize | **ALREADY WORKS** (`activateSchool`) |
| Promotion / transfer | **ALREADY WORKS** |
| School entitlement, founder-gated | **ALREADY WORKS** |
| SOW context pre-population from assignment | **UI MISSING** — every input already exists on the Core side |
| SOLO vs SCHOOL teacher context distinction | **UI MISSING** — `app/teacher/layout.tsx` gates on the legacy `teachers` row only; the two contexts are indistinguishable to the UI, which is why "create a class" is offered to everyone |

---

## 28. Findings by Priority

**P0 — a school cannot be onboarded under the corrected model without SQL or incorrect institutional data:**

| # | Finding | Why P0 |
|---|---|---|
| P0-1 | **No read path from `class_subjects` to the teacher.** An assigned teacher sees nothing. | The admin does the work correctly and the teacher's screen is empty. The school's only recovery is to tell Peter to create his own class — which is the incorrect institutional data this audit exists to prevent |
| P0-2 | **`provision_teacher_school` mints a fictional school and grants `school_admin`.** Fires on any teacher's first class creation. | Onboarding a real school while this is live produces duplicate "Peter Mwangi's School (pending setup)" tenants alongside the real one, each with a self-appointed admin. This is incorrect institutional data by construction |
| P0-3 | **No API or UI to deactivate a teacher**, and no assignment cleanup when one is deactivated. | "Peter left" requires direct SQL, and even then `class_subjects` stays stale. The brief's §17/§18 are unreachable without a database console |

**P1 — works, but founder/admin operations are materially painful:**

| # | Finding |
|---|---|
| P1-1 | Admin cannot provision a teacher who has not signed up (`school_users.user_id NOT NULL`). Every teacher must self-register before the school can touch them |
| P1-2 | No assignment history — replacement overwrites `teacher_id`; no record that Peter ever taught 7 East Mathematics |
| P1-3 | `requireClassTeacher` ignores school membership; there is no `requireClassSubjectAssignment`. Teaching authorization is legacy self-ownership |
| P1-4 | SOW / lesson plans / RoW are teacher-private with a free-text `school` string — the institution loses access to its own planning artifacts when a teacher leaves |
| P1-5 | `findSchoolUserByUserId` (unscoped, `.single()`) backs `/api/core/my-membership`; a multi-school teacher gets an arbitrary school and there is no selector |
| P1-6 | No admin view of "what does this teacher currently teach" |
| P1-7 | Pending-invite and deactivated are indistinguishable (`is_active=false` for both); `getTeacherReadiness` cannot see a pending invite at all, because `findSchoolUser` filters `is_active` |
| P1-8 | `canManageAssessment`'s admin branch does not verify that the class belongs to the claimed school |

**P2 — polish / automation:**

P2-1 bulk teacher CSV (blocked on P1-1 anyway; §22) · P2-2 co-teaching · P2-3 vacant-post modelling · P2-4 SOW context pre-population from assignment · P2-5 move admin surfaces off `/teacher/*` · P2-6 senior-secondary (Grade 10–12) subject catalogue and pathway awareness · P2-7 retire the `organizations` dead scaffolding.

---

## 29. Corrected YES → LIVE Journey

Derived from what exists, with the missing steps marked:

```
FOUNDER
  1. Create canonical school        app/admin/core-schools/new         WORKS
       → activateSchool() provisions year, terms, grades,
         streams, CLASSES, settings in one pass
  2. Confirm payment offline        —                                  (out of platform)
  3. Grant entitlement              /admin/schools/[id]/entitlement    WORKS (requireGrowthUser)
  4. Hand the school to its principal
       → invite by email, role='school_admin'   /teacher/core-team     WORKS *
       * principal must already have an EduNexus account          [P1-1]

SCHOOL ADMIN
  5. Review auto-created classes    /core-office/academic/structure    WORKS
  6. Import learners (CSV)          /core-admissions/import            WORKS
  7. Add teachers by email          /core-team                         WORKS *
       * each teacher must already have signed up                 [P1-1]
  8. Assign subject + class         structure page → assign-teacher    WORKS
  9. Confirm assignments            —                                  MISSING [P1-6]

TEACHER
 10. Sign in                                                           WORKS
 11. See assigned classes           —                                  MISSING [P0-1]
       ← currently shows only self-created teacher_classes
 12. First SOW                      /teacher/scheme-of-work            WORKS,
       but every field is typed by hand, none inherited          [P2-4]

TURNOVER
 13. Peter leaves                   —                                  MISSING [P0-3]
 14. Mary replaces him              assign-teacher upsert              WORKS (data),
       but Mary cannot see it [P0-1] and Peter's tenure is erased [P1-2]
```

**Steps that require SQL today: 13. Steps that produce incorrect institutional data if a teacher acts first: 11 (which pushes them into the flow that triggers P0-2).**

---

## 30. Minimal Implementation Sequence

Not authorized here. This is what the evidence supports, smallest-first, each phase independently shippable and reversible.

**Phase A — Close the read direction. (Unblocks P0-1. No schema change.)**
Add `listTeacherAssignments(userId, schoolId)` to `TeacherRepository` and `lib/core/classes.ts`: resolve membership → `class_subjects WHERE teacher_id = <school_users.id>` → join `classes`, `subjects`, and an active-enrollment count. One query, one service function, one route. Nothing consumes it yet.

**Phase B — Consume it. (Completes P0-1.)**
Redirect `getTeacherDashboardProjection` and `getTeacherClassListProjection` to Phase A for *identity and roster fields only*. Leave every evidence-derived field (`avg_level`, gradebook, risk, Compass) on the legacy read — per `teacher-workspace-core-cutover-readiness.md` §5, those are keyed to the legacy id space and a bare redirect returns silently-empty data. This is the one place where doing less is the correct engineering call.

**Phase C — Stop the anti-pattern. (Closes P0-2.)**
Remove the auto-provisioning branch of `resolveOwningSchool` and add the no-school state to `app/teacher/layout.tsx`: "You are not yet part of a school on EduNexus." Must ship *after* Phase B, or every school teacher is left with nothing. Solo Teachers keep the legacy create-a-class path; the branch removed is the one that invents institutions.

**Phase D — Teacher lifecycle. (Closes P0-3.)**
Wire `deactivateSchoolMembership()` to `DELETE /api/core/teachers` (`requireSchoolAdmin`) and a Team-screen action, and clear or close the teacher's `class_subjects` / `classes.class_teacher_id` rows in the same service call.

**Phase E — Assignment history and vacancy. (Closes P1-2, enables clean replacement.)**
The narrowest schema change that works: `class_subjects` gains `is_active boolean NOT NULL DEFAULT true`, `assigned_at`, `ended_at`; `teacher_id` becomes nullable; the `UNIQUE(class_id, subject_id)` becomes a partial unique index `WHERE is_active`. Replacement then closes Peter's row and opens Mary's. Four columns, one index, no data migration.

**Phase F — Authorization from assignment. (Closes P1-3, P1-8.)**
`requireClassSubjectAssignment(client, classId, subjectId?)`: derive `schoolId` from `classes.school_id` (never from the caller's claim), admit admin-tier, otherwise require an active `class_subjects` row **and** re-check `school_users.is_active` at call time. Leave `requireClassTeacher` untouched for the still-live legacy paths.

**Explicitly deferred:** admin-first provisioning of account-less teachers (P1-1), bulk teacher CSV (P2-1), co-teaching, SOW pre-population, the SOW/RoW institutional-ownership question (P1-4 — this is a product decision about who owns a teacher's planning work, not an engineering gap), and every part of the legacy Class/Learner convergence.

---

## 31. Files / Tables / Routes Involved (read-only inventory)

**Tables — Core (school-first):** `schools`, `school_users`, `academic_years`, `terms`, `school_settings`, `grades`, `streams`, `subjects`, `grade_subjects`, **`class_subjects`**, `classes`, `learners`, `learner_guardians`, `learner_enrollments`, `learner_promotions`, `learner_transfers`, `term_subject_summaries`, `school_report_cards`.

**Tables — Legacy (teacher-first):** `teachers`, `teacher_classes`, `class_students`, `students`, `class_assessments`, `learner_marks`, `assignments`, `assignment_submissions`, `compass_sessions`, `schemes_of_work`, `lesson_plans`, `records_of_work`.

**Services:** `lib/core/classes.ts` (`assignSubjectTeacher`, `listClassSubjects`, `createClass`), `lib/core/subjects.ts`, `lib/core/school-users.ts` (`deactivateSchoolMembership` — no callers), `lib/core/teacherOnboarding.ts`, `lib/core/identity.ts`, `lib/core/permissions.ts`, `lib/core/institutionOwnership.ts`, `lib/core/schoolEntitlement.ts`, `lib/core/schoolActivation.ts`, `lib/core/promotions.ts`, `lib/core/transfers.ts`, `lib/core/learnerRoster.ts`, `lib/payments/access.ts`, `lib/teacherWorkspace/*`.

**Repositories:** `lib/repositories/teacher.repository.ts` (lines 136-168 = the entire assignment surface), `school.repository.ts`, `learner.repository.ts`.

**Routes — Core/admin:** `/api/core/{teachers,subjects,classes,learners,learners/import,promotions,transfers,school,my-membership,academic-years}`, `/api/admin/schools/**`.
**Routes — legacy teacher-first:** `/api/teacher/classes`, `/api/teacher/classes/[classId]/students`, `/api/teacher/students/[studentId]/promote`, `/api/teacher/classes/[classId]/generate-reports`, `/api/sow/generate`.

**UI:** `app/teacher/core-team`, `app/teacher/core-office/academic/structure`, `app/teacher/core-admissions/import`, `app/teacher/dashboard`, `app/teacher/classes`, `app/admin/schools`.

**Migrations:** `20260629_core_foundation.sql` (the whole Core model), `20260802090000/090200` (Phase 0 ownership + `provision_teacher_school`), `20260804120000` (RPC lockdown), `20260812150000` (school entitlement), `20260812170000` (subscription self-grant), `20260812190000` (self-declared admin), `20260726090000` / `20260725130000` (school_users RLS).

---

## 32. Explicit Non-Goals

Not proposed, not designed, not started by this audit: teacher seat licensing · a full email/token invitation system · removal of the invitation flow · SIS/NEMIS synchronization · co-teaching · a `teacher_assignments` table separate from `class_subjects` · legacy Class/Learner data migration · evidence-layer redesign · Compass/gradebook Core-native port · a fourth admin role (registrar/secretary) · the URL namespace move · any schema change (Phase E above is a sketch of the narrowest option, not an authorization to run it).

---

## 33. Final Answer

**Can EduNexus reach "School Admin provisions the institution → Teacher logs in → their subjects and classes are already there → teacher teaches" without a major rebuild?**

**Yes.** Five of the six admin steps are already built, working, and correctly authorized. The institutional model — school-owned classes, membership-based employment, subject-scoped assignment pointing at a membership rather than a person, per-term enrollment history, entitlement on the school — is already correct in `class_subjects` / `classes` / `learner_enrollments` / `school_users`.

The gap is a **missing read direction**, not a missing domain. One repository query — `class_subjects WHERE teacher_id = <my school_users.id>` — plus its consumption in the teacher dashboard, is what turns an assignment the admin already makes into a workspace the teacher already expects. That, plus removing the branch that lets a teacher invent a school for themselves, is the whole of the P0 work.

**Can Peter leave tomorrow and Mary replace him without recreating Grade 7 East, re-importing learners, losing educational history, or making either teacher pay?**

**Four of five: yes today. One: no.**

- Grade 7 East is not recreated — `classes` has no teacher dependency and `assignSubjectTeacher` upserts the assignment, not the class. ✅
- Learners are not re-imported — `learner_enrollments.class_id` never references a teacher. ✅
- Educational history survives — evidence is immutable by DB trigger, marks and assessments carry `teacher_id` as attribution only, promotions are a full audit log with no deletes anywhere in the enrollment write paths. ✅
- Neither teacher pays — entitlement lives on `schools` and is inherited through membership; there is no seat model to consume, and a pinned test asserts a vacant post leaves the school entitled. ✅
- **Mary does not see it, and Peter's tenure is erased rather than closed.** Nothing reads `class_subjects` back to a teacher (P0-1), and the upsert overwrites `teacher_id` with no historical row (P1-2). ❌

Peter leaving also currently requires SQL, because `deactivateSchoolMembership()` — the correctly-written canonical function for exactly this event — has no route and no button (P0-3).

**The school already owns the structure. The teacher already occupies an assignment. History already survives people changing. The teacher just cannot see any of it yet.**
