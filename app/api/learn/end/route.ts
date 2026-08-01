// app/api/learn/end/route.ts
import { z } from 'zod'
import { createServiceClient } from '@/utils/supabase/service'
import { checkFeatureAccess } from '@/lib/payments/access'
import { type FeatureKey } from '@/lib/payments/config'
import { endSession, tierToLevel } from '@/lib/compass/session'
import { resolveCompassStudentAccess, resolveSessionOwnership } from '@/lib/compass/ownership'
import { recordCompassSessionEvidence } from '@/lib/compass/evidence'
import { updateFromCompass } from '@/lib/learnerModel/updater'
import { getStudentBasicInfo } from '@/lib/learnerModel'
import { apiSuccess, apiError, apiForbidden, getErrorMessage } from '@/lib/api/response'

const FEATURE: FeatureKey = 'learning_compass'

// Note: the client still sends `genuineProgress` for backward compatibility,
// but it is intentionally never read here — see the comment on calcXp below.
const EndSessionSchema = z.object({
  sessionId:       z.string().uuid(),
  studentId:       z.string().uuid(),
  status:          z.enum(['completed', 'abandoned']),
  durationSeconds: z.number().min(0),
})

// No confirmed Evidence exists yet at the point XP is awarded — this session's
// own Evidence is recorded afterward (recordCompassSessionEvidence, below) and
// mastery claims are never auto-confirmed (lib/compass/evidence.ts), so there is
// nothing confirmed to derive XP from synchronously. Formula unchanged; gated on
// the actual completion event so XP reflects finishing a session, not just
// exchanging messages and abandoning it. `genuineProgress` here must be the
// server-derived value (session_state.masteredConcepts, written by the AI
// streaming route) — never the client-supplied request-body flag, which a
// client can set unconditionally and would otherwise buy an unearned +60 XP /
// level-up shown to the student before any human or evidence review.
function calcXp(exchanges: number, completed: boolean, genuineProgress: boolean): number {
  if (!completed) return 0
  const base     = Math.min(exchanges, 15) * 10
  const complete = 40
  const progress = genuineProgress ? 60 : 0
  return base + complete + progress
}

// Returns the Monday of the week containing `date` (YYYY-MM-DD string)
function getMondayOf(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()                        // 0=Sun … 6=Sat
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().slice(0, 10)
}

export type EndSessionResult = {
  ended:            boolean
  xpEarned:         number
  totalSessions:    number
  sessionsThisWeek: number
  startingLevel:    number | null
  endingLevel:      number | null
  levelGained:      boolean
}

