// lib/repositories/compass.repository.ts
// Handles all DB operations for compass_sessions and the get_grade_topics RPC.
// Note: in-process topic caching lives in lib/compass/topics.ts — this repository
// only wraps the RPC call itself.

import { BaseRepository } from './base'

// ── Column constants ──────────────────────────────────────────────────────────

const SESSION_RESUME_COLS     = 'id, created_at' as const
const SESSION_STALE_COLS      = 'id, created_at, updated_at' as const
const SESSION_STATE_COLS      = 'session_state' as const
const SESSION_EXCHANGE_COLS   = 'exchange_count' as const
const CONTEXT_SUBJECT_COLS    = 'subject_tiers, compass_bridge, recommended_pathway, grade, session_goal' as const
const LAST_SESSION_COLS       = 'subject' as const
const STUDENT_CONTEXT_COLS    = 'subject_rest_until' as const

// ── Types ─────────────────────────────────────────────────────────────────────

export type SessionMode   = 'school' | 'holiday'
export type SessionStatus = 'active' | 'completed' | 'abandoned'

export type SessionRow = {
  id:         string
  created_at: string
}

export type SessionStaleRow = {
  id:         string
  created_at: string
  updated_at: string
}

export type CompassSessionStateRow = {
  session_state: Record<string, unknown> | null
}

export type SessionCreatePayload = {
  learner_id:     string
  subject:        string
  mode:           SessionMode
  status:         'active'
  exchange_count: number
  session_state:  Record<string, never>
}

export type StudentLearningContextRow = {
  subject_tiers:        Record<string, string>
  compass_bridge:       Record<string, unknown>
  recommended_pathway:  string | null
  grade:                number | null
  session_goal:         string | null
}

export type GradeTopicRPCParams = {
  p_min_grade: number
  p_grade:     number
  p_subject:   string
}

export class CompassRepository extends BaseRepository {
  // ── Session — find resumable ────────────────────────────────────────────────

  async findResumableSession(
    studentId:    string,
    subject:      string,
    resumeCutoff: string,
    todayStart:   string,
  ): Promise<SessionRow | null> {
    const { data, error } = await this.db
      .from('compass_sessions')
      .select(SESSION_RESUME_COLS)
      .eq('learner_id', studentId)
      .eq('subject', subject)
      .eq('status', 'active')
      .gte('updated_at', resumeCutoff)
      .gte('created_at', todayStart)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(`Failed to find resumable session: ${error.message}`)

    return data ? { id: data.id as string, created_at: data.created_at as string } : null
  }

  // ── Session — find stale active sessions ───────────────────────────────────

  async findStaleActiveSessions(
    studentId: string,
    subject:   string,
  ): Promise<SessionStaleRow[]> {
    const { data, error } = await this.db
      .from('compass_sessions')
      .select(SESSION_STALE_COLS)
      .eq('learner_id', studentId)
      .eq('subject', subject)
      .eq('status', 'active')

    if (error) throw new Error(`Failed to find stale sessions: ${error.message}`)

    return (data ?? []).map(row => ({
      id:         row.id as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    }))
  }

  // ── Session — abandon stale session ────────────────────────────────────────

