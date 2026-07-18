# Sprint 11D — Attendance Service Layer

**Status:** Complete — service only. No route, UI, or cross-domain integration was written. **Awaiting explicit approval before Sprint 11E.**

**Implements**: the business-rule layer over `AttendanceRepository` (Sprint 11C) and the schema (Sprint 11B), per ADR-0003 (`docs/architecture/adr-0003-attendance-domain.md`).

**Files**: `lib/core/attendance.ts` (new), `lib/repositories/index.ts` (registration only — `AttendanceRepository` added to the `repos` barrel, three lines, no other change).

---

## Service Responsibilities

`lib/core/attendance.ts` owns every business rule Attendance has. `AttendanceRepository` (Sprint 11C) remains persistence-only — this sprint added zero methods to it and zero direct Supabase calls anywhere in the service (confirmed by grep: no `createServiceClient`, `createClient`, or `.from(` appears in the file). Every read/write goes through one of:

- `repos.attendance.*` (the Sprint 11C repository), or
- an existing Core service function reused as-is: `getSchoolUser`/`isSchoolAdmin` (`lib/core/school-users.ts`), `getClass` (`lib/core/classes.ts`), `listAcademicYears`/`listTerms` (`lib/core/school.ts`), `getClassRoster` (`lib/core/learners.ts`).

No new identity-resolution logic was written — every ownership check composes functions that already existed before this sprint.

---

## Method Inventory

Naming follows CLAUDE.md's camelCase convention (the mission's brief used PascalCase as a conceptual listing, e.g. `CreateAttendanceSession()`; every prior sprint's actual code — `runAnnualPromotion`, `activateSchool`, etc. — is camelCase, so this sprint matches established practice, not the brief's literal casing).

### Sessions
`createAttendanceSession`, `getAttendanceSession`, `listAttendanceSessionsForClass`, `listAttendanceSessionsForSchool`, `listAttendanceSessionsByDateRange`, `updateAttendanceSession`, `deleteAttendanceSession`.

### Records
`recordAttendance`, `bulkRecordAttendance`, `updateAttendanceRecord`, `getAttendanceRecord`, `listAttendanceForSession`, `getLearnerAttendanceHistory`, `deleteAttendanceRecord`.

All 14 canonical operations named in the sprint brief are present, one function each — no extra methods, no consolidated do-everything function.

---

## Repository Boundary

Every service function's shape is: **validate → call one or more `repos.attendance` methods → return the repository's result unchanged**. Nothing reshapes, aggregates, or annotates what the repository returns (e.g. `getLearnerAttendanceHistory` filters by `schoolId` — a defensive scope check on rows already returned, not a new computation — and returns the rows exactly as `repos.attendance.listLearnerAttendanceHistory` produced them).

The one place this sprint touched the repository *layer* rather than the repository *file* is `lib/repositories/index.ts`: three lines (one import, one `repos.attendance = new AttendanceRepository()` entry, one re-export), inserted alphabetically between `assessmentTypes` and `billing`, exactly mirroring every other entry's shape. No other line in that file changed.

---

## Validation Rules

### Structural (a session/record cannot exist without its required fields)
`createAttendanceSession` rejects a call missing any of `school_id`/`academic_year_id`/`term_id`/`class_id`/`attendance_date` before doing anything else — directly satisfies "a session cannot exist without school, academic year, term, class, attendance date."

### Status (no coercion, no hidden default, unknown values rejected)
`assertValidStatus` checks the incoming value against the exact four-value set (`present`/`absent`/`late`/`excused`) and throws immediately if it isn't one of them — `recordAttendance` and `updateAttendanceRecord` call it before any other work; `bulkRecordAttendance` validates every row's status up front, before the session is even fetched, so an invalid row can never cause a partial write. **Verified live** (see Verification below): calling the real exported functions with a bogus status string throws the exact validation message, before any database call is attempted.

### Session uniqueness (checked before insert, not caught as a database exception)
`createAttendanceSession` calls `repos.attendance.findSessionByUniqueKey` and throws a descriptive error if a matching session already exists — **before** calling `createSession`. The live `UNIQUE(class_id, attendance_date, session_type)` constraint from Sprint 11B still exists as a backstop against a race between the check and the insert, but it is not what this sprint relies on as the business rule, per the mission's explicit instruction.