export async function POST(req: Request): Promise<Response> {
  try {
    const parsed = EndSessionSchema.safeParse(await req.json())
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

    const {
      sessionId,
      studentId,
      status,
      durationSeconds,
    } = parsed.data

    const access = await checkFeatureAccess(FEATURE)
    if (access.allowed === false)
      return apiError(access.reason, access.reason === 'unauthenticated' ? 401 : 403)

    const db = createServiceClient()

    const ownership = await resolveCompassStudentAccess(access.userId, studentId)
    if (!ownership.allowed) return apiForbidden()

    const sessionOwned = await resolveSessionOwnership(sessionId, studentId)
    if (!sessionOwned) return apiForbidden()

    const [sessionRes, contextRes] = await Promise.all([
      db.from('compass_sessions')
        .select('exchange_count, starting_level, subject, session_state')
        .eq('id', sessionId)
        .maybeSingle(),
      db.from('student_learning_context')
        .select('overall_level, subject_tiers, total_sessions, sessions_this_week, week_start_date')
        .eq('student_id', studentId)
        .maybeSingle(),
    ])

    const session       = sessionRes.data
    const sessionRow    = session
    const ctx           = contextRes.data
    const exchanges     = (session?.exchange_count  as number | null) ?? 0
    const startingLevel = (session?.starting_level  as number | null) ?? null

    const sessionState     = (session?.session_state as Record<string, unknown> | null) ?? null
    const masteredConcepts = (sessionState?.masteredConcepts as string[] | null) ?? []
    // Server-derived, never the client-supplied request-body flag — see calcXp comment.
    const genuineProgress  = masteredConcepts.length > 0

    const prevTotal     = (ctx?.total_sessions     as number | null) ?? 0
    const prevWeekly    = (ctx?.sessions_this_week as number | null) ?? 0
    const prevWeekStart = (ctx?.week_start_date    as string | null) ?? null

    const xpEarned       = calcXp(exchanges, status === 'completed', genuineProgress)

    const thisWeekMonday = getMondayOf(new Date())
    const isSameWeek     = prevWeekStart === thisWeekMonday
    const newWeekly      = isSameWeek ? prevWeekly + 1 : 1
    const newTotal       = prevTotal + 1

    // Ending level — same tier→level lookup used at session start (app/api/learn/route.ts),
    // read fresh here since it's what changed (if anything) during the session.
    const subjectTiers = (ctx?.subject_tiers as Record<string, string> | null) ?? {}
    const tierKey       = sessionRow?.subject
      ? Object.keys(subjectTiers).find(k => k.toLowerCase() === (sessionRow.subject as string).toLowerCase())
      : undefined
    const endingLevel = tierKey
      ? tierToLevel(subjectTiers[tierKey])
      : ((ctx?.overall_level as number | null) ?? null)

    const levelGained = startingLevel !== null && endingLevel !== null && endingLevel > startingLevel

    await Promise.all([
      endSession(sessionId, studentId, status, durationSeconds),
      db.from('compass_sessions').update({ xp_earned: xpEarned, ending_level: endingLevel }).eq('id', sessionId),
      db.from('student_learning_context')
        .update({
          total_sessions:     newTotal,
          sessions_this_week: newWeekly,
          week_start_date:    thisWeekMonday,
        })
        .eq('student_id', studentId),
    ])

    // Award group bonus points if student is in a group for this subject
    if (sessionRow?.subject && status === 'completed') {
      const subjectFormatted = (sessionRow.subject as string)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase())

      const { data: memberships } = await db
        .from('study_group_members')
        .select('id, points, group_id, study_groups!inner(subject)')
        .eq('student_id', studentId)
        .filter('study_groups.subject', 'ilike', `%${subjectFormatted.split(' ')[0]}%`)

      if (memberships && memberships.length > 0) {
        const today = new Date().toISOString().slice(0, 10)
        for (const m of memberships) {
          // Check if already earned group bonus from Compass today (to prevent farming)
          const { data: alreadyBonused } = await db
            .from('study_group_answers')
            .select('id')
            .eq('group_id', m.group_id)
            .eq('user_id', access.userId)
            .gte('created_at', `${today}T00:00:00`)
            .limit(1)
            .maybeSingle()

          if (!alreadyBonused) {
            await db
              .from('study_group_members')
              .update({ points: ((m.points as number) ?? 0) + 5 })
              .eq('id', m.id)
          }
        }
      }
    }

    // Update Learner Model — fire and forget. Dual-write with Evidence emission
    // below; see lib/compass/evidence.ts and docs/architecture/migration-ledger.md
    // for the exit condition that eventually removes this write.
    if (sessionRow?.subject) {
      updateFromCompass({
        studentId,
        topic:             sessionRow.subject as string,
        subject:           sessionRow.subject as string,
        masteredConcepts:  status === 'completed' ? masteredConcepts : [],
        sessionMins:       Math.round(durationSeconds / 60),
        completedAt:       new Date().toISOString(),
        sessionAbandoned:  status === 'abandoned',
      }).catch(() => {})

      getStudentBasicInfo(studentId)
        .then(student => recordCompassSessionEvidence({
          studentId,
          initiatedBy:      access.userId,
          sessionId,
          subject:          sessionRow.subject as string,
          sessionAbandoned: status === 'abandoned',
          exchangeCount:    exchanges,
          durationSeconds,
          genuineProgress,
          masteredConcepts: status === 'completed' ? masteredConcepts : [],
          endingLevel,
          academicYear:     student?.year ?? new Date().getFullYear(),
          term:             student?.term ?? null,
        }))
        .catch(err => console.error('[learn/end] recordCompassSessionEvidence failed', err))
    }

    return apiSuccess<EndSessionResult>({
      ended:            true,
      xpEarned,
      totalSessions:    newTotal,
      sessionsThisWeek: newWeekly,
      startingLevel,
      endingLevel,
      levelGained,
    })
  } catch (err) {
    console.error('[learn/end]', err)
    return apiError(getErrorMessage(err), 500)
  }
}