  async abandonSession(
    sessionId:       string,
    durationSeconds: number,
  ): Promise<void> {
    const { error } = await this.db
      .from('compass_sessions')
      .update({
        status:           'abandoned',
        completed_at:     new Date().toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq('id', sessionId)

    if (error) throw new Error(`Failed to abandon session: ${error.message}`)
  }

  // ── Session — create ────────────────────────────────────────────────────────

  async createSession(payload: SessionCreatePayload): Promise<SessionRow> {
    const { data, error } = await this.db
      .from('compass_sessions')
      .insert(payload)
      .select(SESSION_RESUME_COLS)
      .single()

    if (error || !data) {
      throw new Error(`Failed to create session: ${error?.message ?? 'unknown'}`)
    }

    return { id: data.id as string, created_at: data.created_at as string }
  }

  // ── Ownership ────────────────────────────────────────────────────────────────
  // Single source of truth for the columns every Compass ownership check needs.
  // Consolidates what was previously six separate inline `.from('students')`
  // queries scattered across app/api/learn/* and app/api/teacher/*.

  async findStudentOwnership(
    studentId: string,
  ): Promise<{ id: string; teacher_id: string | null; user_id: string | null; parent_user_id: string | null } | null> {
    const { data, error } = await this.db
      .from('students')
      .select('id, teacher_id, user_id, parent_user_id')
      .eq('id', studentId)
      .maybeSingle()

    if (error) throw new Error(`Failed to read student ownership: ${error.message}`)
    return data
  }

  // List of students self-owned or parent-owned by this user — used to render
  // a picker when a user has more than one linked student. Not a single-student
  // ownership decision (that's lib/compass/ownership.ts); a listing query, kept
  // here alongside the other student-ownership reads it's built from.
  async findOwnedStudents(userId: string): Promise<Array<{ id: string; name: string | null; grade: number | null }>> {
    const { data, error } = await this.db
      .from('students')
      .select('id, name, grade')
      .or(`user_id.eq.${userId},parent_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to list owned students: ${error.message}`)
    return data ?? []
  }

  async findSessionLearnerId(sessionId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('compass_sessions')
      .select('learner_id')
      .eq('id', sessionId)
      .maybeSingle()

    if (error) throw new Error(`Failed to read session owner: ${error.message}`)
    return (data?.learner_id as string | null) ?? null
  }

  // ── Session — read state ────────────────────────────────────────────────────

  async findSessionState(
    sessionId: string,
    userId:    string,
  ): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.db
      .from('compass_sessions')
      .select(SESSION_STATE_COLS)
      .eq('id', sessionId)
      .eq('learner_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (error) throw new Error(`Failed to read session state: ${error.message}`)

    return (data?.session_state as Record<string, unknown> | null) ?? null
  }

  // ── Session — write state ───────────────────────────────────────────────────

  async updateSessionState(
    sessionId:  string,
    newState:   Record<string, unknown>,
    lastSubject: string | null,
  ): Promise<void> {
    const { error } = await this.db
      .from('compass_sessions')
      .update({
        session_state: newState,
        last_subject:  lastSubject,
        updated_at:    new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (error) throw new Error(`Failed to update session state: ${error.message}`)
  }

  // ── Session — increment exchange count ─────────────────────────────────────

  async getExchangeCount(sessionId: string): Promise<number> {
    const { data, error } = await this.db
      .from('compass_sessions')
      .select(SESSION_EXCHANGE_COLS)
      .eq('id', sessionId)
      .maybeSingle()

    if (error) throw new Error(`Failed to get exchange count: ${error.message}`)

    return (data?.exchange_count as number | null) ?? 0
  }

  async updateExchangeCount(sessionId: string, count: number): Promise<void> {
    const { error } = await this.db
      .from('compass_sessions')
      .update({ exchange_count: count })
      .eq('id', sessionId)

    if (error) throw new Error(`Failed to update exchange count: ${error.message}`)
  }

  // ── Session — end ───────────────────────────────────────────────────────────

  async endSession(
    sessionId:       string,
    learnerId:       string,
    status:          'completed' | 'abandoned',
    durationSeconds: number,
  ): Promise<void> {
    const { error } = await this.db
      .from('compass_sessions')
      .update({
        status,
        completed_at:     new Date().toISOString(),
        duration_seconds: Math.max(0, Math.round(durationSeconds)),
      })
      .eq('id', sessionId)
      .eq('learner_id', learnerId)
      .eq('status', 'active')

    if (error) throw new Error(`Failed to end session: ${error.message}`)
  }

  // ── Student learning context ────────────────────────────────────────────────

  async getStudentLearningContext(
    studentId: string,
  ): Promise<StudentLearningContextRow | null> {
    const { data, error } = await this.db
      .from('student_learning_context')
      .select(CONTEXT_SUBJECT_COLS)
      .eq('student_id', studentId)
      .maybeSingle()

    if (error) throw new Error(`Failed to get student learning context: ${error.message}`)
    if (!data) return null

    return {
      subject_tiers:       (data.subject_tiers       ?? {}) as Record<string, string>,
      compass_bridge:      (data.compass_bridge       ?? {}) as Record<string, unknown>,
      recommended_pathway: (data.recommended_pathway  as string | null) ?? null,
      grade:               (data.grade                as number | null)  ?? null,
      session_goal:        (data.session_goal          as string | null) ?? null,
    }
  }

  /**
   * Merges `patch` into the student's existing `compass_bridge` JSON and
   * upserts `student_learning_context` — the exact merge-not-replace
   * semantics `PATCH /api/teacher/students/[studentId]/compass-topic`
   * already relied on before this was extracted (Blueprint Living Action
   * Plan Phase 2C). Never creates a `compass_sessions` row and never invokes
   * a model — this only steers what `getNextSubject()` returns the next
   * time this student starts a session.
   */
  async mergeTeacherSuggestedTopic(studentId: string, patch: Record<string, unknown>): Promise<void> {
    const { data: existing } = await this.db
      .from('student_learning_context')
      .select('compass_bridge')
      .eq('student_id', studentId)
      .maybeSingle()

    const currentBridge = (existing?.compass_bridge as Record<string, unknown>) ?? {}

    const { error } = await this.db
      .from('student_learning_context')
      .upsert(
        {
          student_id: studentId,
          compass_bridge: { ...currentBridge, ...patch },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id' }
      )
    if (error) throw new Error(`mergeTeacherSuggestedTopic: ${error.message}`)
  }

  async getSubjectRestUntil(studentId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('student_learning_context')
      .select(STUDENT_CONTEXT_COLS)
      .eq('student_id', studentId)
      .maybeSingle()

    if (error) throw new Error(`Failed to get subject rest: ${error.message}`)

    return (data?.subject_rest_until as string | null) ?? null
  }

  // ── Last active session for next-subject selection ─────────────────────────

  async getLastActiveSessionSubject(studentId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('compass_sessions')
      .select(LAST_SESSION_COLS)
      .eq('learner_id', studentId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(`Failed to get last session subject: ${error.message}`)

    return (data?.subject as string | null) ?? null
  }

  // ── RPC: get_grade_topics ───────────────────────────────────────────────────
  // Note: caching is handled in lib/compass/topics.ts, not here.

  async getGradeTopics(params: GradeTopicRPCParams): Promise<string[]> {
    const { data, error } = await this.db.rpc('get_grade_topics', {
      p_min_grade: params.p_min_grade,
      p_grade:     params.p_grade,
      p_subject:   params.p_subject,
    })

    if (error) throw new Error(`Failed to get grade topics: ${error.message}`)

    return (data ?? [])
      .map((r: { title: string }) => r.title)
      .filter(Boolean) as string[]
  }

  async findCompletedSessionsByLearner(learnerId: string): Promise<Array<{
    subject:           string | null
    duration_seconds:  number | null
    completed_at:      string | null
    one_line_summary:  string | null
  }>> {
    const { data, error } = await this.db
      .from('compass_sessions')
      .select('subject, duration_seconds, completed_at, one_line_summary')
      .eq('learner_id', learnerId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: true })

    if (error) throw new Error(`Failed to fetch completed sessions: ${error.message}`)

    return (data ?? []).map(row => ({
      subject:          row.subject          as string | null,
      duration_seconds: row.duration_seconds as number | null,
      completed_at:     row.completed_at     as string | null,
      one_line_summary: row.one_line_summary as string | null,
    }))
  }

  async findRecentSessionsByStudent(
    studentId: string,
    limit = 3,
  ): Promise<Array<{ subject: string | null; status: string | null }>> {
    const { data, error } = await this.db
      .from('compass_sessions')
      .select('subject, status')
      .eq('learner_id', studentId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(`Failed to fetch recent sessions: ${error.message}`)

    return (data ?? []).map(row => ({
      subject: row.subject as string | null,
      status:  row.status  as string | null,
    }))
  }

  /**
   * Read-only session-count summary for one learner+subject — Phase 2D's
   * Teacher Review needs "did the learner engage with this Compass
   * delivery," never Compass's own session/tutoring logic. Counts every
   * session regardless of status (active/completed/abandoned); never
   * writes anything.
   */
  async summarizeSessionsForSubject(studentId: string, subject: string): Promise<{
    sessionCount: number
    activeCount: number
    completedCount: number
    abandonedCount: number
    lastActivityAt: string | null
  }> {
    const { data, error } = await this.db
      .from('compass_sessions')
      .select('status, updated_at')
      .eq('learner_id', studentId)
      .eq('subject', subject)
    if (error) throw new Error(`summarizeSessionsForSubject: ${error.message}`)
    const rows = (data ?? []) as Array<{ status: string; updated_at: string | null }>
    const lastActivityAt = rows.reduce<string | null>((latest, r) => {
      if (!r.updated_at) return latest
      if (!latest || r.updated_at > latest) return r.updated_at
      return latest
    }, null)
    return {
      sessionCount: rows.length,
      activeCount: rows.filter(r => r.status === 'active').length,
      completedCount: rows.filter(r => r.status === 'completed').length,
      abandonedCount: rows.filter(r => r.status === 'abandoned').length,
      lastActivityAt,
    }
  }
}
