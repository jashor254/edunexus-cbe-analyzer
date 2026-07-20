// components/attendance/attendanceClient.ts
//
// Sprint 11F — the one shared fetch layer for the Teacher Attendance
// workspace. Every call here hits an existing route unmodified: the three
// Attendance API routes (Sprint 11E) plus three pre-existing Core reads
// (/api/core/my-membership, /api/core/classes, /api/core/academic-years,
// /api/core/learners) already used elsewhere in this codebase. Nothing in
// this file computes, validates, or decides anything — it only shapes
// fetch() calls and throws on a non-OK response, mirroring the same
// fetchJson pattern every Core page (core-office, core-term, ...) already
// duplicates locally; centralized here once because this sprint adds four
// pages that would otherwise each redefine it.

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export type AttendanceSession = {
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

export type AttendanceRecord = {
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

export type Membership = {
  schoolId: string
  schoolName: string
  role: string
  currentTerm: { id: string; name: string; term_number: 1 | 2 | 3; start_date: string; end_date: string } | null
}

export type ClassOption = {
  id: string
  class_name: string
  display_name: string | null
  academic_year_id: string | null
  grades: { id: string; name: string; code: string; category: string } | null
  streams: { id: string; name: string } | null
}

export type LearnerOption = {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  admission_number: string
}

// Sprint 11H Phase 2 — the canonical, computed-on-read completion state
// (lib/core/attendance.ts's getSessionCompletionState). Never stored.
export type SessionCompletionStatus = 'created' | 'partially_marked' | 'fully_marked'

export type SessionCompletion = {
  status: SessionCompletionStatus
  recordCount: number
  rosterSize: number
}

export type AttendanceSessionWithCompletion = AttendanceSession & { completion: SessionCompletion }

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? (typeof json.error === 'string' ? json.error : 'Request failed'))
  return json.data as T
}

// ── Existing Core reads (unmodified routes) ─────────────────────────────────

export function fetchMembership(): Promise<{ membership: Membership | null }> {
  return fetchJson('/api/core/my-membership')
}

export function fetchClasses(schoolId: string, academicYearId?: string): Promise<{ classes: ClassOption[] }> {
  const qs = academicYearId ? `&academicYearId=${academicYearId}` : ''
  return fetchJson(`/api/core/classes?schoolId=${schoolId}${qs}`)
}

export function fetchCurrentAcademicYear(schoolId: string): Promise<{ years: Array<{ id: string; name: string; is_current: boolean }> }> {
  return fetchJson(`/api/core/academic-years?schoolId=${schoolId}`)
}

export function fetchClassRoster(schoolId: string, classId: string, termId: string): Promise<LearnerOption[]> {
  return fetchJson(`/api/core/learners?schoolId=${schoolId}&classId=${classId}&termId=${termId}`)
}

// ── Attendance sessions (Sprint 11E) ─────────────────────────────────────────

export function createSession(input: {
  schoolId: string; academicYearId: string; termId: string; classId: string; attendanceDate: string; sessionType?: string
}): Promise<AttendanceSession> {
  return fetchJson('/api/core/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function listSessionsForClass(schoolId: string, classId: string): Promise<AttendanceSession[]> {
  return fetchJson(`/api/core/attendance?schoolId=${schoolId}&classId=${classId}`)
}

// PRP-3 (Teacher Workflow Engine, Phase 7) — replaces what used to be one
// listSessionsForClass call per class (the documented 2+N fetch pattern,
// PRP-2A) with a single batched request.
export function listSessionsForClassesOnDate(schoolId: string, classIds: string[], date: string): Promise<AttendanceSession[]> {
  return fetchJson(`/api/core/attendance?schoolId=${schoolId}&classIds=${classIds.join(',')}&date=${date}`)
}

export function getSession(schoolId: string, sessionId: string): Promise<AttendanceSession> {
  return fetchJson(`/api/core/attendance/${sessionId}?schoolId=${schoolId}`)
}

// Sprint 11H — the opt-in enrichment on the same route (`?includeCompletion=true`).
// A separate function, not a parameter on `getSession`, so every existing
// call site (unchanged) keeps its exact original return type.
export function getSessionWithCompletion(schoolId: string, sessionId: string): Promise<AttendanceSessionWithCompletion> {
  return fetchJson(`/api/core/attendance/${sessionId}?schoolId=${schoolId}&includeCompletion=true`)
}

export function deleteSession(schoolId: string, sessionId: string): Promise<void> {
  return fetchJson(`/api/core/attendance/${sessionId}?schoolId=${schoolId}`, { method: 'DELETE' })
}

// Sprint 11G — the admin-tier-only, whole-school branch of GET
// /api/core/attendance (Sprint 11E/11D: listAttendanceSessionsForSchool).
// Sprint 11F's teacher workspace deliberately never called this; the
// Attendance Administration workspace is exactly the admin-tier surface
// it was built for.
export function listSessionsForSchool(schoolId: string): Promise<AttendanceSession[]> {
  return fetchJson(`/api/core/attendance?schoolId=${schoolId}`)
}

// ── Attendance records (Sprint 11E) ──────────────────────────────────────────

export function listRecordsForSession(schoolId: string, sessionId: string): Promise<AttendanceRecord[]> {
  return fetchJson(`/api/core/attendance/${sessionId}/records?schoolId=${schoolId}`)
}

export function bulkCreateRecords(
  schoolId: string,
  sessionId: string,
  records: Array<{ learnerId: string; status: AttendanceStatus }>,
): Promise<AttendanceRecord[]> {
  return fetchJson(`/api/core/attendance/${sessionId}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schoolId, records }),
  })
}

export function updateRecord(
  schoolId: string,
  sessionId: string,
  recordId: string,
  update: { status?: AttendanceStatus; arrivalTime?: string | null; departureTime?: string | null; notes?: string | null },
): Promise<AttendanceRecord> {
  return fetchJson(`/api/core/attendance/${sessionId}/records`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schoolId, recordId, ...update }),
  })
}

export function deleteRecord(schoolId: string, sessionId: string, recordId: string): Promise<void> {
  return fetchJson(`/api/core/attendance/${sessionId}/records?schoolId=${schoolId}&recordId=${recordId}`, { method: 'DELETE' })
}

export function classLabel(cls: Pick<ClassOption, 'class_name' | 'display_name' | 'grades' | 'streams'>): string {
  return cls.display_name ?? cls.class_name
}

export function learnerLabel(l: LearnerOption): string {
  return `${l.first_name} ${l.last_name}`
}
