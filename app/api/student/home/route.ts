// app/api/student/home/route.ts
// Single endpoint powering the student home dashboard.
// Returns profile, subject levels, Compass stats, recent sessions, and assignments.

import { createClient }        from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'

// Sprint 1B Batch G note: only the top-level auth check below is migrated.
// The student-fetch query needs grade/school/current_pathway/curriculum_type
// — fields `resolveStudent` doesn't return — so forcing the canonical
// identity function in here would require a second, redundant query for no
// behavior change. Left as the original single dual-purpose query, same
// treatment as Batch F's career-intelligence route.

function formatSubject(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function computeStreak(sessions: { created_at: string }[]): number {
  if (!sessions.length) return 0
  const days = new Set<string>()
  for (const s of sessions) {
    days.add(new Date(s.created_at).toISOString().slice(0, 10))
  }
  const sorted = [...days].sort().reverse()
  const today   = new Date().toISOString().slice(0, 10)
  let streak    = 0
  let expected  = today
  for (const d of sorted) {
    if (d === expected) {
      streak++
      const prev = new Date(expected)
      prev.setDate(prev.getDate() - 1)
      expected = prev.toISOString().slice(0, 10)
    } else if (d < expected) {
      break
    }
  }
  return streak
}

function computeFRS(scores: Record<string, number>): number {
  const vals = Object.values(scores).filter(v => typeof v === 'number' && v >= 1 && v <= 4)
  if (!vals.length) return 0
  const avg  = vals.reduce((a, b) => a + b, 0) / vals.length
  const base = Math.round((avg / 4) * 100)
  const l4   = vals.filter(v => v === 4).length
  const l1   = vals.filter(v => v === 1).length
  return Math.min(98, Math.max(5, base + l4 * 2 - l1 * 3))
}

export type StudentHomeData = {
  student: {
    id:          string
    name:        string
    firstName:   string
    grade:       number
    school:      string | null
    pathway:     string | null
    curriculum:  string
  }
  stats: {
    totalXp:          number
    totalSessions:    number
    sessionsThisWeek: number
    streak:           number
    futureReadiness:  number
    frsLabel:         'Leading' | 'Strong' | 'Growing' | 'Emerging' | 'Building'
  }
  subjects: Array<{
    key:         string
    displayName: string
    level:       1 | 2 | 3 | 4
    levelLabel:  string
  }>
  recentSessions: Array<{
    id:           string
    subject:      string
    subjectLabel: string
    xpEarned:     number
    levelGained:  boolean
    fromLevel:    number | null
    toLevel:      number | null
    summary:      string | null
    createdAt:    string
    relativeDate: string
  }>
  pendingAssignments: Array<{
    id:      string
    title:   string
    subject: string
    dueDate: string
    daysLeft: number
    isOverdue: boolean
  }>
  hasAssessment: boolean
  hasTeacher:    boolean
}

function frsLabel(score: number): StudentHomeData['stats']['frsLabel'] {
  if (score >= 82) return 'Leading'
  if (score >= 68) return 'Strong'
  if (score >= 52) return 'Growing'
  if (score >= 38) return 'Emerging'
  return 'Building'
}

function relativeDate(iso: string): string {
  const d   = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diff === 0)  return 'Today'
  if (diff === 1)  return 'Yesterday'
  if (diff < 7)   return `${diff} days ago`
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Beginning',
  2: 'Approaching',
  3: 'Meeting',
  4: 'Exceeding',
}

