// lib/core/attendance.ts
//
// The canonical Attendance Service (Sprint 11D), composing AttendanceRepository
// (Sprint 11C) on top of the schema laid down in Sprint 11B, per ADR-0003
// (docs/architecture/adr-0003-attendance-domain.md).
//
// This module owns every business rule Attendance has: session uniqueness
// checked before insert (never relying on the DB constraint as the business
// rule, only as a backstop), status validation with no coercion, the
// School -> Academic Year -> Term -> Class -> Teacher ownership chain, and
// duplicate-learner rejection for both single and bulk marking. It never
// queries Supabase directly — every read/write goes through `repos.attendance`
// (lib/repositories/attendance.repository.ts) or an existing Core service
// function (getClass, getSchoolUser, isSchoolAdmin, listAcademicYears,
// listTerms, getClassRoster) — reused exactly as they already exist,
// never re-implemented, per this sprint's explicit "do not duplicate
// identity logic" instruction.
//
// Deliberately excluded (later sprints' scope, per ADR-0003 §9 and this
// sprint's own mission): attendance percentages, summaries, monthly/term
// history aggregation, absence/late counts, readiness, risk, analytics —
// see "Why No Summaries Exist" in docs/architecture/sprint-11d-attendance-service.md.
// No Evidence/Compass/Intelligence/Notification integration exists here or
// is referenced here — per ADR-0004, this file exists to be *read from*,
// never to read or import a consumer domain itself (this file still
// imports nothing from lib/core/report-cards.ts or any other consumer).
//
// Sprint 11H (Attendance Workflow Completion) added two things to this
// file, closing gaps Sprint 11G's own audit found: `getSessionCompletionState`
// (Phase 2 — a computed-on-read completion state, no new table/column) and
// `marked_by_teacher_id` now actually being set, by `recordAttendance`/
// `bulkRecordAttendance` themselves, to the acting teacher's own resolved
// identity (Phase 3 — reusing `assertOwnershipChain`'s existing resolution,
// never a second lookup, never trusted from a caller).
//
// Sprint 12B (Attendance -> Report Card Integration, ADR-0004) added
// `getAttendanceStatusCountsForClass` — the one additive read Report
// Cards' own audit found missing, per ADR-0004 §3/§6. Still computed
// fresh, still no summary stored, still returns raw per-status counts
// rather than deciding what "days present" means (that interpretation
// belongs to Report Cards, per ADR-0004 §4).

import { repos } from '@/lib/repositories'
import type {
  AttendanceStatus,
  AttendanceSessionRow,
  NewAttendanceSession,
  AttendanceSessionMetadataUpdate,
  AttendanceRecordRow,
  NewAttendanceRecord,
  AttendanceRecordUpdate,
  AttendanceHistoryRow,
} from '@/lib/repositories/attendance.repository'
import type { ClassWithDetails, SchoolUser } from '@/types/core'
import { getSchoolUser, isSchoolAdmin } from '@/lib/core/school-users'
import { getClass } from '@/lib/core/classes'
import { listAcademicYears, listTerms } from '@/lib/core/school'
import { getClassRoster } from '@/lib/core/learners'
import { resolveParent } from '@/lib/core/identity'
import { MembershipRequiredError, PermissionDeniedError, ResourceOwnershipError } from '@/lib/core/errors'

const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = ['present', 'absent', 'late', 'excused']

/** Rejects any status not in the canonical four-value set — no coercion, no hidden default. */
function assertValidStatus(status: string): asserts status is AttendanceStatus {
  if (!ATTENDANCE_STATUSES.includes(status as AttendanceStatus)) {
    throw new Error(
      `Invalid attendance status "${status}" — must be exactly one of: ${ATTENDANCE_STATUSES.join(', ')}. No other value, and no default, is accepted.`
    )
  }
}

