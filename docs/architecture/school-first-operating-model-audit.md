# School-First Operating Model — Correction Audit

**Date:** 2026-08-03
**Type:** Architecture correction audit (evidence-only findings + corrections). Not a migration sprint, not a UI redesign, not a new feature.
**Governing rule:** the School exists before any teacher. Teachers work inside a school; they never build one.

This audit re-checks EduNexus against that rule using the live codebase, not the target design. It supersedes nothing in `edunexus-architecture-constitution.md` — it is the fact-finding pass the Constitution's own Part 10 deprecation sequence (Adapter → Warning → Freeze → Migration → Observation → Retirement → Removal) requires before the next step can be taken honestly.

---

## 1. Executive Verdict

**The platform is mid-migration, not teacher-first by design and not school-first in practice.** Two parallel, independently-writable data models coexist:

- **Legacy (teacher-first):** `teachers`, `teacher_classes`, `students`, `class_students`, `assignments`, `assessments`, `records_of_work`, `intervention_log`. Root of ownership is `auth.users.id` via `teacher_id`/`user_id`. Still the live write path for every teacher-facing class/roster action.
- **Core (school-first):** `schools`, `school_users`, `academic_years`, `terms`, `classes`, `learners`, `learner_enrollments`, `learner_guardians`, `learner_promotions`, `learner_transfers`, `school_report_cards`. Root of ownership is `schools.id`. Fully built, `requireSchoolAdmin`-gated, but seeded only with fixture data (Reference School v1) — zero real pilot schools run on it.

A third system, `organizations` (`app/organizations/**`, `lib/iam/permissions.ts`), presents a school-signup UI but writes nothing to its own tables — the table was never migrated to the live database. The UI silently redirects `school`-type signups into Core instead. This is not a competing model; it's dead scaffolding that should be named as such, not left implying a third ownership path exists.

A Phase-0 shim (`lib/core/institutionOwnership.ts`, `resolveOwningSchool`) already recognizes the problem and papers over it: every legacy write now backfills a `school_id`, auto-provisioning a school named `"{teacher name}'s School (pending setup)"` if the teacher has no `school_users` row — and makes that teacher its `school_admin`. This is the clearest single artifact of the violation this audit exists to name: **the system currently manufactures a fictional one-teacher "school" per teacher rather than requiring a real school to exist first.**

Per the Constitution's own Part 10, Phase 0 is meant to be the **Freeze** step — but it isn't one. It attaches `school_id` after the fact; it does not stop new `teacher_classes`/`students` rows from being created. Freeze has not actually happened yet.

**Verdict: NO-GO on calling this a School Operating System today.** The Core side is architecturally correct and ready to be the target. The corrective work is bounded and mostly subtractive (stop new legacy writes, redirect teacher-facing routes to Core, retire the auto-provisioning shim) rather than a rebuild.

---

## 2. Current Teacher-First Assumptions (with evidence)

| # | Assumption | Where it lives |
|---|---|---|
| A1 | A teacher can invent a class from nothing — name, grade, subject, code — with no school approval. | `app/api/teacher/classes/route.ts:89-162` (`POST`), gated only by `resolveTeacher` (line 100) |
| A2 | If a teacher has no school, the system invents one for them and makes them its admin. | `lib/core/institutionOwnership.ts:77-107` (`resolveOwningSchool`) → `provision_teacher_school` RPC (`supabase/migrations/20260802090200_phase0_provision_teacher_school_function.sql:44-49`) |
| A3 | A teacher can admit a learner directly — no admission number, no admissions office, no guardian-as-institutional-record — as a side effect of a roster-add call. | `app/api/teacher/classes/[classId]/students/route.ts:100-134` |
| A4 | "Ownership" of a class/student is `teacher_id`, so a class code, a roster, and a report all trace back to one person's account rather than an institution. | Same file, `students.teacher_id`, `students.added_by: 'teacher'` (lines 108-110) |
| A5 | A teacher can trigger officially-delivered report generation with no admin publish gate. | `app/api/teacher/classes/[classId]/generate-reports/route.ts:21-109`, gated only by `requireClassTeacher` (line 44) |
| A6 | A teacher can promote/archive a class at year-end outside the school's promotion process. | `app/api/teacher/students/[studentId]/promote/route.ts` / `lib/promotions/promote.ts` — parallel to the admin-gated `app/api/core/promotions/route.ts:64` |
| A7 | The single authorization primitive making all of the above legal is teacher-self-ownership, not institutional membership. | `requireClassTeacher`, `lib/core/permissions.ts:97-105` — checks only `teacher_classes.teacher_id === caller`, never checks `school_users`/role |
| A8 | Signing up "as a teacher" silently creates a legacy `teachers` row with no institutional context at all. | `app/auth/callback/route.ts:108-112` (OAuth path), `app/(auth)/signup/page.tsx` role=teacher path |