### Duplicate learner rejection (both single and bulk)
- `recordAttendance` calls `repos.attendance.listRecordsForSession` and rejects if the learner already has a record in that session, before calling `insertAttendanceRecord`.
- `bulkRecordAttendance` rejects two distinct duplicate shapes: (1) the same learner appearing twice **within the submitted batch itself** — checked with a `Set`, before any DB call, **verified live**; and (2) a learner who **already has a record from an earlier call** — checked via `listRecordsForSession` against the batch, before `bulkInsertAttendanceRecords`.

### Bulk membership ("every learner belongs to the same session")
`bulkRecordAttendance` fetches the session's class roster (`getClassRoster(session.class_id, session.term_id)`) once and rejects any submitted learner not on it — this is the literal enforcement of "every learner belongs to the same session," interpreted as "every learner is actually enrolled in the class this session covers," since a session has exactly one class and a learner not enrolled in that class cannot sensibly have attendance recorded against it.

---

## Canonical Ownership

The full chain — **School → Academic Year → Term → Class → Teacher → Attendance Session → Attendance Record** — is validated by one shared internal function, `assertOwnershipChain`, called by every session- and record-mutating/reading operation (except the two admin-only school-wide listings, and the two class-scoped listings, which each perform the relevant subset directly):

1. **School**: `getSchoolUser(actorUserId, schoolId)` must resolve to an active `school_users` row — otherwise `MembershipRequiredError`.
2. **Class → School**: `getClass(classId, schoolId)` throws if the class doesn't belong to the given school (existing behavior, reused unchanged).
3. **Class → Academic Year**: the class's own `academic_year_id` (if set) must match the supplied `academicYearId` — otherwise a descriptive "ownership chain broken" error.
4. **Academic Year → School**: `listAcademicYears(schoolId)` must contain the supplied `academicYearId`.
5. **Term → School/Academic Year**: `listTerms(schoolId, academicYearId)` must contain the supplied `termId`.
6. **Teacher → Class**: the acting user must be admin-tier (`isSchoolAdmin`), or their own `school_users.id` must equal `classes.class_teacher_id` — otherwise `ResourceOwnershipError`.

