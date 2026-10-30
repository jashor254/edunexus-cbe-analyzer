// lib/classes/joinClassByCode.ts
//
// Enrols a learner the caller already owns into a Solo Teacher class by its
// join code (POST /api/student/join-class). Enrolment is immediate and grants
// the class's materials, resources, announcements, calendar and assignments,
// so guessing codes must be bounded: every lookup first reserves an attempt
// against the caller's ACCOUNT in the shared database-backed limiter.
// Attempts that find a real class are refunded, so only failed guesses
// count — a legitimate user who mistypes a few times is unaffected, while
// scripted guessing stops after ATTEMPT_LIMITS.classJoinByCode.limit misses.
//
// The limiter fails closed (AttemptLimiterUnavailableError propagates): no
// limiter, no lookup.

import { createServiceClient } from '@/utils/supabase/service'
import { ATTEMPT_LIMITS } from '@/lib/config/abuseLimits'
import { reserveAttempt, releaseAttempt, rollingWindowStart } from '@/lib/security/attemptLimiter'

export type JoinedClass = {
  id:            string
  name:          string
  subject:       string
  grade:         number
  academic_year: string
  teacher:       string
  school:        string
}

export type JoinClassByCodeResult =
  | { status: 'joined'; class: JoinedClass }
  | { status: 'already_enrolled' }
  | { status: 'not_found' }
  | { status: 'rate_limited' }

export type JoinClassByCodeInput = {
  /** Authenticated caller — the limiter subject. Never from the request body. */
  userId:    string
  /** Must already be verified as owned by userId (requireStudent) by the caller. */
  studentId: string
  classCode: string
}

type Deps = {
  /** Injected only by tests — production always uses the service client. */
  db?: ReturnType<typeof createServiceClient>
}

type ClassRow = {
  id: string; name: string; subject: string; grade: number; academic_year: string
  teachers: { full_name: string; school: string } | null
}

export async function joinClassByCode(input: JoinClassByCodeInput, deps: Deps = {}): Promise<JoinClassByCodeResult> {
  const db = deps.db ?? createServiceClient()
  const { bucket, limit, windowMs } = ATTEMPT_LIMITS.classJoinByCode

  const reservation = await reserveAttempt(
    { bucket, subject: input.userId, limit, since: rollingWindowStart(windowMs) },
    { db },
  )
  if (!reservation) return { status: 'rate_limited' }

  const { data, error: lookupError } = await db
    .from('teacher_classes')
    .select('id, name, subject, grade, academic_year, teachers(full_name, school)')
    .eq('class_code', input.classCode.toUpperCase().trim())
    .maybeSingle()
  if (lookupError) throw new Error(`joinClassByCode: class lookup failed: ${lookupError.message}`)

  // A miss keeps its reservation: that is the guess being counted.
  // PostgREST returns the to-one `teachers` embed as an object; the untyped
  // client infers an array — the same cast the route always used.
  const cls = data as unknown as ClassRow | null
  if (!cls) return { status: 'not_found' }

  // The code was real — refund before anything else, so the caller is never
  // penalised for a correct code whatever happens next.
  await releaseAttempt(reservation, { db })

  const { data: existing, error: existingError } = await db
    .from('class_students')
    .select('id')
    .eq('class_id', cls.id)
    .eq('student_id', input.studentId)
    .maybeSingle()
  if (existingError) throw new Error(`joinClassByCode: enrolment lookup failed: ${existingError.message}`)
  if (existing) return { status: 'already_enrolled' }

  const { error: insertError } = await db
    .from('class_students')
    .insert({ class_id: cls.id, student_id: input.studentId, parent_id: input.userId })
  if (insertError) throw new Error(`joinClassByCode: enrolment failed: ${insertError.message}`)

  return {
    status: 'joined',
    class: {
      id:            cls.id,
      name:          cls.name,
      subject:       cls.subject,
      grade:         cls.grade,
      academic_year: cls.academic_year,
      teacher:       cls.teachers?.full_name || 'Unknown',
      school:        cls.teachers?.school || '',
    },
  }
}
