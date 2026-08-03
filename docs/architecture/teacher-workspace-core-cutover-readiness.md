# Teacher Workspace Core Cutover Readiness

**Date:** 2026-08-03
**Type:** Readiness assessment and implementation-planning sprint. No production schema changed, no cutover performed, no legacy table retired, no historical data migrated.
**Scope:** whether `lib/teacherWorkspace/*` (extracted in the prior sprint — `getTeacherDashboardProjection`, `getTeacherClassListProjection`, `getTeacherClassDetailProjection`, `getTeacherClassInsightsProjection`) can be redirected from the legacy teacher-owned model to the Core school-first institutional model.

---

## 1. Executive Readiness Verdict

**READY WITH CONDITIONS — split by field, not by projection.**

The identity/roster half of the target chain (teacher → school membership → assigned classes/subjects → academic context → learner roster) is genuinely built and correct on the Core side: `class_subjects`, `learner_enrollments`, `resolveMembership`, `requireSchoolAdmin`/`requireSchoolStaff` all exist, are admin-gated, and status-transition rather than hard-delete. That half can be redirected once two real gaps close (§13).

The evidence half cannot redirect yet, for a reason that is architectural, not incidental: `assessments`, `learner_marks`, `class_assessments`, `compass_sessions`, and `learner_evidence` are all keyed to the **legacy id space** (`teacher_classes.id`/`students.id`), and the only existing bridge from Core ids into that space (`lib/core/academicBridge.ts`) is explicitly, self-documented as temporary, lazy (fires only on a teacher's first legacy assessment write), and off-limits to new callers — its own header states "nothing outside it should ever import from it except the one route wired in this sprint." A bare redirect of Teacher Workspace's class/roster reads to Core `classes.id`/`learners.id` would silently return empty `avg_level`, gradebook, standing, and risk data for any learner without a pre-existing bridge row — which is most or all Core-only learners today. This is not a guess; it is what `academicBridge.ts`'s own module header exists to document and what `lib/core/learnerOnboarding.ts`'s `getLearnerReadiness()` names as the only thing that currently closes the gap, lazily, never automatically.

**Practical consequence for §9/§11**: the adapter has to expose two different readiness levels, not one on/off switch — "who is this teacher, what school, what classes, what roster" is cuttable now; "what's their average, risk, gradebook" is not, until either Phase 11 (the Compass/Evidence Core-native port `academicBridge.ts` itself names as its own retirement trigger) lands, or a purpose-built, scoped, observable bridge is built for exactly this read path (not an extension of `academicBridge.ts`, which is reserved for its one existing write-path caller).

---

## 2. Core Source Map

| Projection | Field | Institutional source | Table/repo/service |
|---|---|---|---|
| All four | Teacher identity | `teachers` (legacy) — **no Core-native teacher identity beyond `school_users`** | `resolveTeacher()` (`lib/core/identity.ts:113`) |
| All four | School membership | Core, correct | `resolveMembership(userId, schoolId)` → `ResolvedMembership{schoolId,userId,role,isActive}` (`lib/core/identity.ts:160-164`) |
| Dashboard, List | Assigned classes | Core, correct | `class_subjects` (`teacher_id → school_users.id`, `class_id → classes.id`), read via `listClassSubjects(classId)` (`lib/core/classes.ts:66-73`) — **no "list classes for this teacher" query found; only "list subjects for this class" exists** (see §13, gap 1) |
| List, Detail | Assigned subjects | Core, correct | `class_subjects.subject_id` |
| All four | Academic year / active term | Core, correct | `resolveActiveAcademicYear`/`resolveActiveTerm` (`lib/core/academicActivation.ts`, per prior audit) |
| List, Detail, Insights | Class roster | Core, correct, but unread by any teacher-workspace projection today | `learner_enrollments` (`status='active'`) via `findActiveEnrollmentsByClass(classId, termId)` (`lib/repositories/school.repository.ts:297-307`) |
| Detail, Insights | Learner identity | Core, correct | `learners` table, `getLearner()` (`lib/core/learners.ts`) |
| Detail, Insights | Attendance | Not audited this sprint (out of scope — Part 4 named assessments/gradebook/Blueprint/Compass/Career Intelligence specifically, not attendance) | — |
| Detail, Insights | Assessments/marks | **Legacy id space, not bridged automatically** | `class_assessments` (`class_id → teacher_classes`), `learner_marks` (`student_id → students`) |
| List, Detail | Gradebook | **Legacy id space** | `assignments`/`assignment_submissions`, both `class_id`/`student_id` in legacy space (`lib/gradebook/gradebook.ts:19-53`) |
| Detail, Insights | Blueprint/Compass access | **Legacy id space** | `compass_sessions.learner_id → students.id`; `lib/compass/ownership.ts` reads `students.teacher_id`/`class_students` exclusively |

The single-column summary: **identity and structure are Core-native and correct; every number a teacher actually looks at (average, standing, risk, gradebook) is still legacy-keyed.**

---

## 3. Teacher Assignment Audit

- `class_subjects` (`supabase/migrations/20260629_core_foundation.sql:365-374`): `id, school_id, class_id → classes(id) CASCADE, subject_id → subjects(id), teacher_id → school_users(id), UNIQUE(class_id, subject_id)`. Note `teacher_id` points at `school_users.id`, not `auth.users.id` directly — one more indirection than the legacy model's `teacher_classes.teacher_id → teachers.id`.
- `classes.class_teacher_id → school_users(id)` (`20260629_core_foundation.sql:260`) is a separate "homeroom teacher" concept from `class_subjects.teacher_id` ("subject teacher") — both exist, are used differently (`academicBridge.ts:128-139` treats `class_teacher_id` as the authoritative assignment gate for class-level bridging), and this audit did not find any confusion or double-write between them — they're deliberately two different relationships, not a duplicate.
- `assignSubjectTeacher(schoolId, classId, subjectId, teacherId)` (`lib/core/classes.ts:57-64`) → `upsertClassSubjectTeacher` (`lib/repositories/teacher.repository.ts:141-149`), upsert on `(class_id, subject_id)`.
- **Supported**: one teacher on many subjects, one teacher on many classes, a teacher active in >1 school simultaneously (`school_users` unique per `(school_id, user_id, role)`, not globally unique on `user_id` — confirmed by schema and by `resolveMembership` requiring an explicit `schoolId` argument rather than scanning).
- **Not supported**: co-teaching. `class_subjects` has exactly one `teacher_id` column and a `UNIQUE(class_id, subject_id)` constraint — assigning a second teacher to the same class+subject overwrites the first via upsert rather than adding a second row. If co-teaching is a real pilot-school need, this is a schema gap, not an application-layer one — out of this sprint's boundary (no schema changes), named here for a future decision.
- **Confirmed gap, not guessed**: no `deactivateTeacher`/`removeTeacher` function touches `class_subjects.teacher_id` or `classes.class_teacher_id` when a `school_users` row is deactivated. `deactivateSchoolUser(schoolUserId)` (`lib/core/school-users.ts:65-75`) only flips `school_users.is_active = false`; the FK from `class_subjects`/`classes` has no cascade or trigger. A deactivated teacher's assignment rows remain pointing at their now-inactive `school_users.id` indefinitely unless a caller manually reassigns them — this directly threatens Frozen Principle "a teacher without an active school assignment has no teaching workspace" and Test Plan item 8/9 (§10), and must be closed before cutover (§13 blocker).
- **Confirmed ambiguity, not guessed**: `repos.schools.findSchoolUserByUserId` (used by `resolveOwningSchool` and flagged by `academicBridge.ts`'s own comment) is unscoped by school — for a genuinely multi-school user it "would pick an arbitrary row." `resolveMembership(userId, schoolId)` (used correctly elsewhere) does not have this problem because it always takes an explicit `schoolId`. Any new Teacher Workspace read must use the scoped form, never the unscoped one (§6, §9).

---

## 4. Roster Compatibility Audit

- Canonical Core roster source: `learner_enrollments`, `status='active'`, read via `findActiveEnrollmentsByClass(classId, termId)`. No Core `class_students`-equivalent table exists — roster membership is 100% `learner_enrollments`, confirmed absent from both the Core migration and `types/core.ts`.
- `onboardLearner()` (`lib/core/learnerOnboarding.ts:167-190`) automatically creates the `learner_enrollments` row as its third pipeline step (`ensureEnrolled`) — admission and enrollment are not separate manual actions when a secretary/admin uses this orchestrator. **This directly satisfies the mission's "secretary admission automatically appears to the teacher" requirement, at the data layer** — subject to the teacher-facing read actually querying `learner_enrollments` (it does not yet — see §2).
- `transferLearner()` status-transitions `learner_enrollments.status` to `'transferred'` (via `withdrawActiveEnrollments`) rather than deleting — inactive/transferred learners disappear from an `status='active'`-filtered roster query correctly, while remaining historically queryable.
- **Not fully confirmed (flagged, not asserted)**: whether every write path touching `learner_enrollments` (specifically inside `lib/core/promotions.ts`, not directly inspected this sprint) ever hard-deletes a row. The two flows actually read (`onboardLearner`, `transferLearner`) both status-transition; promotions was not verified. Recommend a targeted grep of every `.from('learner_enrollments')` call before cutover, not a broad "trust the pattern" assumption.
- **Gap, not a defect**: every Core class has a roster source (`learner_enrollments`) once a learner is enrolled, but nothing currently reads it for the teacher-facing workspace — this is purely an unbuilt read, not a missing capability.

---

## 5. Evidence Compatibility Audit

This is the load-bearing section for the whole verdict (§1).

- `class_assessments.class_id → teacher_classes.id` (legacy), confirmed live per `academicBridge.ts`'s own header, itself confirmed against the running database this session.
- `learner_marks.student_id → students.id` (legacy), same confirmation basis.
- `assignments`/`assignment_submissions`: queried in `lib/gradebook/gradebook.ts` filtered by legacy `class_id`/`teacher_id`/`student_id` throughout — legacy id space.
- `learner_evidence.learnerId` is `mark.student_id` (legacy `students.id`), confirmed via `lib/assessments/evidence.ts:113` → `lib/intelligence/evidenceLifecycle.ts`'s claim key.
- `compass_sessions.learner_id → students.id` (legacy), confirmed via the two `lib/teacherWorkspace/*` files this sprint's predecessor wrote (`classDetailProjection.ts`, `classInsightsProjection.ts`), both of which already query it against legacy `class_students`-derived student ids.
- The only existing bridge (`lib/core/academicBridge.ts`, "Sprint 9F") creates one legacy *shadow* row per Core class/learner, linked via a pre-existing `external_id` column on `teacher_classes`/`students`/`class_assessments`, and is invoked lazily — only when a teacher writes a new assessment through the one route it's wired into. It is explicitly not meant to be extended: its own header states it should be "retired, not extended" once Phase 11 (a Core-native `LearnerContext` for Compass) lands, and that "nothing outside it should ever import from it except the one route wired in this sprint."
- **Verdict for this section, stated plainly per the mission's instruction not to redirect if evidence would disconnect**: redirecting Teacher Workspace's class/roster identity to Core `classes`/`learner_enrollments` is safe on its own. Redirecting the *evidence-dependent* fields (`avg_level`, `overallLevel`, gradebook rows, risk buckets, Compass/Blueprint access) to be computed from Core ids is **not** safe today — those tables don't know about Core ids at all except through the lazy, single-purpose bridge. Do not redirect those fields until either (a) Phase 11 lands, or (b) a new, narrowly-scoped, observable bridge is purpose-built for this read path specifically (not a reuse of `academicBridge.ts`, which was built and documented as off-limits to new callers).

---

## 6. Permission Replacement Design

**Current state**: `lib/core/permissions.ts` has 17 exported functions (confirmed by direct listing) including `requireSchoolMembership`, `requireSchoolAdmin`, `requireTeacher`, `requireSchoolStaff`, `canManageClass`, `canManageAssessment`, `canEditReport`/`canPublishReport` — but **no Core-side equivalent of `requireClassTeacher`**. `canManageClass` is admin-only (no teacher-assignment branch despite an aspirational-sounding doc comment); `canManageAssessment` resolves teacher-ness through legacy `requireClassTeacher`, not `class_subjects`.

**Design — `requireClassSubjectAssignment(client, classId, subjectId?)`** (name illustrative, not yet built):

1. `requireSchoolMembership(client, schoolId)` — derives `schoolId` from the target `classes.school_id`, not from the caller's claim, so a caller can't assert a school context that doesn't match the resource.
2. If the caller's `role` is admin-tier (`school_admin`/`headteacher`/`deputy_headteacher`), grant — matches `canManageClass`'s existing admin-always-allowed pattern.
3. Otherwise, require an active `class_subjects` row where `teacher_id` resolves (via `school_users.id`, not `auth.users.id` directly — see §3's indirection) to the caller's membership, for this exact `class_id` (and `subject_id`, when the action is subject-scoped, e.g. gradebook entry vs. class roster view).
4. Explicitly re-check `school_users.is_active` at call time, not just at `class_subjects` row-creation time — this is what closes the "deactivated teacher keeps class_subjects rows" gap (§3) at the *read* boundary even before the write-side cleanup function is built. A `false` on `is_active` must deny regardless of any surviving `class_subjects` row.
5. Never use the unscoped `findSchoolUserByUserId` inside this function — always resolve membership via the explicit `(userId, schoolId)` pair, so a genuinely multi-school teacher never gets an arbitrary cross-school grant (§3's confirmed ambiguity).

This function replaces `requireClassTeacher` for every Core-native call site; it does not touch or modify `requireClassTeacher` itself, which stays as-is for the still-live legacy write paths (§13) until they're frozen.

---

## 7. No-School State Design

**Current state, confirmed by direct read**: `app/teacher/layout.tsx` gates on the **legacy `teachers` table** only, with a side door for admin-tier Core members; there is no dedicated "authenticated, no active `school_users` row" screen. `app/teacher/setup/page.tsx` is the legacy signup-completion form (posts to `POST /api/teacher/profile`, creates a `teachers` row) — it has no awareness of Core membership, invitations, or `getTeacherReadiness()` at all. `getTeacherReadiness(userId, schoolId)` already returns the right underlying signal shape (`isSchoolMember`, `hasActiveMembership`, `readyForClassAssignment`) but nothing in the UI reads it today.

**Design for the five states the mission names**:

| State | Signal | Required UI |
|---|---|---|
| Signed up independently, no membership anywhere | `resolveMembership` returns `null` for every school the user might plausibly belong to (no `schoolId` to even check against without one) | "You're not yet part of a school on EduNexus. Ask your school administrator to invite you." — no class/learner creation entry points rendered at all |
| Has a pending invitation | `school_users` row exists with `is_active=false` (per `getTeacherReadiness`'s `isSchoolMember:true, hasActiveMembership:false`) | "You've been invited to {school_name} — accept to start teaching" with an explicit accept action, not a generic pending spinner |
| Was deactivated | Same `is_active=false` shape as pending — **currently indistinguishable from a fresh pending invite in `getTeacherReadiness`'s return shape** (confirmed: both collapse to `hasActiveMembership:false`) | Needs a distinguishing signal before this can render correctly — e.g. whether `joined_at` was ever set (a pending invite has never joined; a deactivated teacher has). Flagged as a UI/service gap to close before cutover, not solvable with today's `getTeacherReadiness` shape alone |
| Belongs to multiple schools, no context selected | Multiple active `school_users` rows for this `userId` | An explicit school-selector step before any workspace renders — never silently pick the first/arbitrary one (directly enforced by never calling the unscoped lookup, §3/§6) |
| (Baseline) Active, single school | `resolveMembership` returns an active row | Normal workspace |

**Hard requirement carried through from the mission**: none of these states may return a generic 500, and none may trigger `resolveOwningSchool`'s auto-provisioning — the no-school state's entire purpose is to replace that auto-provisioning behavior with an honest, blocked, guided state.

---

## 8. Legacy Write-Freeze Matrix

| Path | Current auth | `resolveOwningSchool` wired in? | Classification |
|---|---|---|---|
| `POST /api/teacher/classes` (create class) | `requireAuthentication` + `resolveTeacher` | **Yes, live** — auto-provisions a school on first write | **Block immediately** once the no-school state (§7) exists — this is the exact auto-provisioning path the mission's frozen principles forbid. Until then, keep temporarily (removing it with no replacement UI would 500 every teacher with no school) |
| `POST /api/teacher/classes/[classId]/students` (create+enroll learner) | `requireAuthentication` + `requireClassTeacher` | **Yes, live** | Same as above — block immediately after §7 ships, keep temporarily until then |
| `app/api/teacher/students/[studentId]/promote/route.ts` | `requireAuthentication` + `requireClassTeacher` ×2 (source and destination class) | Not wired (acts on existing rows, not a new institutional write) | **Keep temporarily for legacy-only schools** — a school with no Core presence yet has no other way to promote; redirect to `POST /api/core/promotions` once that school has Core class/learner parity, not before |
| `app/api/teacher/classes/[classId]/generate-reports/route.ts` | `requireAuthentication` + `requireClassTeacher` | Not wired | **Keep temporarily for legacy-only schools**, same reasoning; redirect to the Core `publishReportCards` flow once parity exists per-school |

**Per-school freeze rule** (as the mission explicitly asks for, given a platform-wide freeze would disrupt existing pilot users on the legacy path): freeze a given `school_id`'s legacy write paths only once that school has a Core `schools` row AND at least one Core `classes`/`learner_enrollments` row — i.e. once the school has actually started using Core, not before. A school that has never touched Core at all keeps full legacy write access until it's explicitly onboarded. This avoids the false choice between "freeze everyone, break active pilot teachers today" and "freeze no one, let the auto-provisioning anti-pattern keep compounding."

---

## 9. Projection Contract Matrix

| Field (current legacy output) | Classification | Notes |
|---|---|---|
| Class `id`, `name`, `grade`, `subject`, `class_code`, `academic_year` | Directly available (Core `classes`) | `class_code` semantics differ — Core doesn't generate teacher-invented codes; treat as legacy-only display convenience, not an institutional fact |
| `student_count` | Derivable | From `learner_enrollments` count, once roster read redirects |
| `avg_level` / `overallLevel` / standing | **Unavailable without an evidence bridge** | See §5 — this is the crux of "READY WITH CONDITIONS," not "unavailable forever" |
| `class_students(count)` embedded field (legacy `classesListProjection`'s raw spread) | Legacy-only, should retire | This field encodes the legacy table's own embed shape, not an institutional fact — do not carry it forward into a Core-sourced response |
| `teacher_id` on any roster/class row (legacy `teacher_classes.teacher_id`) | Legacy-only and should retire, per CLAUDE.md's own standing rule ("who entered this," never "who owns this") | Redirect fully replaces this with `class_subjects.teacher_id` used only for assignment resolution, never surfaced as "ownership" in the response body |
| `daysInactive`, `lastActive` | Requires adapter | Currently from `compass_sessions.learner_id` (legacy). Same evidence-bridge blocker as standing |
| `subjectScores`, `assessment` object | Unavailable without an evidence bridge | Same |
| `holidayRisk`, `riskLevels`, `subjectDistribution` (insights) | Unavailable without an evidence bridge | Same — this entire projection is evidence-derived, so `getTeacherClassInsightsProjection` cannot redirect at all until §5 closes |
| `recommendations` (class-detail) | Derivable, but only after the fields it depends on (`topGaps`) are available | Same blocker |

**Rule applied**: preserve every field whose institutional meaning survives the redirect; retire every field that encoded teacher-ownership as if it were institutional fact; leave every evidence-derived field explicitly "requires adapter" rather than quietly redirecting it to return empty/null data.

---

## 10. Adapter Design

Narrowest seam, per the mission's preferred shape (institutional repositories/services → Teacher Workspace application services → existing projection output), split along the §1/§5 boundary rather than built as one switch:

```
lib/teacherWorkspace/
  standing.ts                     (unchanged — pure, source-agnostic)
  classListProjection.ts          ← reads teacher identity/roster from
  classDetailProjection.ts          Core (class_subjects, learner_enrollments)
  classInsightsProjection.ts        once the two §13 blockers close;
  dashboardProjection.ts            continues reading assessments/marks/
                                     compass_sessions/gradebook from LEGACY
                                     tables via the learner's bridged legacy
                                     id, resolved through a new, narrow,
                                     read-only lookup — NOT academicBridge.ts
                                     itself (reserved for its one existing
                                     write-path caller, per its own header)
```

**New, small, purpose-built lookup** (illustrative name: `resolveBridgedLegacyIds(coreClassId, coreLearnerId): {legacyClassId, legacyStudentId} | null`) — reads the existing `external_id` linkage `academicBridge.ts` already established as a concept (shadow rows on `teacher_classes`/`students`, linked via `external_id`), but only *reads* it; it never creates a bridge row itself (that write stays exclusively inside `academicBridge.ts`'s existing route). If no bridge row exists yet for a given Core learner, evidence-dependent fields return the "requires adapter, not yet available" shape (§9), not an error and not silently-empty-looking-like-zero data — the UI must be able to tell "no evidence exists" apart from "evidence exists but isn't bridged yet."

**Routes never query Core directly** — confirmed as already true for the four `lib/teacherWorkspace/*` files (prior sprint's thin-route discipline); this design preserves that invariant, it does not reintroduce direct Core queries into `app/api/teacher/classes/**`.

**No permanent dual-read**: the split above is time-bounded by construction, not by policy — the evidence-dependent branch exists only until §5's blocker closes (Phase 11 or a purpose-built bridge), at which point `lib/teacherWorkspace/*` reads Core end-to-end and the legacy-read branch deletes. This should be tracked as an explicit, named, observable flag (not an indefinite "TODO"), consistent with the mission's "explicitly time-bounded and observable" instruction.

---

## 11. Runtime Test Plan

All 12 mission-specified scenarios, mapped to what they'd actually exercise:

1. **Principal creates and activates school** — `POST /api/core/school` → `activateSchool()`. Already covered by existing Core test suites; re-run, not new.
2. **Admin invites teacher** — `inviteTeacher()`. Existing coverage; re-run.
3. **Admin assigns teacher to class/subject** — `assignSubjectTeacher()`. Existing coverage; re-run.
4. **Teacher logs in, sees assigned class without creating it** — **new test**, exercises the redirected `getTeacherClassListProjection` reading `class_subjects` — the direct proof of the mission's success condition.
5. **Secretary admits learner** — `onboardLearner()`. Existing coverage; re-run, but add an assertion that `learner_enrollments` is created in the same call (already true per §4, worth a regression test specifically pinning it).
6. **Teacher roster updates from institutional enrollment** — **new test**: admit a learner via (5), then immediately re-fetch the redirected class-detail projection with no manual refresh/sync step, confirm the new learner appears — this is the literal proof of Projection Invariant "no manual synchronization" from the prior audit.
7. **Teacher cannot see unassigned class** — **new test** for the new `requireClassSubjectAssignment` primitive (§6) — a teacher with no `class_subjects` row for a given class gets denied, not just an empty roster.
8. **Deactivated teacher loses access** — **new test**, and the direct proof that §6 step 4 (re-checking `is_active` at read time, not relying on `class_subjects` row survival) actually works — this test should fail against a naive implementation that only checks `class_subjects` existence.
9. **Replacement teacher inherits same class and roster** — **new test**: reassign `class_subjects.teacher_id` to a new teacher, confirm the new teacher's workspace shows the identical class/roster with zero data loss, and confirm the old teacher's access is gone (depends on §3's currently-missing reassignment cleanup — this test cannot pass until that gap closes).
10. **Evidence/history remains attached to learner and class** — **new test**, and the one that directly validates §5/§10: bridge a Core learner, record an assessment, confirm it's still retrievable after any Core-side class/roster redirect.
11. **Teacher with no school sees a clear pending state** — **new test** for §7's three no-school variants (independent signup, pending invite, deactivated) — must assert a real user-facing message, not a redirect loop or 500.
12. **Multi-school teacher resolves explicit school context safely** — **new test**: a user with two active `school_users` rows must be forced through an explicit school-selector, never silently defaulted (proves §3/§6's "never use the unscoped lookup" rule holds under a real multi-school fixture, which today's Reference School v1 fixture does not include — a new fixture variant is needed for this test alone).

---

## 12. Implementation Sequence

| # | Step | Entry criteria | Exit criteria | Rollback point | Tests | Behavior change? |
|---|---|---|---|---|---|---|
| 1 | Build institutional assignment read service (list classes for a teacher, not just subjects for a class) | §2's gap closed conceptually | New `lib/core/*` function exists, unit-tested, unused by any route yet | Delete the file — nothing else depends on it | New unit tests only | No |
| 2 | Build institutional roster read service wrapper in `lib/teacherWorkspace/` (calls `findActiveEnrollmentsByClass`) | Step 1 done | Roster read available, still unused by production routes | Delete the file | Unit tests | No |
| 3 | Add `requireClassSubjectAssignment` permission primitive (§6) | Steps 1-2 done | Function exists, unit-tested against fixtures covering deactivated/multi-school/unassigned cases | Delete the function | Tests 7, 8, 12 from §11 | No (net-new, unused) |
| 4 | Add no-school/pending workspace state (§7) | None (independent of 1-3) | `app/teacher/layout.tsx` and `/teacher/setup` recognize all five states from §7's table, render guidance instead of falling through | Revert the layout/page changes | Test 11 | **Yes** — this is the first user-visible change, but strictly additive (adds a state, doesn't remove the legacy `teachers`-gate fallback yet) |
| 5 | Add the read-only bridged-legacy-id lookup adapter (§10) — explicitly not extending `academicBridge.ts` | Steps 1-3 done | Lookup exists, returns `null` correctly for unbridged learners, unit-tested | Delete the function | New unit tests + test 10 | No (unused until step 9) |
| 6 | Run dual-source comparison in non-user-visible verification mode, **if justified** | Steps 1-5 done | Log-only comparison between legacy-sourced and Core-sourced roster/identity for the same real classes over a defined observation window; flag mismatches | Turn off the comparison logging | None new — this is observability, not a test gate | No |
| 7 | Redirect dashboard (`getTeacherDashboardProjection`) | Step 6 shows no unexplained mismatch for at least one real pilot school | Dashboard reads Core class count instead of legacy | Revert to legacy read (this function has zero evidence-dependent fields, so it's the safest first redirect) | Test 4 | **Yes** |
| 8 | Redirect class list (`getTeacherClassListProjection`) — identity/roster fields only, `avg_level` stays on the §10 legacy-evidence branch | Step 7 stable | Class list shows Core-assigned classes; `avg_level` still resolves via bridged legacy ids where available, else shows "not yet available" | Revert | Tests 4, 6 | **Yes** |
| 9 | Redirect class detail — same split | Step 8 stable | Roster from `learner_enrollments`; standing/gradebook from the bridge adapter | Revert | Tests 6, 9, 10 | **Yes** |
| 10 | Redirect insights — same split, or defer entirely if the split leaves too little of this specific projection intact (it's almost entirely evidence-derived per §9) | Step 9 stable | Either a working split, or an explicit decision to leave insights on legacy until §5 fully closes | Revert | Test 10 | **Yes, or deferred** |
| 11 | Freeze teacher class creation, per-school rule (§8) | Steps 4, 7-9 stable in production for at least one real school | `POST /api/teacher/classes` blocked for any school with Core presence, using §7's no-school-state UI as the block message where relevant | Re-enable the route | None new — covered by §8's matrix | **Yes** |
| 12 | Freeze teacher learner creation, same rule | Same | `POST /api/teacher/classes/[classId]/students` blocked under the same per-school rule | Re-enable | None new | **Yes** |
| 13 | Observe | Steps 1-12 done for at least one real pilot school | A defined observation window with no regression reports | N/A — this is a waiting period, not a code change | N/A | No |
| 14 | Retire legacy reads later | Phase 11 (or the purpose-built bridge from §10) has closed the evidence gap for *every* active school, not just the observed one | Legacy-read branch in `lib/teacherWorkspace/*` deleted | This step is intentionally the last, hardest-to-reverse one — do not attempt until §5 is unconditionally closed platform-wide | Full regression suite | **Yes, and irreversible without re-adding the legacy branch** |

---

## 13. Remaining Blockers

Three block cutover outright; the rest are conditions that narrow scope but don't block starting:

1. **No cleanup path for `class_subjects`/`classes.class_teacher_id` on teacher deactivation/replacement** (§3). Blocks Test Plan items 8 and 9 directly, and violates the frozen principle "a teacher without an active school assignment has no teaching workspace" if left unaddressed — a deactivated teacher's assignment rows silently persist. Must be built (or explicitly covered by §6 step 4's read-time `is_active` re-check, which mitigates but doesn't fully substitute for a real cleanup function) before step 11/12 of §12.
2. **No "list classes assigned to this teacher" query exists** — only "list subjects for a given class" (`listClassSubjects`) was found. The class-list projection's entire redirect depends on the reverse direction existing. This is §12 step 1's explicit purpose — a real, if small, build item, not yet done.
3. **Evidence/assessment/gradebook/Compass id-space mismatch** (§5) — the platform's single largest blocker to a full cutover, by design not oversight, and the reason this verdict is conditional rather than unconditional.

Narrowing (non-blocking) conditions:
4. `getTeacherReadiness()` cannot currently distinguish "pending invite" from "deactivated" (§7) — needed for a correct no-school-state UI, not for the read-path redirect itself.
5. Co-teaching is structurally unsupported (§3) — only relevant if a real pilot school needs it; not required for cutover of the common case.
6. `learner_enrollments` hard-delete guarantee not fully verified across every write path, specifically `lib/core/promotions.ts` (§4) — a fast follow-up grep, not a structural blocker.
7. `/teacher/core-office/page.tsx`'s existing pending-state handling (if any) was not read this sprint — worth checking before building §7's UI from scratch, in case some of it already exists.

---

## 14. Final Status

**READY WITH CONDITIONS.**

Not READY: the evidence/gradebook/Compass id-space mismatch (§5, blocker 3) is real, confirmed, and architectural — a bare redirect would silently corrupt teacher-visible data (empty averages, empty gradebooks) for exactly the pilot schools this platform exists to serve. This is disqualifying for an unconditional go.

Not NOT READY: the identity/roster half of the target chain is genuinely built, admin-gated, and correct on the Core side today — `class_subjects`, `learner_enrollments`, `resolveMembership`, the whole admin-tier permission model. Two small builds (blockers 1-2) and one explicitly-scoped adapter (§10) are enough to redirect that half safely, observably, and reversibly, exactly per the sequence in §12, without waiting on the evidence-layer question at all.

**Condition for a future unconditional READY verdict**: either Phase 11 (Compass/Evidence ported onto Core-native identity, named as `academicBridge.ts`'s own retirement trigger) lands, or a purpose-built, narrow, observable read-only bridge (§10) is built and proven against real pilot data — at that point §12 step 14 becomes safe to execute, and this document's successor can say READY without qualification.