/**
 * Validates the full canonical ownership chain — School -> Academic Year ->
 * Term -> Class -> Teacher — for a session (existing or about-to-be-created),
 * reusing existing Core service functions for every step rather than
 * re-deriving any of them:
 *  - `getClass` (lib/core/classes.ts) throws if `classId` doesn't belong to
 *    `schoolId` at all — the class/school link.
 *  - the class's own `academic_year_id` is compared against the supplied
 *    `academicYearId` — the class/year link.
 *  - `listAcademicYears`/`listTerms` (lib/core/school.ts) confirm the year
 *    and term genuinely belong to this school (and, for the term, this
 *    year) — the year/school and term/year/school links.
 *  - `isSchoolAdmin`/`getSchoolUser` (lib/core/school-users.ts) resolve
 *    whether the acting user is admin-tier or the class's own assigned
 *    teacher (`classes.class_teacher_id`, matching Sprint 11B's identity
 *    choice) — the teacher/class link.
 *
 * Never infers a missing link (e.g. "any teacher may act on an unassigned
 * class") — an unassigned class (`class_teacher_id` is null) is manageable
 * by admin-tier users only, since there is no unambiguous assignment to
 * defer to and inventing one would be exactly the kind of inference this
 * sprint's mission forbids.
 *
 * Sprint 11H: now also returns the caller's own resolved `schoolUser` row —
 * `recordAttendance`/`bulkRecordAttendance` need it to populate
 * `marked_by_teacher_id` (Phase 3) without a second `getSchoolUser` call,
 * i.e. without duplicating identity resolution already done here.
 */
async function assertOwnershipChain(
  actorUserId: string,
  schoolId: string,
  academicYearId: string,
  termId: string,
  classId: string,
): Promise<{ cls: ClassWithDetails; schoolUser: SchoolUser }> {
  const schoolUser = await getSchoolUser(actorUserId, schoolId)
  if (!schoolUser || !schoolUser.is_active) throw new MembershipRequiredError()

  const cls = await getClass(classId, schoolId) // throws if classId doesn't belong to schoolId

  if (cls.academic_year_id && cls.academic_year_id !== academicYearId) {
    throw new Error(
      `Attendance ownership chain broken: class ${classId} belongs to academic year ${cls.academic_year_id}, not ${academicYearId}.`
    )
  }

  const years = await listAcademicYears(schoolId)
  if (!years.some(y => y.id === academicYearId)) {
    throw new Error(`Attendance ownership chain broken: academic year ${academicYearId} does not belong to school ${schoolId}.`)
  }

  const terms = await listTerms(schoolId, academicYearId)
  if (!terms.some(t => t.id === termId)) {
    throw new Error(
      `Attendance ownership chain broken: term ${termId} does not belong to school ${schoolId} / academic year ${academicYearId}.`
    )
  }

  const admin = await isSchoolAdmin(actorUserId, schoolId)
  if (!admin && cls.class_teacher_id !== schoolUser.id) {
    throw new ResourceOwnershipError('You are not the assigned teacher of this class.')
  }

  return { cls, schoolUser }
}

// ── Attendance Sessions ──────────────────────────────────────────────────────

export async function createAttendanceSession(
  actorUserId: string,
  input: NewAttendanceSession,
): Promise<AttendanceSessionRow> {
  if (!input.school_id || !input.academic_year_id || !input.term_id || !input.class_id || !input.attendance_date) {
    throw new Error('createAttendanceSession: school, academic year, term, class, and attendance date are all required — a session cannot exist without any one of them.')
  }

  await assertOwnershipChain(actorUserId, input.school_id, input.academic_year_id, input.term_id, input.class_id)

  const sessionType = input.session_type ?? 'daily'

  // Session uniqueness checked before insert — this is the business rule,
  // not a caught database-constraint exception (the live UNIQUE constraint
  // from Sprint 11B remains only as a backstop against a race, never relied
  // on as the primary check).
  const existing = await repos.attendance.findSessionByUniqueKey(input.school_id, input.class_id, input.attendance_date, sessionType)
  if (existing) {
    throw new Error(
      `createAttendanceSession: a session already exists for class ${input.class_id} on ${input.attendance_date} (session_type=${sessionType}).`
    )
  }

  return repos.attendance.createSession({ ...input, session_type: sessionType })
}

export async function getAttendanceSession(
  actorUserId: string,
  schoolId: string,
  sessionId: string,
): Promise<AttendanceSessionRow> {
  const session = await repos.attendance.findSessionById(sessionId, schoolId)
  if (!session) throw new Error(`getAttendanceSession: no session ${sessionId} found for school ${schoolId}.`)

  await assertOwnershipChain(actorUserId, session.school_id, session.academic_year_id, session.term_id, session.class_id)
  return session
}