export async function GET(): Promise<Response> {
  try {
    const auth = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(auth)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiError('Unauthenticated', 401)
      throw err
    }

    const db = createServiceClient()

    // Student record — must be directly linked to this user account
    const { data: student } = await db
      .from('students')
      .select('id, name, grade, school, current_pathway, curriculum_type')
      .eq('user_id', userId)
      .maybeSingle()

    if (!student) return apiError('No student profile found', 404)

    const studentId  = student.id as string
    const thirtyDays = new Date()
    thirtyDays.setDate(thirtyDays.getDate() - 30)

    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    const dow = weekStart.getDay()
    weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1))

    // Parallel: latest assessment + compass sessions + class memberships
    const [
      { data: assessments },
      { data: sessions },
      { data: classLinks },
    ] = await Promise.all([
      db.from('assessments')
        .select('subject_scores, term, year')
        .eq('student_id', studentId)
        .order('year', { ascending: false })
        .order('term', { ascending: false })
        .limit(1),

      db.from('compass_sessions')
        .select('id, subject, xp_earned, starting_level, ending_level, one_line_summary, created_at')
        .eq('learner_id', studentId)
        .gt('exchange_count', 0)
        .gte('created_at', thirtyDays.toISOString())
        .order('created_at', { ascending: false })
        .limit(20),

      db.from('class_students')
        .select('class_id')
        .eq('student_id', studentId),
    ])

    // Latest assessment → subject levels
    const latestScores: Record<string, number> =
      (assessments?.[0]?.subject_scores as Record<string, number>) ?? {}

    const subjects = Object.entries(latestScores)
      .filter(([, v]) => typeof v === 'number' && v >= 1 && v <= 4)
      .sort(([, a], [, b]) => b - a)
      .map(([key, level]) => ({
        key,
        displayName: formatSubject(key),
        level:       Math.max(1, Math.min(4, Math.round(level))) as 1 | 2 | 3 | 4,
        levelLabel:  LEVEL_LABELS[Math.round(level)] ?? 'Emerging',
      }))

    // Compass stats
    const sessionsArr = sessions ?? []
    const totalXp     = sessionsArr.reduce((s, x) => s + ((x.xp_earned as number) ?? 0), 0)
    const weekSessions = sessionsArr.filter(s => new Date(s.created_at as string) >= weekStart).length
    const streak       = computeStreak(sessionsArr.map(s => ({ created_at: s.created_at as string })))
    const frs          = subjects.length ? computeFRS(latestScores) : 0

    const recentSessions = sessionsArr.slice(0, 4).map(s => ({
      id:           s.id as string,
      subject:      s.subject as string,
      subjectLabel: formatSubject(s.subject as string),
      xpEarned:     (s.xp_earned as number) ?? 0,
      levelGained:  Boolean(s.starting_level && s.ending_level && (s.ending_level as number) > (s.starting_level as number)),
      fromLevel:    s.starting_level as number | null,
      toLevel:      s.ending_level   as number | null,
      summary:      s.one_line_summary as string | null,
      createdAt:    s.created_at as string,
      relativeDate: relativeDate(s.created_at as string),
    }))

    // Assignments
    const classIds = (classLinks ?? []).map(c => c.class_id as string)
    let pendingAssignments: StudentHomeData['pendingAssignments'] = []

    if (classIds.length > 0) {
      const now = new Date()
      const { data: asgn } = await db
        .from('assignments')
        .select('id, title, topic, due_date, teacher_classes(subject)')
        .in('class_id', classIds)
        .eq('status', 'active')
        .order('due_date', { ascending: true })
        .limit(5)

      if (asgn) {
        pendingAssignments = asgn.map(a => {
          const due      = new Date(a.due_date as string)
          const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86_400_000)
          const tc       = a.teacher_classes as { subject?: string } | null
          return {
            id:        a.id as string,
            title:     a.title as string,
            subject:   formatSubject(tc?.subject ?? (a.topic as string) ?? 'Assignment'),
            dueDate:   a.due_date as string,
            daysLeft,
            isOverdue: daysLeft < 0,
          }
        })
      }
    }

    const result: StudentHomeData = {
      student: {
        id:         studentId,
        name:       student.name as string,
        firstName:  (student.name as string).split(' ')[0],
        grade:      student.grade as number,
        school:     student.school as string | null,
        pathway:    student.current_pathway as string | null,
        curriculum: student.curriculum_type as string,
      },
      stats: {
        totalXp,
        totalSessions:    sessionsArr.length,
        sessionsThisWeek: weekSessions,
        streak,
        futureReadiness:  frs,
        frsLabel:         frsLabel(frs),
      },
      subjects,
      recentSessions,
      pendingAssignments,
      hasAssessment: subjects.length > 0,
      hasTeacher:    classIds.length > 0,
    }

    return apiSuccess(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return apiError(msg, 500)
  }
}