**No link is ever inferred.** If a class has no `class_teacher_id` assigned (the common case, per Sprint 11B/11C's own notes on the activation pipeline), only admin-tier users may act on it in this sprint — there is no unambiguous assignment to defer to, and guessing "any teacher may act on an unassigned class" would be exactly the kind of inference the mission explicitly forbids. A future sprint may choose to broaden this (e.g. via `class_subjects`/current-teaching-assignment), but that is a new decision, not one this sprint makes implicitly.

**No bridge to legacy identity anywhere**: every identifier in every function signature is a canonical Core id (`school_id`, `academic_year_id`, `term_id`, `class_id`, `learner_id`, the acting user's own id) — confirmed by inspection: the file imports nothing from `lib/repositories/teacher.repository.ts`'s legacy `teacher_classes`/`students` surface, `lib/core/permissions.ts`'s `requireClassTeacher` (which itself queries the legacy `teacher_classes` table — deliberately not reused here, since doing so would bridge Attendance, a Core domain, through a legacy identity path), or any other non-Core module.

---

## Why No Summaries Exist

Every capability on the sprint's "Explicitly Forbidden" list was checked against the final file and confirmed absent — not merely unmentioned:

- **No attendance %, summaries, monthly/term attendance, absence/late counts, school/class attendance rollups, learner attendance score, readiness, risk, or analytics** — `getLearnerAttendanceHistory` and `listAttendanceForSession` are the only "many rows" reads, and both return raw `AttendanceRecordRow`/`AttendanceHistoryRow` arrays exactly as the repository produced them. No `.length`, `.filter().length`, percentage, or aggregation of any kind appears anywhere for attendance *values* (the one filter that exists, in `getLearnerAttendanceHistory`, filters by `school_id` for tenant scoping — a defensive-read concern, not a computation over attendance data).
- **Reasoning, not just a rule followed**: per ADR-0003 §4, Attendance Summary is *permanently* a computed-on-read concept, never a stored or service-cached one — but *which* service computes it (this one, in a future sprint, or a dedicated reporting module) is an open question this sprint deliberately leaves open by building nothing that would presuppose the answer. Building even a minimal "count of presents" helper now would quietly answer that question without it being asked.

---

## Explicitly Forbidden Integrations — Confirmed Absent

Grep-confirmed zero references anywhere in `lib/core/attendance.ts` to: `learner_evidence`, `evidenceLifecycle`, `school_report_cards`, `report-cards`, `compass`, `intelligence`, `notification`, `publishEvent`/`events`, `promotions`, `transfers`, `career`, `xp`. The file imports exactly five other modules, all pre-existing Core identity/ownership helpers (`repos`, `lib/core/school-users.ts`, `lib/core/classes.ts`, `lib/core/school.ts`, `lib/core/learners.ts`) plus the shared error hierarchy (`lib/core/errors.ts`) and its own repository's types. Attendance remains isolated, per ADR-0003 §9/§13 — it consumes nothing, and nothing consumes it yet.

---

## Error Handling

No custom error hierarchy or attendance-specific exception type was introduced, per the mission's constraint. Two distinct, deliberate categories:

- **Ownership/authorization failures** reuse the existing `EduNexusError` subclasses from `lib/core/errors.ts` — `MembershipRequiredError`, `PermissionDeniedError`, `ResourceOwnershipError` — exactly as `lib/core/permissions.ts` and `lib/core/academicBridge.ts` already do. This *is* "reusing existing Core validation helpers," applied to error types as much as to the functions that resolve identity.
- **Business-rule violations** (duplicate session, duplicate learner, invalid status, broken ownership-chain link, invalid date range) throw a plain `Error` with a message that names the exact rule violated and the exact ids involved — matching CLAUDE.md's literal `lib/` convention ("throw new Error('descriptive message')"), not a new class hierarchy, since this sprint's deliverables were explicitly scoped to `lib/core/attendance.ts` and repository registration only.

**No silent failures, no swallowed repository errors**: every `repos.attendance.*` call's return value is awaited and either used or the error surfaces to the caller unmodified — nothing is wrapped in a `try`/`catch` that discards it anywhere in this file (confirmed by inspection: the file contains no `catch` block at all).

**No transactions**: every function is independently composable, exactly as specified. `bulkRecordAttendance` is the closest thing to a multi-step operation, and it performs its checks and a single `repos.attendance.bulkInsertAttendanceRecords` call — no read-then-write pair that would need transactional wrapping was introduced.

---

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | Clean. |
| `eslint` (both changed files) | Clean, zero warnings. |
| No direct Supabase access | Confirmed by grep: zero occurrences of `createServiceClient`, `createClient`, or `.from(` in `lib/core/attendance.ts`. |
| Repository composition only | Confirmed by inspection — every DB-touching line is a `repos.attendance.*` call or a call into an existing Core service function, never a raw query. |
| Repository registered correctly | Confirmed: `lib/repositories/index.ts` now imports `AttendanceRepository`, constructs it once as `repos.attendance`, and re-exports the class — matching every other entry's exact shape. |
| Repository methods use canonical schema | Inherited from Sprint 11C's own verification (column names unchanged since). |
| Invalid status rejected | **Verified live.** A temporary scratch script (`tsx --env-file=.env.local`, deleted after use — not a repo deliverable) called the real exported `recordAttendance` and `bulkRecordAttendance` with a bogus status string and confirmed each threw the exact `"Invalid attendance status..."` message. |
| Duplicate learner rejected (within a bulk batch) | **Verified live**, same script: `bulkRecordAttendance` with the same `learner_id` twice in one array threw `"...appears more than once in this batch."` — confirmed before any DB call, since the check runs ahead of the session fetch (deliberately reordered this sprint for exactly this fail-fast property). |
| Bulk validation works (empty-array short circuit) | **Verified live**, same script: `bulkRecordAttendance(..., [])` returned `[]` immediately with no throw and no DB call. |
| Duplicate session rejected | **Verified by code review, not live execution.** `createAttendanceSession` calls `findSessionByUniqueKey` before `createSession` and throws if a match is found — traced through the exact call sequence, but not exercised against a real database this sprint (see Known Limitation below). |
| Ownership-chain / roster validation | **Verified by code review, not live execution** — same limitation. |

**Known limitation, carried over from Sprint 11B**: genuinely exercising `createAttendanceSession`'s duplicate-session check, or any ownership-chain/roster validation, requires a real backing database reachable through `@supabase/supabase-js` (a PostgREST-fronted Postgres, not bare Postgres) with Sprint 11B's migration actually applied — either the real linked Supabase project (not done, per Sprint 11B's own deliberate decision not to push schema changes there without separate approval) or the local Supabase dev stack (`supabase start`), whose `db` container was already missing/broken before this sprint began (a pre-existing condition, confirmed again this sprint, unrelated to this work). The four checks marked "verified live" above were chosen specifically because they run entirely before any database call in the actual code path — confirmed both by code review and by observing that calls made with obviously-fake ids (`'fake-school'`, `'fake-session'`) returned the exact custom validation error rather than a network or "not found" error, which would have surfaced if a DB call had actually been attempted. **Recommend**: once the Sprint 11B migration is applied somewhere real (a decision still awaiting the user's separate go-ahead), a proper `lib/core/attendance.test.ts` — matching the `academicActivation.test.ts` convention exactly (synthetic school/teacher/class/term/learner fixtures, cleaned up in an `after()` hook) — should be written to close this gap. Not written this sprint, since tests were not in the stated deliverables list.

---

## ADR-0003 Compliance

| ADR-0003 section | This service |
|---|---|
| §4 Domain Model | No `AttendanceSummaryRow`-shaped function exists; every method returns Session/Record rows unchanged. |
| §5 Ownership Model | `assertOwnershipChain` implements the exact chain; teacher identity resolved via `school_users`, never `teachers`. |
| §6 Status Model | `ATTENDANCE_STATUSES` is the same 4-value set as the live `CHECK` constraint; no `early_departure` status, matching the deferred-to-`departure_time` decision. |
| §7 Lifecycle | No "locking" concept implemented — `updateAttendanceSession`/`updateAttendanceRecord` are plain metadata mutations; whether/how locking works is left open, per Sprint 11C's own flagged extension point. |
| §8 Security Model | School isolation via `getSchoolUser`; teacher-class ownership via `class_teacher_id`; admin-tier via `isSchoolAdmin`; no parent/student visibility rule invented. |
| §9 Integration Boundaries | Confirmed zero references to Evidence/Report Cards/Compass/Intelligence/Notifications. |
| §13 Decision | Attendance still consumes nothing; every function's only external reads are identity/ownership lookups (school/year/term/class/roster), never another domain's business data. |

## Constitution / RAS Compliance

- **Repository Architecture Standard**: service composes the repository, never bypasses it; no new persistence pattern.
- **No duplicate authorization**: `assertOwnershipChain` is the one function every mutating/most reading operations call — matches the Engineering Rule ("never duplicate authorization") applied within this domain, the same discipline `lib/core/permissions.ts` already enforces platform-wide.
- **No duplicate identity logic**: zero new identity-resolution code — every ownership check calls an existing function.
- **`teacher_id`-is-attribution rule**: `marked_by_teacher_id` is never read as an access-control input anywhere in this file — every ownership check uses `class_teacher_id`/`school_users`/`isSchoolAdmin`, never "who marked this row."

---

## Extension Points Reserved for Sprint 11E+

- **API routes (Sprint 11E)**: every function here takes a plain `actorUserId: string` (not a `SupabaseClient`), matching `lib/core/academicBridge.ts`'s `ensureBridgedClass` signature style — a route will resolve the authenticated user via `auth.getUser()`/`requireAuthentication` first, then pass its `id` straight through. No signature change should be needed.
- **Session locking**: whether a session becomes immutable after some point (per ADR-0003 §7) is not decided here — `updateAttendanceSession`/`updateAttendanceRecord` remain unconditionally callable by the owning teacher/admin today.
- **Broader teacher-class ownership**: the current "only the exact assigned `class_teacher_id`, or admin" rule is deliberately narrow — a future sprint may extend `assertOwnershipChain` to also recognize `class_subjects`-based "currently teaches this class" relationships, without changing any function's external signature.
- **Parent/Student read surfaces (Sprint 11G)**: `getLearnerAttendanceHistory` is admin-tier-only today; a parent/student-scoped variant (or an extension to this same function) is explicitly deferred, not designed here.
- **Report Card integration (Sprint 11H)**: `days_present`/`days_absent` population from computed Attendance Summary needs a summary function that does not yet exist anywhere in this codebase — this sprint deliberately does not build even a minimal version of it (see "Why No Summaries Exist").
- **Attendance Summary itself**: per ADR-0003 §4, belongs in `lib/core/attendance.ts` (or a sibling module) as a read-only computation over `listRecordsForSession`/`listLearnerAttendanceHistory` — never a new stored table, never inside the repository.