/**
 * Phase 2 (Sprint 11H) — the canonical operational completion state for a
 * session: `created` (session exists, zero records), `partially_marked`
 * (some, but not every, roster learner has a record), or `fully_marked`
 * (every roster learner has one). Computed fresh on every call from
 * existing data only — `listRecordsForSession` + `getClassRoster` — never
 * stored, never a new table, never a new column. This is exactly what
 * ADR-0003 §4 already requires of Attendance Summary in general (always
 * computed on read), applied to the one specific question Sprint 11G found
 * the UI couldn't answer without inferring from multiple reads.
 *
 * A session that doesn't exist at all is a different, simpler question
 * ("no session" — already answered by whether `getAttendanceSession`
 * throws) and isn't part of this three-value enum.
 */
export type SessionCompletionStatus = 'created' | 'partially_marked' | 'fully_marked'

export type SessionCompletion = {
  status: SessionCompletionStatus
  recordCount: number
  rosterSize: number
}

export async function getSessionCompletionState(
  actorUserId: string,
  schoolId: string,
  sessionId: string,
): Promise<SessionCompletion> {
  const session = await getAttendanceSession(actorUserId, schoolId, sessionId) // ownership-checked

  const [records, roster] = await Promise.all([
    repos.attendance.listRecordsForSession(sessionId),
    getClassRoster(session.class_id, session.term_id),
  ])

  const recordCount = records.length
  const rosterSize = roster.length
  const status: SessionCompletionStatus =
    recordCount === 0 ? 'created' : recordCount < rosterSize ? 'partially_marked' : 'fully_marked'

  return { status, recordCount, rosterSize }
}

// Shared by every class-scoped (not full-ownership-chain) read: admin-tier,
// or the class's own assigned teacher. Extracted in Sprint 12B so a second
// consumer (getAttendanceStatusCountsForClass) doesn't re-inline the same
// six lines `listAttendanceSessionsForClass` already had.
async function assertClassAccess(actorUserId: string, schoolId: string, cls: ClassWithDetails): Promise<void> {
  const admin = await isSchoolAdmin(actorUserId, schoolId)
  if (!admin) {
    const schoolUser = await getSchoolUser(actorUserId, schoolId)
    if (!schoolUser || cls.class_teacher_id !== schoolUser.id) {
      throw new ResourceOwnershipError('You are not the assigned teacher of this class.')
    }
  }
}

export async function listAttendanceSessionsForClass(
  actorUserId: string,
  schoolId: string,
  classId: string,
): Promise<AttendanceSessionRow[]> {
  const cls = await getClass(classId, schoolId) // throws if classId doesn't belong to schoolId
  await assertClassAccess(actorUserId, schoolId, cls)
  return repos.attendance.listSessionsForClass(classId, schoolId)
}

// PRP-3 (Teacher Workflow Engine, Phase 7) — a teacher-scoped batched read,
// added because My Day's "Attendance Today" composition was making one
// HTTP round-trip per class (the documented 2+N fetch pattern, PRP-2A).
// Ownership is still checked per class, exactly as listAttendanceSessionsForClass
// does — this does not weaken or bypass assertClassAccess for any class in
// the list; it only replaces N separate queries with one `.in()` query
// after every class has been individually authorized. Deliberately not
// the existing listAttendanceSessionsForSchool/listAttendanceSessionsByDateRange
// (both admin-only, per Sprint 11G) — this is the teacher-scoped
// equivalent those two were never meant to serve.
export async function listAttendanceSessionsForTeacherClassesOnDate(
  actorUserId: string,
  schoolId: string,
  classIds: string[],
  attendanceDate: string,
): Promise<AttendanceSessionRow[]> {
  const classes = await Promise.all(classIds.map(id => getClass(id, schoolId)))
  await Promise.all(classes.map(cls => assertClassAccess(actorUserId, schoolId, cls)))
  return repos.attendance.listSessionsForClassesOnDate(classIds, schoolId, attendanceDate)
}

/**
 * Sprint 12B — the one additive function Report Cards' Phase 1 audit found
 * missing: a bulk, per-learner breakdown of raw attendance status counts
 * (present/absent/late/excused) for every session in one class, scoped to
 * one term. Computed entirely from existing Attendance data — one call to
 * `listSessionsForClass` (already exists), one bulk call to the new
 * `listRecordsForSessions` (added this sprint to avoid looping
 * `listRecordsForSession` once per session — ADR-0004 §6 rule 6). No
 * summary is stored anywhere; this is recomputed fresh on every call.
 *
 * Deliberately returns raw per-status counts, not a "days present"/"days
 * absent" figure — deciding how `late`/`excused` fold into a two-value
 * report-card field is Report Cards' own interpretation of Attendance's
 * raw facts (ADR-0004 §4: "who computes? the consumer"), not a decision
 * Attendance makes on a consumer's behalf.
 */