None of these are malicious shortcuts — they're the honest residue of the product growing from "a teacher tries the tool" (correct for a beta-teacher acquisition motion) without a school-first foundation ever being retrofitted underneath it.

---

## 3. Required School-First Corrections

Each corrects exactly one assumption above, in the same order:

1. **Freeze, for real.** Stop `teacher_classes`/`students` INSERTs at the route level once a school exists (see §12 for sequencing) — not just backfill `school_id` after the write.
2. **Retire `resolveOwningSchool`'s auto-provisioning branch.** A teacher with no school should be blocked with "ask your school administrator to add you," not handed a fictional school and made its admin. The lookup-existing-membership half of the function stays; the provisioning half is the exact violation this whole audit is about.
3. **Route learner admission through Core only.** `POST /api/core/learners` (`requireSchoolAdmin`-gated, `app/api/core/learners/route.ts:87-121`) already exists and is correct — the fix is making the teacher-facing roster-add flow call into enrollment against an already-admitted Core learner, not create one.
4. **Make `teacher_id` (any actor id) a "who did this" field, not a "who may read/report this" field**, per the standing CLAUDE.md rule already in force platform-wide for evidence rows — apply the same discipline to `teacher_classes`/`students` ownership, not just the intelligence layer.
5. **Reports require an admin publish step**, matching the pattern `school_report_cards.is_published`/`publishReportCards` (`lib/repositories/school.repository.ts:370-388`) already implements on the Core side.
6. **Promotion runs through one path**: `app/api/core/promotions/route.ts`. The legacy `lib/promotions/promote.ts` route is a fork to close, not a parallel feature to maintain.
7. **`requireClassTeacher` gains an institutional check**: teaching a class requires an active `school_users` row for that class's `school_id`, not just `teacher_classes.teacher_id` equality.
8. **Signup no longer manufactures institutional identity.** `role=teacher` should end in "pending: awaiting school assignment," not a live, writable `teachers` row with no school behind it.

---

## 4. Ownership Matrix

Ambiguous ownership was the audit's explicit failure condition — flagged below wherever the *current* system still leaves it ambiguous, versus the *Core* model where it's already resolved.

