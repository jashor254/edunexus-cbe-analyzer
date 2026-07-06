// app/api/learn/end/route.ts
import { z } from 'zod'
import { createServiceClient } from '@/utils/supabase/service'
import { checkFeatureAccess } from '@/lib/payments/access'
import { type FeatureKey } from '@/lib/payments/config'
import { endSession } from '@/lib/compass/session'
import { updateFromCompass } from '@/lib/learnerModel/updater'
import { apiSuccess, apiError, apiForbidden, getErrorMessage } from '@/lib/api/response'

const FEATURE: FeatureKey = 'learning_compass'

const EndSessionSchema = z.object({
  sessionId:       z.string().uuid(),
  studentId:       z.string().uuid(),
  status:          z.enum(['completed', 'abandoned']),
  durationSeconds: z.number().min(0),
  genuineProgress: z.boolean().optional().default(false),
})

function calcXp(exchanges: number, completed: boolean, genuineProgress: boolean): number {
  const base     = Math.min(exchanges, 15) * 10
  const complete = completed       ? 40 : 0
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
      genuineProgress,
    } = parsed.data

    const access = await checkFeatureAccess(FEATURE)
    if (access.allowed === false)
      return apiError(access.reason, access.reason === 'unauthenticated' ? 401 : 403)

    const db = createServiceClient()

    const { data: student } = await db
      .from('students')
      .select('id')
      .eq('id', studentId)
      .or(`user_id.eq.${access.userId},parent_user_id.eq.${access.userId}`)
      .maybeSingle()

    if (!student) return apiForbidden()

    const [sessionRes, contextRes] = await Promise.all([
      db.from('compass_sessions')
        .select('exchange_count, starting_level, ending_level')
        .eq('id', sessionId)
        .maybeSingle(),
      db.from('student_learning_context')
        .select('overall_level, total_sessions, sessions_this_week, week_start_date')
        .eq('student_id', studentId)
        .maybeSingle(),
    ])

    const session       = sessionRes.data
    const ctx           = contextRes.data
    const exchanges     = (session?.exchange_count  as number | null) ?? 0
    const startingLevel = (session?.starting_level  as number | null) ?? null
    const endingLevel   = (session?.ending_level    as number | null) ?? null

    const prevTotal     = (ctx?.total_sessions     as number | null) ?? 0
    const prevWeekly    = (ctx?.sessions_this_week as number | null) ?? 0
    const prevWeekStart = (ctx?.week_start_date    as string | null) ?? null

    const xpEarned       = calcXp(exchanges, status === 'completed', genuineProgress)
    const levelGained    = startingLevel !== null && endingLevel !== null && endingLevel > startingLevel

    const thisWeekMonday = getMondayOf(new Date())
    const isSameWeek     = prevWeekStart === thisWeekMonday
    const newWeekly      = isSameWeek ? prevWeekly + 1 : 1
    const newTotal       = prevTotal + 1

    // Resolve subject for group-points bonus
    const { data: sessionRow } = await db
      .from('compass_sessions')
      .select('subject')
      .eq('id', sessionId)
      .maybeSingle()

    await Promise.all([
      endSession(sessionId, studentId, status, durationSeconds),
      db.from('compass_sessions').update({ xp_earned: xpEarned }).eq('id', sessionId),
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

    // Update Learner Model — fire and forget
    if (sessionRow?.subject) {
      updateFromCompass({
        studentId,
        topic:             sessionRow.subject as string,
        subject:           sessionRow.subject as string,
        masteredConcepts:  [],
        sessionMins:       Math.round(durationSeconds / 60),
        completedAt:       new Date().toISOString(),
        sessionAbandoned:  status === 'abandoned',
      }).catch(() => {})
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