export type AttendanceStatusCounts = Record<AttendanceStatus, number>

export async function getAttendanceStatusCountsForClass(
  actorUserId: string,
  schoolId: string,
  classId: string,
  termId: string,
): Promise<Record<string, AttendanceStatusCounts>> {
  const cls = await getClass(classId, schoolId)
  await assertClassAccess(actorUserId, schoolId, cls)

  const sessions = (await repos.attendance.listSessionsForClass(classId, schoolId))
    .filter(s => s.term_id === termId)
  if (sessions.length === 0) return {}

  const records = await repos.attendance.listRecordsForSessions(sessions.map(s => s.id))

  const counts: Record<string, AttendanceStatusCounts> = {}
  for (const record of records) {
    if (!counts[record.learner_id]) counts[record.learner_id] = { present: 0, absent: 0, late: 0, excused: 0 }
    counts[record.learner_id][record.status] += 1
  }
  return counts
}

// School-wide listings span every class in the school — admin-tier only in
// this sprint (matches `canPublishReport`'s existing admin-only precedent
// for a school-wide, not-class-scoped capability). A class teacher's own
// classes remain reachable via `listAttendanceSessionsForClass`.

export async function listAttendanceSessionsForSchool(
  actorUserId: string,
  schoolId: string,
): Promise<AttendanceSessionRow[]> {
  const admin = await isSchoolAdmin(actorUserId, schoolId)
  if (!admin) throw new PermissionDeniedError('Only school admins may list attendance sessions across the whole school.')

  return repos.attendance.listSessionsForSchool(schoolId)
}

export async function listAttendanceSessionsByDateRange(
  actorUserId: string,
  schoolId: string,
  dateFrom: string,
  dateTo: string,
): Promise<AttendanceSessionRow[]> {
  const admin = await isSchoolAdmin(actorUserId, schoolId)
  if (!admin) throw new PermissionDeniedError('Only school admins may list attendance sessions by date range across the whole school.')

  if (dateFrom > dateTo) {
    throw new Error(`listAttendanceSessionsByDateRange: dateFrom (${dateFrom}) must not be after dateTo (${dateTo}).`)
  }

  return repos.attendance.listSessionsByDateRange(schoolId, dateFrom, dateTo)
}

export async function updateAttendanceSession(
  actorUserId: string,
  schoolId: string,
  sessionId: string,
  update: AttendanceSessionMetadataUpdate,
): Promise<AttendanceSessionRow> {
  const session = await repos.attendance.findSessionById(sessionId, schoolId)
  if (!session) throw new Error(`updateAttendanceSession: no session ${sessionId} found for school ${schoolId}.`)

  await assertOwnershipChain(actorUserId, session.school_id, session.academic_year_id, session.term_id, session.class_id)

  // marked_by_teacher_id's referential validity (is it a real school_users
  // row?) is intentionally left to the live FK constraint — no existing
  // Core helper resolves a school_users row by its own id, and adding one
  // here would be new identity logic this sprint is told not to duplicate.
  // Repository errors propagate, per this sprint's Error Handling section.
  return repos.attendance.updateSessionMetadata(sessionId, schoolId, update)
}

export async function deleteAttendanceSession(
  actorUserId: string,
  schoolId: string,
  sessionId: string,
): Promise<void> {
  const session = await repos.attendance.findSessionById(sessionId, schoolId)
  if (!session) throw new Error(`deleteAttendanceSession: no session ${sessionId} found for school ${schoolId}.`)

  await assertOwnershipChain(actorUserId, session.school_id, session.academic_year_id, session.term_id, session.class_id)
  return repos.attendance.deleteSession(sessionId, schoolId)
}

// ── Attendance Records ───────────────────────────────────────────────────────

