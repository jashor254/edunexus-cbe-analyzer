# Sprint 11C — Attendance Repository Layer

**Status:** Complete — repository only. No service, route, UI, business logic, or test was written. **Awaiting explicit approval before Sprint 11D.**

**Implements**: the persistence layer for the schema laid down in Sprint 11B (`docs/architecture/sprint-11b-attendance-schema.md`), per ADR-0003 (`docs/architecture/adr-0003-attendance-domain.md`).

**File**: `lib/repositories/attendance.repository.ts`

---

## Repository Responsibilities

`AttendanceRepository` owns persistence only, matching every existing Core repository (`SchoolRepository`, `LearnerRepository`, `TeacherRepository`, `PromotionRepository`):

- **Does**: insert, update, delete, and lookup rows in `attendance_sessions`/`attendance_records`, scoped by the canonical ids callers supply.
- **Does not**: validate input, check permissions, decide teacher ownership, apply attendance rules (e.g. "can't mark a locked session"), compute summaries/percentages/streaks, or make any business decision. Those are Sprint 11D's (Core service layer) responsibility, per ADR-0003 §4/§7 and this sprint's explicit mission.

No new architectural pattern was introduced — `AttendanceRepository extends BaseRepository`, uses `this.db` (the shared service-role Supabase client every repository already uses), one `_COLS` constant per row shape, and `throw new Error(\`methodName: ${error.message}\`)` on every Supabase error, exactly matching `PromotionRepository`, `LearnerRepository`, and `SchoolRepository`'s existing style.

---

## Method Inventory

### Read operations

| Method | Signature | Serves |
|---|---|---|
| `findSessionById` | `(id, schoolId) → AttendanceSessionRow \| null` | Direct session lookup, school-scoped. |
| `findSessionByUniqueKey` | `(schoolId, classId, attendanceDate, sessionType?) → AttendanceSessionRow \| null` | The session's natural business key — matches the live `UNIQUE(class_id, attendance_date, session_type)` constraint from Sprint 11B, for idempotency-style checks (mirrors `LearnerRepository.findByAdmissionNumber`'s precedent). |
| `listSessionsForClass` | `(classId, schoolId) → AttendanceSessionRow[]` | **Class lookup**, served by `idx_attendance_sessions_class_id`. |
| `listSessionsForSchool` | `(schoolId) → AttendanceSessionRow[]` | **School lookup**, served by `idx_attendance_sessions_school_id`. |
| `listSessionsByDateRange` | `(schoolId, dateFrom, dateTo) → AttendanceSessionRow[]` | **Date lookup**, served by `idx_attendance_sessions_date (school_id, attendance_date)`. |
| `findRecordById` | `(id) → AttendanceRecordRow \| null` | Direct record lookup ("Get attendance record"). |
| `listRecordsForSession` | `(sessionId) → AttendanceRecordRow[]` | **Attendance session lookup** (all records in one session), served by the `UNIQUE(attendance_session_id, learner_id)` constraint's index (Sprint 11B's Index Rationale — no separate index needed). |
| `listLearnerAttendanceHistory` | `(learnerId) → AttendanceHistoryRow[]` | **Learner history**, served by `idx_attendance_records_learner_id`. Joins to `attendance_sessions` (`!inner`) to bring back `attendance_date`/`class_id`/`term_id`/`school_id` — a bare list of status rows with no date would not be a "history" at all; this is a lookup-shape decision, not a computed summary (no count, percentage, or aggregation is added). Ordered by `created_at` — calendar-date resorting/grouping is a service-layer interpretation, not a repository concern (see "Why business logic is excluded" below). |

### Write operations

| Method | Signature | Notes |
|---|---|---|
| `createSession` | `(input: NewAttendanceSession) → AttendanceSessionRow` | `session_type` defaults to `'daily'` if omitted, matching the DB column default. |
| `updateSessionMetadata` | `(id, schoolId, update: AttendanceSessionMetadataUpdate) → AttendanceSessionRow` | Metadata-only, per the sprint's explicit instruction. The type restricts the update to `marked_by_teacher_id` — the only field on a session that is genuinely metadata rather than identity. `attendance_date`/`class_id`/`term_id`/`academic_year_id`/`school_id` are never mutable through this method; they define what the session *is*, not annotate it. |
| `deleteSession` | `(id, schoolId) → void` | School-scoped delete. |
| `insertAttendanceRecord` | `(input: NewAttendanceRecord) → AttendanceRecordRow` | Single-row insert. |
| `updateAttendanceRecord` | `(id, update: AttendanceRecordUpdate) → AttendanceRecordRow` | Restricted to `status`/`arrival_time`/`departure_time`/`notes` — never `attendance_session_id`/`learner_id`, which are identity, not metadata. |
| `deleteRecord` | `(id) → void` | Direct delete by id. |

