import { BaseRepository } from './base'

// Data access for the Attendance domain (Sprint 11C, per ADR-0003 —
// docs/architecture/adr-0003-attendance-domain.md — and the schema laid down
// in Sprint 11B — docs/architecture/sprint-11b-attendance-schema.md).
// Deliberately its own repository, not bolted onto SchoolRepository or
// LearnerRepository's existing surfaces, matching this codebase's precedent
// of one dedicated repository per canonical domain (PromotionRepository,
// EvidenceRepository, etc.).
//
// Persistence and lookup only — no validation, no permission checks, no
// ownership decisions, no attendance rules, no summaries/percentages. Row
// types are defined locally here (not in types/core.ts), mirroring
// PromotionRepository's precedent for a repository that is this sprint's
// only deliverable.

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export type AttendanceSessionRow = {
  id: string
  school_id: string
  academic_year_id: string
  term_id: string
  class_id: string
  attendance_date: string
  session_type: string
  marked_by_teacher_id: string | null
  created_at: string
  updated_at: string
}

export type NewAttendanceSession = {
  school_id: string
  academic_year_id: string
  term_id: string
  class_id: string
  attendance_date: string
  session_type?: string
  marked_by_teacher_id?: string | null
}

// The only field a session's metadata update may touch — attendance_date,
// class_id, term_id, academic_year_id, and school_id are identity, not
// metadata, and are never mutated after creation.
export type AttendanceSessionMetadataUpdate = {
  marked_by_teacher_id: string | null
}