export async function recordAttendance(
  actorUserId: string,
  schoolId: string,
  input: NewAttendanceRecord,
): Promise<AttendanceRecordRow> {
  assertValidStatus(input.status)

  const session = await repos.attendance.findSessionById(input.attendance_session_id, schoolId)
  if (!session) throw new Error(`recordAttendance: no session ${input.attendance_session_id} found for school ${schoolId}.`)

  const { schoolUser } = await assertOwnershipChain(actorUserId, session.school_id, session.academic_year_id, session.term_id, session.class_id)

  const roster = await getClassRoster(session.class_id, session.term_id)
  if (!roster.some(l => l.id === input.learner_id)) {
    throw new Error(`recordAttendance: learner ${input.learner_id} is not enrolled in class ${session.class_id} for term ${session.term_id}.`)
  }

  // Duplicate learner-in-session rejected before insert — the business
  // rule, not the live UNIQUE(attendance_session_id, learner_id) constraint
  // caught as an exception.
  const existingRecords = await repos.attendance.listRecordsForSession(input.attendance_session_id)
  if (existingRecords.some(r => r.learner_id === input.learner_id)) {
    throw new Error(`recordAttendance: learner ${input.learner_id} already has an attendance record for session ${input.attendance_session_id}.`)
  }

  const created = await repos.attendance.insertAttendanceRecord(input)

  // Phase 3 (Sprint 11H) — completes the teacher workflow: marked_by_teacher_id
  // was never populated before this sprint. Set here, to the acting teacher's
  // own resolved school_users id (never trusted from the caller/request body),
  // reusing the identity already resolved by assertOwnershipChain above rather
  // than duplicating a second lookup. A later marking action (by the same or
  // a different authorized teacher/admin) simply overwrites this — it always
  // reflects who most recently acted, which is exactly what "marked_by" means
  // (provenance, per ADR-0003 §5/§8 — never used for access control anywhere
  // in this file).
  await repos.attendance.updateSessionMetadata(session.id, schoolId, { marked_by_teacher_id: schoolUser.id })

  return created
}

export async function bulkRecordAttendance(
  actorUserId: string,
  schoolId: string,
  sessionId: string,
  records: Array<Omit<NewAttendanceRecord, 'attendance_session_id'>>,
): Promise<AttendanceRecordRow[]> {
  if (records.length === 0) return []

  // Pure input-shape checks first, before any DB round-trip — fail fast on
  // what's cheap to check, and never do a partial write because a later row
  // in the batch turned out to be invalid.

  // Invalid status rejected before persistence — every row validated up
  // front so a bad row never causes a partial write.
  for (const record of records) assertValidStatus(record.status)

  // Duplicate learners within the submitted batch itself rejected before
  // persistence ("every learner belongs to the same session" implies each
  // learner appears at most once per submission).
  const seen = new Set<string>()
  for (const record of records) {
    if (seen.has(record.learner_id)) {
      throw new Error(`bulkRecordAttendance: learner ${record.learner_id} appears more than once in this batch.`)
    }
    seen.add(record.learner_id)
  }

  const session = await repos.attendance.findSessionById(sessionId, schoolId)
  if (!session) throw new Error(`bulkRecordAttendance: no session ${sessionId} found for school ${schoolId}.`)

  const { schoolUser } = await assertOwnershipChain(actorUserId, session.school_id, session.academic_year_id, session.term_id, session.class_id)

  // Every learner must belong to this session's class, for this term.
  const roster = await getClassRoster(session.class_id, session.term_id)
  const rosterIds = new Set(roster.map(l => l.id))
  for (const record of records) {
    if (!rosterIds.has(record.learner_id)) {
      throw new Error(`bulkRecordAttendance: learner ${record.learner_id} is not enrolled in class ${session.class_id} for term ${session.term_id}.`)
    }
  }

  // Duplicate learners already recorded in this session (from an earlier
  // call) rejected before persistence.
  const existing = await repos.attendance.listRecordsForSession(sessionId)
  const existingIds = new Set(existing.map(r => r.learner_id))
  for (const record of records) {
    if (existingIds.has(record.learner_id)) {
      throw new Error(`bulkRecordAttendance: learner ${record.learner_id} already has an attendance record for session ${sessionId}.`)
    }
  }

  const created = await repos.attendance.bulkInsertAttendanceRecords(
    records.map(record => ({ ...record, attendance_session_id: sessionId })),
  )

  // Phase 3 (Sprint 11H) — see recordAttendance's identical comment above;
  // same reasoning applies to the bulk path.
  await repos.attendance.updateSessionMetadata(sessionId, schoolId, { marked_by_teacher_id: schoolUser.id })

  return created
}

export async function updateAttendanceRecord(
  actorUserId: string,
  schoolId: string,
  recordId: string,
  update: AttendanceRecordUpdate,
): Promise<AttendanceRecordRow> {
  if (update.status !== undefined) assertValidStatus(update.status)

  const record = await repos.attendance.findRecordById(recordId)
  if (!record) throw new Error(`updateAttendanceRecord: no attendance record ${recordId} found.`)

  const session = await repos.attendance.findSessionById(record.attendance_session_id, schoolId)
  if (!session) throw new Error(`updateAttendanceRecord: attendance record ${recordId}'s session does not belong to school ${schoolId}.`)

  await assertOwnershipChain(actorUserId, session.school_id, session.academic_year_id, session.term_id, session.class_id)
  return repos.attendance.updateAttendanceRecord(recordId, update)
}