### Bulk operations

| Method | Signature | Notes |
|---|---|---|
| `bulkInsertAttendanceRecords` | `(rows: NewAttendanceRecord[]) → AttendanceRecordRow[]` | A single `insert([...])` call, matching `AssessmentRepository.insertMarks`'s exact bulk-insert precedent. Guards against a zero-length array short-circuiting to an empty result without a wasted round-trip (matches `bulkInsertAttendanceRecords([])` → `[]`, no query issued). No duplicate-detection, no partial-success handling, no validation — the live `UNIQUE(attendance_session_id, learner_id)` constraint (Sprint 11B) is the only thing preventing a duplicate learner-in-session row, and a violation surfaces as a thrown Postgres error for Sprint 11D's service layer to interpret, exactly as the mission's Error Handling section specifies ("let services own interpretation"). |

Nothing in this table computes a total, a percentage, or a summary — every method returns exactly the rows Postgres returns, reshaped only enough to be typed (never aggregated).

---

## Identity Rules

Every method's parameters are canonical Core ids only:

- `school_id` → `schools.id`
- `academic_year_id` → `academic_years.id`
- `term_id` → `terms.id`
- `class_id` → `classes.id`
- `learner_id` → `learners.id`
- `marked_by_teacher_id` → `school_users.id` (Core's own teacher-in-school identity — **not** `teachers.id`, the identity ADR-0002 found canonical for the separate, older Assessment domain; Sprint 11B's FK Rationale already settled this, not re-litigated here)

No method accepts or references a legacy `student_id`, `teacher_classes` id, Evidence id, Projection id, or Report Card id — confirmed by inspection: the file imports nothing from `types/core.ts`, `lib/intelligence/`, or any Evidence/Projection module, and every `.from(...)` call targets only `attendance_sessions`/`attendance_records`.

---

## Why Business Logic Is Excluded

Every capability explicitly forbidden by the sprint mission was checked against the method list above and confirmed absent:

- **Attendance rules / duplicate detection**: the repository does not check "has this class already been marked today" before `createSession` — it relies entirely on the live `UNIQUE` constraint to reject a duplicate, and lets the caller (Sprint 11D) decide what to do with that error (retry, look up the existing session via `findSessionByUniqueKey`, etc.). The repository itself makes no decision.
- **Teacher ownership / authorization**: no method checks whether the calling teacher currently teaches the class in question — that check belongs to `lib/core/permissions.ts` in Sprint 11D, exactly as `PromotionRepository.archiveClass`'s own precedent shows a repository *can* take an ownership id as a filter parameter (matching a WHERE clause) without *deciding* whether that ownership is valid; `AttendanceRepository` doesn't even go that far, since Sprint 11B's ownership model (ADR-0003 §5/§8) explicitly routes teacher-class authorization through `class_students`/current teaching assignment, a check this repository has no reason to perform.
- **Completion / readiness / summaries / percentages / streaks / monthly or term history / absence statistics**: none of these are stored, computed, or returned by any method — `listLearnerAttendanceHistory` returns raw rows with session context, never a computed figure.
- **Report card updates, events, notifications, intelligence, analytics**: no method touches `school_report_cards`, `learner_evidence`, any Projection/Compass table, any notification table, or publishes any event. Confirmed by inspection — the file has exactly one import (`BaseRepository`) and touches exactly two tables.

This isn't an oversight-driven omission — it is the sprint's stated boundary, and every capability on the "Explicitly Forbidden" list was checked off as genuinely absent, not merely unmentioned.

---

## Error Handling

No custom error hierarchy or attendance-specific exception type was introduced. Every mutating method and every `.maybeSingle()`/`.single()` read throws a plain `Error` with the method name and the underlying Supabase error message, matching `PromotionRepository`/`LearnerRepository`/`SchoolRepository`'s exact convention.

**One deliberate deviation from a narrower precedent**: two existing methods in `LearnerRepository` (`findByAdmissionNumber`, `findGuardianByPhone`) destructure only `data` from a `.maybeSingle()` call and never check `error`, silently swallowing a possible query failure. CLAUDE.md's Error Handling rules state "NEVER swallow errors silently" as an unconditional, overriding project standard — not a suggestion. Every read method here (`findSessionById`, `findSessionByUniqueKey`, `findRecordById`) checks and throws on `error`, even though the two-line pattern in `LearnerRepository` would have been a shorter mirror. This is the one place this sprint chose "follow the stated rule" over "mirror the nearest precedent exactly," because the rule is explicit and the precedent is a pre-existing inconsistency, not a deliberate convention.