export type AttendanceRecordRow = {
  id: string
  attendance_session_id: string
  learner_id: string
  status: AttendanceStatus
  arrival_time: string | null
  departure_time: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type NewAttendanceRecord = {
  attendance_session_id: string
  learner_id: string
  status: AttendanceStatus
  arrival_time?: string | null
  departure_time?: string | null
  notes?: string | null
}

export type AttendanceRecordUpdate = Partial<
  Pick<AttendanceRecordRow, 'status' | 'arrival_time' | 'departure_time' | 'notes'>
>

// A learner-history row: the record plus the session context (date/class/
// term) needed for the history to mean anything — attendance_records has
// no date of its own (Sprint 11B's design: date lives on the session).
export type AttendanceHistoryRow = AttendanceRecordRow & {
  attendance_sessions: Pick<AttendanceSessionRow, 'attendance_date' | 'class_id' | 'term_id' | 'school_id'>
}

const SESSION_COLS =
  'id, school_id, academic_year_id, term_id, class_id, attendance_date, session_type, marked_by_teacher_id, created_at, updated_at'

const RECORD_COLS =
  'id, attendance_session_id, learner_id, status, arrival_time, departure_time, notes, created_at, updated_at'

export class AttendanceRepository extends BaseRepository {
  // ── Attendance Sessions ──────────────────────────────────────────────────

  async createSession(input: NewAttendanceSession): Promise<AttendanceSessionRow> {
    const { data, error } = await this.db
      .from('attendance_sessions')
      .insert({
        school_id:             input.school_id,
        academic_year_id:      input.academic_year_id,
        term_id:               input.term_id,
        class_id:              input.class_id,
        attendance_date:       input.attendance_date,
        session_type:          input.session_type ?? 'daily',
        marked_by_teacher_id:  input.marked_by_teacher_id ?? null,
      })
      .select(SESSION_COLS)
      .single()
    if (error) throw new Error(`createSession: ${error.message}`)
    return data
  }

  async findSessionById(id: string, schoolId: string): Promise<AttendanceSessionRow | null> {
    const { data, error } = await this.db
      .from('attendance_sessions')
      .select(SESSION_COLS)
      .eq('id', id)
      .eq('school_id', schoolId)
      .maybeSingle()
    if (error) throw new Error(`findSessionById: ${error.message}`)
    return data
  }

  // Matches the live UNIQUE(class_id, attendance_date, session_type)
  // constraint (supabase/migrations/20260717_attendance_domain_schema.sql) —
  // the session's natural business key.
  async findSessionByUniqueKey(
    schoolId: string,
    classId: string,
    attendanceDate: string,
    sessionType: string = 'daily',
  ): Promise<AttendanceSessionRow | null> {
    const { data, error } = await this.db
      .from('attendance_sessions')
      .select(SESSION_COLS)
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .eq('attendance_date', attendanceDate)
      .eq('session_type', sessionType)
      .maybeSingle()
    if (error) throw new Error(`findSessionByUniqueKey: ${error.message}`)
    return data
  }

  async listSessionsForClass(classId: string, schoolId: string): Promise<AttendanceSessionRow[]> {
    const { data, error } = await this.db
      .from('attendance_sessions')
      .select(SESSION_COLS)
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .order('attendance_date', { ascending: true })
    if (error) throw new Error(`listSessionsForClass: ${error.message}`)
    return data ?? []
  }

  async listSessionsForSchool(schoolId: string): Promise<AttendanceSessionRow[]> {
    const { data, error } = await this.db
      .from('attendance_sessions')
      .select(SESSION_COLS)
      .eq('school_id', schoolId)
      .order('attendance_date', { ascending: true })
    if (error) throw new Error(`listSessionsForSchool: ${error.message}`)
    return data ?? []
  }

  async listSessionsByDateRange(
    schoolId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<AttendanceSessionRow[]> {
    const { data, error } = await this.db
      .from('attendance_sessions')
      .select(SESSION_COLS)
      .eq('school_id', schoolId)
      .gte('attendance_date', dateFrom)
      .lte('attendance_date', dateTo)
      .order('attendance_date', { ascending: true })
    if (error) throw new Error(`listSessionsByDateRange: ${error.message}`)
    return data ?? []
  }

  async updateSessionMetadata(
    id: string,
    schoolId: string,
    update: AttendanceSessionMetadataUpdate,
  ): Promise<AttendanceSessionRow> {
    const { data, error } = await this.db
      .from('attendance_sessions')
      .update(update)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(SESSION_COLS)
      .single()
    if (error) throw new Error(`updateSessionMetadata: ${error.message}`)
    return data
  }

  async deleteSession(id: string, schoolId: string): Promise<void> {
    const { error } = await this.db
      .from('attendance_sessions')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId)
    if (error) throw new Error(`deleteSession: ${error.message}`)
  }

  // ── Attendance Records ───────────────────────────────────────────────────

  async insertAttendanceRecord(input: NewAttendanceRecord): Promise<AttendanceRecordRow> {
    const { data, error } = await this.db
      .from('attendance_records')
      .insert({
        attendance_session_id: input.attendance_session_id,
        learner_id:             input.learner_id,
        status:                 input.status,
        arrival_time:           input.arrival_time ?? null,
        departure_time:         input.departure_time ?? null,
        notes:                  input.notes ?? null,
      })
      .select(RECORD_COLS)
      .single()
    if (error) throw new Error(`insertAttendanceRecord: ${error.message}`)
    return data
  }

  async bulkInsertAttendanceRecords(rows: NewAttendanceRecord[]): Promise<AttendanceRecordRow[]> {
    if (rows.length === 0) return []
    const { data, error } = await this.db
      .from('attendance_records')
      .insert(
        rows.map(row => ({
          attendance_session_id: row.attendance_session_id,
          learner_id:             row.learner_id,
          status:                 row.status,
          arrival_time:           row.arrival_time ?? null,
          departure_time:         row.departure_time ?? null,
          notes:                  row.notes ?? null,
        })),
      )
      .select(RECORD_COLS)
    if (error) throw new Error(`bulkInsertAttendanceRecords: ${error.message}`)
    return data ?? []
  }

  async updateAttendanceRecord(id: string, update: AttendanceRecordUpdate): Promise<AttendanceRecordRow> {
    const { data, error } = await this.db
      .from('attendance_records')
      .update(update)
      .eq('id', id)
      .select(RECORD_COLS)
      .single()
    if (error) throw new Error(`updateAttendanceRecord: ${error.message}`)
    return data
  }

  async findRecordById(id: string): Promise<AttendanceRecordRow | null> {
    const { data, error } = await this.db
      .from('attendance_records')
      .select(RECORD_COLS)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(`findRecordById: ${error.message}`)
    return data
  }

  async listRecordsForSession(sessionId: string): Promise<AttendanceRecordRow[]> {
    const { data, error } = await this.db
      .from('attendance_records')
      .select(RECORD_COLS)
      .eq('attendance_session_id', sessionId)
    if (error) throw new Error(`listRecordsForSession: ${error.message}`)
    return data ?? []
  }

  // Sprint 12B — the one bulk read ADR-0004 §6 rule 6 anticipated: a
  // consumer needing attendance across many sessions at once (Report
  // Cards, generating for a whole class/term) must not loop
  // listRecordsForSession per session. One query, `IN (...)`, not N.
  async listRecordsForSessions(sessionIds: string[]): Promise<AttendanceRecordRow[]> {
    if (sessionIds.length === 0) return []
    const { data, error } = await this.db
      .from('attendance_records')
      .select(RECORD_COLS)
      .in('attendance_session_id', sessionIds)
    if (error) throw new Error(`listRecordsForSessions: ${error.message}`)
    return data ?? []
  }

  async listLearnerAttendanceHistory(learnerId: string): Promise<AttendanceHistoryRow[]> {
    const { data, error } = await this.db
      .from('attendance_records')
      .select(`${RECORD_COLS}, attendance_sessions!inner(attendance_date, class_id, term_id, school_id)`)
      .eq('learner_id', learnerId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(`listLearnerAttendanceHistory: ${error.message}`)
    return (data ?? []) as unknown as AttendanceHistoryRow[]
  }

  async deleteRecord(id: string): Promise<void> {
    const { error } = await this.db
      .from('attendance_records')
      .delete()
      .eq('id', id)
    if (error) throw new Error(`deleteRecord: ${error.message}`)
  }
}