export async function getAttendanceRecord(
  actorUserId: string,
  schoolId: string,
  recordId: string,
): Promise<AttendanceRecordRow> {
  const record = await repos.attendance.findRecordById(recordId)
  if (!record) throw new Error(`getAttendanceRecord: no attendance record ${recordId} found.`)

  const session = await repos.attendance.findSessionById(record.attendance_session_id, schoolId)
  if (!session) throw new Error(`getAttendanceRecord: attendance record ${recordId}'s session does not belong to school ${schoolId}.`)

  await assertOwnershipChain(actorUserId, session.school_id, session.academic_year_id, session.term_id, session.class_id)
  return record
}

export async function listAttendanceForSession(
  actorUserId: string,
  schoolId: string,
  sessionId: string,
): Promise<AttendanceRecordRow[]> {
  const session = await repos.attendance.findSessionById(sessionId, schoolId)
  if (!session) throw new Error(`listAttendanceForSession: no session ${sessionId} found for school ${schoolId}.`)

  await assertOwnershipChain(actorUserId, session.school_id, session.academic_year_id, session.term_id, session.class_id)
  return repos.attendance.listRecordsForSession(sessionId)
}

// A learner's full attendance history can span many classes and teachers
// across terms — no Attendance-specific class-teacher-of-record visibility
// rule exists yet (that remains Sprint 11G's own, separately-approved
// scope: a class-teacher who is NOT this learner's guardian still cannot
// read the learner's full cross-class history through this function).
// Admin-tier stays unconditionally allowed, exactly as before.
//
// Parent Portal Phase P4.5: widened to also allow a learner's own
// authenticated guardian, per the canonical guardian relationship
// `resolveParent()` already defines (`learner_guardians`) — the SAME
// resolver `lib/core/permissions.ts`'s `requireParent` uses, reused here
// rather than re-implemented. This was the confirmed root cause of P4's
// named finding: `composeAttendance()` (the only caller of this function)
// always received a `PermissionDeniedError` for a real parent actor, which
// silently neutered the pre-existing "Learning Time" Home card and
// `review_attendance` ParentAction, not just P4's own new Attendance
// Attention source. `learnerId` here is already Core `learners.id` space
// (composeAttendance passes `coreLearnerId` — see composeAttendance.ts),
// which is exactly the space `resolveParent().coreLearnerIds` is keyed on,
// so no new identity bridge is introduced. A caller who is neither
// admin-tier nor a registered guardian of THIS specific learner is denied
// exactly as before (an unrelated parent, a plain non-admin class teacher,
// or a bogus learnerId all still throw).
export async function getLearnerAttendanceHistory(
  actorUserId: string,
  schoolId: string,
  learnerId: string,
): Promise<AttendanceHistoryRow[]> {
  const admin = await isSchoolAdmin(actorUserId, schoolId)
  if (!admin) {
    const { coreLearnerIds } = await resolveParent(actorUserId)
    const isGuardianOfThisLearner = (coreLearnerIds as readonly string[]).includes(learnerId)
    if (!isGuardianOfThisLearner) {
      throw new PermissionDeniedError('Only school admins or this learner\'s own registered guardian may read a learner\'s full attendance history.')
    }
  }

  const history = await repos.attendance.listLearnerAttendanceHistory(learnerId)
  return history.filter(row => row.attendance_sessions.school_id === schoolId)
}

export async function deleteAttendanceRecord(
  actorUserId: string,
  schoolId: string,
  recordId: string,
): Promise<void> {
  const record = await repos.attendance.findRecordById(recordId)
  if (!record) throw new Error(`deleteAttendanceRecord: no attendance record ${recordId} found.`)

  const session = await repos.attendance.findSessionById(record.attendance_session_id, schoolId)
  if (!session) throw new Error(`deleteAttendanceRecord: attendance record ${recordId}'s session does not belong to school ${schoolId}.`)

  await assertOwnershipChain(actorUserId, session.school_id, session.academic_year_id, session.term_id, session.class_id)
  return repos.attendance.deleteRecord(recordId)
}