| Entity | Owner | Creator | Editor | Retires | Assigns responsibility | Status |
|---|---|---|---|---|---|---|
| School | School (self) | Principal/Director (`app/api/core/school/route.ts:55-92`) or ops allowlist (`app/admin/core-schools/new`) | `school_admin`/`headteacher` (`PATCH`, line 130) | n/a (not modeled — see §9) | — | **Resolved**, except: ops-allowlist path bypasses the role model entirely (env-var email list, not a DB role) |
| Academic Year / Term | School | `requireSchoolAdmin` (`app/api/core/academic-years/route.ts:52`) | Same | Superseded by new year (`is_current` flip) | — | **Resolved** |
| Curriculum / Level / Stream | School | `requireSchoolAdmin` (`app/api/core/classes/route.ts:60,73`) | Same | Not modeled | — | **Resolved** |
| Class (Core) | School | `requireSchoolAdmin` | Same | Not modeled | Teacher assignment via `class_subjects.teacher_id` | **Resolved** |
| Class (legacy `teacher_classes`) | **Ambiguous — nominally the teacher** | Teacher, unauthenticated by institution (§2 A1) | Teacher | Never (no `status`/`archived` column — `academic-evidence-layer.md` §1) | n/a | **Violates the rule** |
| Subject | School (curriculum-scoped) | `requireSchoolAdmin` (`app/api/core/subjects/route.ts:78,89,100`) | Same | Not modeled | Via `assignSubjectTeacher` | **Resolved** |
| Teacher (as institutional role) | School | `requireSchoolAdmin` invite (`app/api/core/teachers/route.ts:40-53`) + teacher self-accept | School (role change) | Deactivate `school_users.is_active` | — | **Resolved** |
| Teacher (as legacy account) | **Ambiguous — self** | Signup flow, no school required (§2 A8) | Self | Never | n/a | **Violates the rule** |
| Learner (Core) | School | `requireSchoolAdmin` (`app/api/core/learners/route.ts:100,114`) | School | `LearnerStatus` transitions | Enrollment, not ownership | **Resolved** |
| Learner (legacy `students`) | **Ambiguous — `teacher_id`/`user_id`** | Teacher (§2 A3/A4) | Teacher | Never | n/a | **Violates the rule** |
| Parent/Guardian | School (`learner_guardians`, school-scoped) | Admission pipeline or admin | School | Not modeled | — | **Resolved** on Core; legacy parent-invite flow (student_invites) is teacher-initiated |
| Enrollment | School | `requireSchoolAdmin` (`learner_enrollments`) | School | Withdrawal/transfer status | — | **Resolved** |
| Timetable / class_subjects | School | `requireSchoolAdmin` | School | Not modeled | Subject↔teacher via `assignSubjectTeacher` | **Resolved**, but no UI builder found beyond the single assignment call — see §9 |
| Assignments / Assessments | Teacher (rightly — this is teaching work) | Teacher, `requireClassTeacher` | Teacher | n/a | — | **Correct as-is** — this is teaching artifact territory, not institutional fact, per Constitution Axiom 2 |
| Attendance | Teacher (recording) inside School (owning) | `requireSchoolMembership` (Core) — correctly broader than admin-only | Teacher | n/a | — | **Correct as-is on Core**; legacy attendance path not separately audited here |
| Gradebook / Report Cards | School (publishes); Teacher (drafts) | Draft: teacher. Publish: `requireSchoolAdmin`-adjacent `publishReportCards` | School (publish), Teacher (draft) | Republish supersedes | — | **Resolved on Core**; legacy `generate-reports` route (§2 A5) has no publish gate |
| Blueprint / Compass / Career Intelligence | School (subject: the learner within the school) | System-generated from Evidence, never manually created | n/a — derived, not owned | Superseded by new Evidence, never edited (per CLAUDE.md evidence-lifecycle rule) | — | **Correct as-is** — these are Reasoning-layer projections, not institutional records; ownership question doesn't apply the same way |

---

## 5. Administrative Responsibility Matrix

Everything below belongs to the institution (`school_admin`/`headteacher`/`deputy_headteacher` — collectively `ADMIN_TIER_ROLES`, `lib/core/adminTierRoles.ts:6`), never a teacher acting alone:

| Function | Existing route/mechanism |
|---|---|
| Admissions | `POST /api/core/learners` (`requireSchoolAdmin`) |
| Transfers | `POST /api/core/transfers` (`requireSchoolAdmin`) |
| Promotion | `POST /api/core/promotions` (`requireSchoolAdmin`) — legacy parallel path (§2 A6) must close |
| Teacher assignment / invite | `POST /api/core/teachers` (`requireSchoolAdmin` invite; teacher self-accept) |
| Subject allocation | `POST /api/core/subjects` (`requireSchoolAdmin`) |
| Register maintenance (teacher/learner/parent) | Core tables, admin-gated as above |
| School structure (years/terms/classes/streams) | `/api/core/academic-years`, `/api/core/classes` |
| Institutional reporting / report publish | `publishReportCards` (`lib/repositories/school.repository.ts:370`) — needs a route wrapper if none currently calls it from an admin-facing UI (not confirmed present in this pass) |
| End-of-term processing | `app/api/core/school/end-of-term/route.ts` (`requireSchoolAdmin`) |

