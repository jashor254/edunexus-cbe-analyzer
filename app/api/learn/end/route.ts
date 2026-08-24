// app/api/learn/end/route.ts
import { z } from 'zod'
import { createServiceClient } from '@/utils/supabase/service'
import { checkFeatureAccess } from '@/lib/payments/access'
import { type FeatureKey } from '@/lib/payments/config'
import { endSession } from '@/lib/compass/session'
import { resolveCompassAcademicLevelFor } from '@/lib/compass/learnerContext'
import { resolveCompassMutationAccess, resolveSessionOwnership } from '@/lib/compass/ownership'
import { recordCompassSessionEvidence } from '@/lib/compass/evidence'
import { completeDeliveryForSession } from '@/lib/compass/deliveryBinding'
import { awardCompassGroupBonus } from '@/lib/compass/groupBonus'
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

    // Phase P2 — session completion writes XP, ending_level, the Learner
    // Model, and Evidence (recordCompassSessionEvidence below). Same
    // mutation boundary as /api/learn POST — see resolveCompassMutationAccess.
    const ownership = await resolveCompassMutationAccess(access.userId, studentId)
    if (!ownership.allowed) return apiForbidden()

    const sessionOwned = await resolveSessionOwnership(sessionId, studentId)
    if (!sessionOwned) return apiForbidden()

    const [sessionRes, contextRes] = await Promise.all([
      db.from('compass_sessions')
        .select('exchange_count, starting_level, subject, session_state')
        .eq('id', sessionId)
        .maybeSingle(),
      db.from('student_learning_context')
        .select('overall_level, subject_tiers, total_sessions, sessions_this_week, week_start_date, compass_bridge')
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

    // Ending level — Adaptive Remediation Phase 1, Stage 5.
    //
    // This used to read `student_learning_context.subject_tiers` directly
    // and convert it with `tierToLevel()`. That tier map is written only by
    // the Academic Clinic pipeline and is never refreshed when evidence
    // changes — the exact stale snapshot `lib/compass/learnerContext.ts`
    // exists to bypass at session START. Reading it at session END meant the
    // legacy value re-entered the canonical Evidence Domain as the
    // `cbc_level` of this session's mastery claim, and made `levelGained`
    // compare a Projection-derived `starting_level` against a tier-derived
    // ending level — two different semantics.
    //
    // Both ends of a Compass session now speak the same language, via the
    // same resolver `/api/learn` already calls at start. `sessionLevel` is
    // seeded with this session's own `starting_level` so the resolver's
    // legacy tail degrades to the session's own start rather than to the
    // Clinic tier, and the tier map is still passed as the last-resort
    // fallback exactly as the resolver's documented precedence expects.
    const subjectTiers = (ctx?.subject_tiers as Record<string, string> | null) ?? {}
    const endingLevel = sessionRow?.subject
      ? (await resolveCompassAcademicLevelFor(studentId, sessionRow.subject as string, {
          subjectTiers,
          overallLevel: (ctx?.overall_level as number | null) ?? null,
          sessionLevel: startingLevel,
          clientHint:   null,
        })).level
      : ((ctx?.overall_level as number | null) ?? null)

    const levelGained = startingLevel !== null && endingLevel !== null && endingLevel > startingLevel

    // Ending a session is the atomic claim on everything that follows. XP,
    // session counters, the group bonus, the Learner Model write and Evidence
    // emission are all non-idempotent, and the client legitimately fires this
    // route more than once (idle wrap, countdown expiry, manual end button).
    // Only the call that actually transitions the session out of 'active' may
    // do that work; a repeat call reports the already-recorded outcome.
    const transitioned = await endSession(sessionId, studentId, status, durationSeconds)

    if (!transitioned) {
      const { data: settled } = await db
        .from('compass_sessions')
        .select('xp_earned, ending_level')
        .eq('id', sessionId)
        .maybeSingle()

      return apiSuccess<EndSessionResult>({
        ended:            true,
        xpEarned:         (settled?.xp_earned as number | null) ?? 0,
        totalSessions:    prevTotal,
        sessionsThisWeek: prevWeekly,
        startingLevel,
        endingLevel:      (settled?.ending_level as number | null) ?? endingLevel,
        levelGained:      false,
      })
    }

    await Promise.all([
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
      await awardCompassGroupBonus({
        studentId,
        sessionId,
        subject: sessionRow.subject as string,
      }).catch(err => console.error('[learn/end] awardCompassGroupBonus failed', err))
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

      // Phase 2.6 / G-08 — "the learner finished the session this
      // intervention sent them to". Matched on the exact bound session id,
      // never on learner + subject + recency. Says NOTHING about mastery:
      // the session's mastery claim below is still tier-1 pending_review
      // until a teacher confirms it, and whether the intervention worked is
      // a separate Blueprint action review. Fire-and-forget.
      void completeDeliveryForSession(sessionId)
        .catch(err => console.error('[learn/end] completeDeliveryForSession failed', err))

      const bridge = (ctx?.compass_bridge ?? {}) as Record<string, unknown>
      const bridgeSubject = (bridge.firstSubject as string | null) ?? null
      const targetSubStrandIdForSession =
        bridgeSubject !== null &&
        bridgeSubject.toLowerCase() === String(sessionRow.subject ?? '').toLowerCase()
          ? ((bridge.subStrandId as string | null) ?? null)
          : null

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
          // Phase 2 — a TARGETED session's mastery claim returns with the
          // curriculum identity the teacher aimed it at. The anchor is only
          // honoured when the queued objective was for THIS session's
          // subject: `compass_bridge` is a single per-learner slot, so a
          // Maths objective must never anchor a Kiswahili session's
          // evidence. An open, learner-directed session yields null and
          // stays subject-level, which is correct — nothing is inferred.
          targetSubStrandId: targetSubStrandIdForSession,
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
