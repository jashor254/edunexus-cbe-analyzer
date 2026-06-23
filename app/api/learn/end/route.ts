// app/api/learn/end/route.ts
import { createServiceClient } from '@/utils/supabase/service'
import { checkFeatureAccess } from '@/lib/payments/access'
import { type FeatureKey } from '@/lib/payments/config'
import { endSession } from '@/lib/compass/session'
import { apiSuccess, apiError, apiForbidden, getErrorMessage } from '@/lib/api/response'

const FEATURE: FeatureKey = 'learning_compass'

// XP formula: base per exchange + completion bonus + progress bonus
function calcXp(exchanges: number, completed: boolean, genuineProgress: boolean): number {
  const base     = Math.min(exchanges, 15) * 10
  const complete = completed       ? 40 : 0
  const progress = genuineProgress ? 60 : 0
  return base + complete + progress
}

// Streak: +1 if last session was yesterday, reset to 1 if gap > 1 day, keep if same day
function calcStreak(lastDate: string | null, currentStreak: number): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (!lastDate) return 1
  const last = new Date(lastDate)
  last.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return currentStreak
  if (diffDays === 1) return currentStreak + 1
  return 1
}

type EndSessionBody = {
  sessionId:       string
  studentId:       string
  status:          'completed' | 'abandoned'
  durationSeconds: number
  genuineProgress?: boolean
}

export type EndSessionResult = {
  ended:         boolean
  xpEarned:      number
  streakDays:    number
  streakIsNew:   boolean
  startingLevel: number | null
  endingLevel:   number | null
  levelGained:   boolean
}

export async function POST(req: Request): Promise<Response> {
  try {
    const {
      sessionId,
      studentId,
      status,
      durationSeconds,
      genuineProgress = false,
    } = await req.json() as EndSessionBody

    if (!sessionId || !studentId)
      return apiError('sessionId and studentId are required', 400)
    if (status !== 'completed' && status !== 'abandoned')
      return apiError('Invalid status', 400)
    if (typeof durationSeconds !== 'number' || durationSeconds < 0)
      return apiError('Invalid durationSeconds', 400)

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
        .select('overall_level, streak_days, last_session_date')
        .eq('student_id', studentId)
        .maybeSingle(),
    ])

    const session       = sessionRes.data
    const ctx           = contextRes.data
    const exchanges     = (session?.exchange_count as number | null) ?? 0
    const startingLevel = (session?.starting_level as number | null) ?? null
    const endingLevel   = (session?.ending_level   as number | null) ?? null
    const currentStreak = (ctx?.streak_days        as number | null) ?? 0
    const lastDate      = (ctx?.last_session_date  as string | null) ?? null

    const xpEarned   = calcXp(exchanges, status === 'completed', genuineProgress)
    const newStreak  = calcStreak(lastDate, currentStreak)
    const today      = new Date().toISOString().slice(0, 10)
    const streakIsNew = lastDate !== today && (newStreak > currentStreak || newStreak === 1)
    const levelGained = startingLevel !== null && endingLevel !== null && endingLevel > startingLevel

    await Promise.all([
      endSession(sessionId, studentId, status, durationSeconds),
      db.from('compass_sessions').update({ xp_earned: xpEarned }).eq('id', sessionId),
      streakIsNew
        ? db.from('student_learning_context')
            .update({ streak_days: newStreak, last_session_date: today })
            .eq('student_id', studentId)
        : Promise.resolve(),
    ])

    return apiSuccess<EndSessionResult>({
      ended: true,
      xpEarned,
      streakDays:    newStreak,
      streakIsNew,
      startingLevel,
      endingLevel,
      levelGained,
    })
  } catch (err) {
    console.error('[learn/end]', err)
    return apiError(getErrorMessage(err), 500)
  }
}