Today's admin surface (`app/teacher/core-office/**`, `app/teacher/core-admissions/**`, `app/teacher/core-team/**`) is functionally correct — role-gated by `ADMIN_TIER_ROLES` — but lives under the `/teacher/*` URL namespace. That's a Part 7 (Navigation) problem, not a permissions problem: the gate is right, the address is wrong.

---

## 6. Teacher Responsibility Matrix

What a teacher should be able to do without ever touching institutional structure — and what already matches vs. doesn't:

| Teacher action | Should require | Current reality |
|---|---|---|
| See "my classes" | Institutional assignment already made by school | Legacy: teacher *made* the class themselves (§2 A1) — inverted |
| See "my subjects" | Same | Not modeled on legacy side at all — `subject` is a free-text field on `teacher_classes`, not an assignment |
| Record a lesson / assignment / assessment | Membership in the class's school | `requireClassTeacher` checks class ownership, not school membership (§2 A7) |
| Take attendance | Same | Correct on Core; legacy path not gated by school membership |
| Update gradebook | Same, draft-only, publish is admin's | No publish gate on legacy report generation (§2 A5) |
| View Compass / Blueprint / recommendations | Membership + the learner being in one of their classes | Not separately audited here — assumed correct given the read-access rule already in CLAUDE.md (`teacher_id` ≠ read gate) |
| Add a learner to my class roster | The learner already exists in the school; teacher requests enrollment, doesn't create the learner | Legacy: teacher creates the learner outright (§2 A3) — inverted |

---

## 7. Ideal Principal Journey