No transactions are used or implied — every method is independently composable, exactly as the mission specifies; Sprint 11D's service layer decides whatever transactional boundaries it needs (e.g. "create a session, then bulk-insert its records" as two repository calls in sequence, with the service layer responsible for any compensating action if the second call fails).

---

## RAS Compliance

- **Repository Architecture Standard**: one class extending `BaseRepository`, one `_COLS` constant per row shape, registered nowhere yet — see "Future Service Extension Points" below for why.
- **Canonical Domain Registry**: `AttendanceRepository` is the Attendance domain's one and only repository, per ADR-0003's decision that Attendance is its own canonical domain (not folded into `SchoolRepository` or `LearnerRepository`).
- **No duplicate repository patterns introduced**: confirmed by inspection — the class shape, column-constant convention, and error-throwing style are identical to every existing repository; no repository factory, no abstraction layer, no generic CRUD base beyond the existing `BaseRepository` was added.
- **No direct Supabase queries outside the repository**: confirmed — this sprint touched exactly one file; no route, service, or component references `attendance_sessions`/`attendance_records` anywhere in the codebase (grep-confirmed zero other hits).

---

## ADR-0003 Compliance

| ADR-0003 section | This repository |
|---|---|
| §4 Domain Model | Two row types (`AttendanceSessionRow`, `AttendanceRecordRow`) mirror the two stored tables exactly; no `AttendanceSummaryRow` type exists — Summary stays computed-on-read, and this repository provides no summary/aggregate method for a future service to be tempted to call instead of computing it. |
| §5 Ownership Model | `marked_by_teacher_id` typed as `string \| null` referencing `school_users(id)`, never `teachers(id)` — matches Sprint 11B's identity choice exactly; the repository does not interpret this field (no ownership check), consistent with §5/§8's "never used for access control" rule. |
| §6 Status Model | `AttendanceStatus` is a 4-value union (`'present' \| 'absent' \| 'late' \| 'excused'`) matching the live `CHECK` constraint exactly — no fifth `early_departure` value, matching ADR-0003 §6's decision to defer that to the (typed, present, uninterpreted) `departure_time` field. |
| §7 Lifecycle | No "lock" concept is implemented here — `updateSessionMetadata`/`updateAttendanceRecord` exist as plain persistence operations; whether/how a session becomes "locked" is Sprint 11D's business logic, not this repository's. |
| §9 Integration Boundaries | Confirmed zero references to Evidence, Report Cards, Projection, or Intelligence tables anywhere in this file. |
| §13 Decision | Attendance still consumes nothing — every method reads/writes only `attendance_sessions`/`attendance_records`, using canonical ids as filters into its own two tables. |

---

## Future Service Extension Points (not built this sprint)

- **Repository registration**: `AttendanceRepository` is **not** added to `lib/repositories/index.ts`'s `repos` object in this sprint, despite every other repository being registered there. The sprint's own scope was explicit and repeated ("Produce only: `lib/repositories/attendance.repository.ts` ... Nothing else") — registration is trivial wiring, not business logic, but it is a second file, so it was deliberately left out rather than added silently. **Flagged as the first thing Sprint 11D should do** before writing `lib/core/attendance.ts`, since a service layer will need `repos.attendance` to exist.
- **Session locking**: Sprint 11D will need to decide how a session becomes "locked" (per ADR-0003 §7) — whether that's a new column (requiring a Sprint 11B-style follow-up schema change) or an existing-field convention (e.g. treating "has any record" as locked) is not decided here.
- **Teacher-ownership authorization**: Sprint 11D wires `requireSchoolMembership`/a class-teaching check (per ADR-0003 §5/§8) around every write method exposed here — this repository performs zero authorization itself, by design.
- **Bulk upsert semantics**: `bulkInsertAttendanceRecords` is a pure insert; if Sprint 11D needs "insert or update" (re-marking a session), that decision — and whatever upsert/on-conflict logic it requires — belongs there, not here.
- **Attendance Summary computation**: per ADR-0003 §4, a future `getClassAttendanceSummary`/`getLearnerAttendanceSummary`-style function belongs in `lib/core/attendance.ts` (Sprint 11D), built on top of `listRecordsForSession`/`listLearnerAttendanceHistory`, never as a repository method or a new stored table.