1. Signs up (`role=school` today routes correctly into Core via `app/organizations/new/page.tsx`'s `submitSchool()`, which itself is a stopgap — see §14).
2. `POST /api/core/school` creates the school and calls `activateSchool()` in the same pass — academic year, terms, grades, streams, base classes, settings all provisioned together (`app/api/core/school/route.ts:55-92`). This already matches the "Administrative Setup" step of the canonical lifecycle almost exactly as specified in the mission brief.
3. Invites staff: `POST /api/core/teachers?action=invite`.
4. Admits learners: `POST /api/core/learners`.
5. Assigns teachers to classes/subjects: `assignSubjectTeacher`.
6. Done — no further manual structure-building needed per learner/class thereafter.

This journey is **already built** on the Core side. The gap is that nothing routes a real principal into it exclusively — the `/organizations/new` entry point still nominally offers a generic multi-org-type form (§14) before quietly special-casing `school`.

---

## 8. Ideal Teacher Journey

1. Accepts invite (`POST /api/core/teachers?action=accept`).
2. Logs in → lands on "My Teaching Workspace": classes, subjects, today's lessons, assignments, gradebook, attendance, resources, Compass, Blueprint — all **already existing** by class/subject already assigned to them, zero setup.
3. Never sees `teacher_classes` creation UI, never sees a "create learner" form.

**Current reality**: `app/teacher/*` still surfaces the legacy class-creation flow (`app/api/teacher/classes/route.ts` POST) as the primary path for a teacher to get a class at all — there is no UI today that instead lists Core `classes` already assigned to the teacher via `class_subjects.teacher_id`. This is the single largest gap between current and ideal.

---

## 9. Ideal Secretary Journey

1. Admits a new learner via `POST /api/core/learners` (already correctly admin-gated, no code change needed for the write path itself).
2. Teacher refreshes their roster view and the count updates — this requires the teacher roster view to read from Core `learner_enrollments` scoped to the teacher's assigned class, which (per §8) doesn't yet exist as the primary teacher-facing view.

No dedicated "secretary" or "registrar" role exists separately from `ADMIN_TIER_ROLES` (`school_admin`/`headteacher`/`deputy_headteacher`) — three roles cover all administrative function today. That's a reasonable simplification for a 50-pioneer-teacher beta and not flagged as a defect; a fourth "office staff" role can be added later without disturbing the ownership model, since ownership is already keyed to "school," not to which of the three admin roles acted.

---

## 10. Navigation Changes

Two operating worlds, per the mission brief's Part 7, already exist in embryonic form but are not cleanly separated by URL:

- **School Office** (institution administration): currently `app/teacher/core-office/**`, `app/teacher/core-admissions/**`, `app/teacher/core-team/**` — all role-gated correctly by `ADMIN_TIER_ROLES`, all living under `/teacher/*`.
- **Academic Workspace** (teaching): currently `app/teacher/*` more broadly, mixed in with the above.

**Correction**: move the admin-tier pages to their own top-level namespace (e.g. `/school-office/*` or `/admin/*`, reusing the existing `app/admin/core-schools/new` root) so the URL itself signals which world a user is in, rather than relying on client-side role checks buried in each page component. This is a routing/move change, not a rewrite of any of the underlying admin logic, which is already correct.

---

## 11. Permission Changes

The rule to enforce platform-wide: **Institution creates and assigns; teachers teach; intelligence reasons; parents/learners observe/learn.**

Concrete gaps against that rule, all already identified above:

1. `requireClassTeacher` must additionally verify school membership, not just class-row ownership (§2 A7, §6).
2. `resolveOwningSchool`'s auto-provisioning branch must be removed — a teacher with no school is blocked, not made an admin of a fictional one (§3.2).
3. Legacy `teacher_classes`/`students` INSERT paths need the same admin gate Core already enforces, or need to stop accepting new writes entirely once the corresponding Core flow is live for a given school (§12).
4. `app/admin/core-schools/new`'s env-var email allowlist is an ops backdoor, not a role — acceptable for a 50-teacher beta's manual onboarding, but should be named as an explicit ops-only exception in the Constitution rather than left implicit, so it isn't mistaken for part of the permission model.

---

## 12. Migration Impact

Every place the current implementation still assumes "teacher creates class / adds learner / owns roster / owns institutional structure," and what removing that assumption requires:

| Assumption site | Removal requires |
|---|---|
| `app/api/teacher/classes/route.ts` POST | Replace teacher-invents-a-class with teacher-selects-from-Core-classes-already-assigned-to-them. Requires a Core `class_subjects` read endpoint teachers can query, and a data backfill for any pilot teacher already using the legacy path (none yet in production per Reference School v1 being fixture-only). |
| `app/api/teacher/classes/[classId]/students/route.ts` POST | Replace teacher-creates-a-student with teacher-requests-enrollment-of-an-already-admitted Core learner into their class, or (if the school hasn't onboarded that learner into Core yet) route the request to the admissions office queue rather than writing directly. |
| `lib/core/institutionOwnership.ts` auto-provisioning branch | Delete the `provision_teacher_school` call path; keep only the existing-membership lookup. Requires a clear "no school yet" user-facing state (§3.2) to replace it. |
| `app/api/teacher/students/[studentId]/promote/route.ts` / `lib/promotions/promote.ts` | Deprecate in favor of `POST /api/core/promotions` once a school is fully on Core; until then it remains the only promotion path for legacy-only schools, so cannot be removed before Core has learner-promotion parity for every currently-active legacy school. |
| `app/api/teacher/classes/[classId]/generate-reports/route.ts` | Add a publish gate (reuse `publishReportCards`'s pattern) rather than delivering directly to parents on teacher action alone. |
| Signup flow (`role=teacher` auto-creates `teachers` row, `app/auth/callback/route.ts:108-112`) | Change to a pending state until a real school membership exists — either via invite-accept or (during the beta) a manual admin bridge. |
| `organizations` (§14) | Not a migration target — it's unmigrated dead code. Either finish migrating its table and genuinely support non-school org types, or remove the generic-org UI paths and keep only the school-signup redirect that already bypasses it. This is a scoping decision, not architecture debt, and belongs to a product call, not this audit. |

No entity in the Ownership Matrix (§4) requires a *new* table to reach school-first correctness — every "Resolved" row's mechanism already exists on Core. The work is exclusively: (a) stop legacy writes, (b) redirect teacher-facing UI to read/write Core instead, (c) close two parallel promotion/report paths down to one.

---

## 13. Implementation Order

Sequenced so nothing downstream is built on a foundation still being frozen underneath it — mirrors the Constitution's own Adapter → Warning → Freeze → Migration → Observation → Retirement → Removal sequence, applied to the two remaining gaps (class/roster creation, promotion/report duplication):

1. **Freeze** — stop `teacher_classes`/`students` INSERT once a teacher's school has any Core `classes`/`learners` data (i.e., freeze per-school, not platform-wide, so schools still legacy-only aren't broken mid-beta).
2. **Remove auto-provisioning** from `resolveOwningSchool` (§3.2) — this is what actually stops new one-teacher fake schools from being minted, and is safe to do independently of step 1.
3. **Teacher-facing "my classes" view reads Core** `class_subjects` scoped to the teacher, replacing the legacy list as the default landing view.
4. **Roster-add flow becomes enrollment-request against Core learners**, falling back to an admissions-office queue (not a direct create) when the learner isn't in Core yet.
5. **Close the promotion fork**: route legacy schools' promotion through the same `/api/core/promotions` handler (extend it to accept legacy `students`/`teacher_classes` inputs if needed, rather than maintaining two implementations).
6. **Add the publish gate** to legacy report generation.
7. **Navigation split** (§10) — do this last, once the underlying data paths are already correct, so the URL move isn't fixing a permissions problem it doesn't actually own.

Steps 1–2 are the only ones with any urgency relative to Foundation Freeze / pilot-acquisition priorities — they're what stops the fictional-school pattern from compounding with every new beta teacher. Steps 3–7 are real but not time-critical while the pilot count is still zero real schools.

---

## 14. School-First Architecture Blueprint (target state)

```
Principal/Director
    │
    ▼
POST /api/core/school  →  activateSchool()
    (Academic Year, Terms, Grades, Streams, base Classes, Settings — one pass)
    │
    ▼
School Office (admin-tier UI, own URL namespace)
    │  ├─ Admissions  → POST /api/core/learners
    │  ├─ Staff        → POST /api/core/teachers?action=invite
    │  ├─ Subjects     → POST /api/core/subjects, assignSubjectTeacher
    │  └─ Structure    → /api/core/academic-years, /api/core/classes
    │
    ▼
Teacher accepts invite → school_users row created
    │
    ▼
Academic Workspace (teacher-tier UI, own URL namespace)
    "My Classes" reads class_subjects WHERE teacher_id = me
    │  ├─ Lessons/Assignments/Assessments (teacher-owned artifacts — correct as-is)
    │  ├─ Attendance, Gradebook (draft)
    │  └─ Compass / Blueprint / Career Intelligence (system-derived, read-only to teacher)
    │
    ▼
Evidence accumulates → recomputeLearnerProjection() (unchanged — already correct)
    │
    ▼
Report Cards: teacher drafts, admin/publish gate releases → parents
    │
    ▼
School continues regardless of teacher turnover
    (teacher reassignment touches class_subjects.teacher_id only —
     Learner/Evidence/Reports/Blueprint/Compass never reference which
     teacher entered them for access-control purposes, per the standing
     CLAUDE.md rule already in force for the intelligence layer)
```

Everything in this diagram already exists in code today except: the teacher-tier "My Classes" view sourced from Core, the enrollment-request fallback for roster-add, the single promotion path, and the report publish gate — the four items carried into §13's implementation order.

---

## 15. Final Recommendation

Don't rebuild — **finish the freeze**. The Core school-first model is already correct and already the majority of the platform's institutional logic (§4–§5 show almost every entity already resolved there). The violation is concentrated in a small, enumerable set of legacy-side entry points (§2, eight items) plus one shim (`resolveOwningSchool`'s auto-provisioning) that actively manufactures the exact anti-pattern this audit was commissioned to eliminate. Removing that one function's provisioning branch, closing two duplicate paths (promotion, report-publish), and repointing one teacher-facing view (My Classes) from legacy to Core accounts for nearly all of the corrective work identified.

This audit is evidence-only, per its own scope. Per `feedback_architecture-guardian-mode` and the current Foundation Freeze charter, no code changes were made here — this document is the finding, ready for founder review before any of §13's steps are authorized to start.
