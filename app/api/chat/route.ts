// app/api/chat/route.ts
import { createServiceClient } from '@/utils/supabase/service'
import { callDeepSeek } from '@/lib/ai/deepseek'
import { readSession, writeSession, resolveSubject } from '@/lib/compass/session'
import { buildCompassPrompt } from '@/lib/compass/prompt'
import { checkFeatureAccess, deductFeatureTokens } from '@/lib/payments/access'
import { type FeatureKey } from '@/lib/payments/config'
import { apiSuccess, apiError } from '@/lib/api/response'

const FEATURE: FeatureKey = 'learning_compass'

export async function POST(req: Request) {
  try {
    const {
      message,
      sessionId,
      learnerId,
      lockedSubject,
      lockedSubstrand,
      lockedGrade,
      isRevision = false,
      sessionState,
      previousMessages = [],
    } = await req.json()

    // ── Auth ──────────────────────────────────────────────────────────────────
    const access = await checkFeatureAccess(FEATURE)
    if (access.allowed === false) {
      const status = access.reason === 'unauthenticated' ? 401 : 403
      return apiError(access.reason, status)
    }

    const db = createServiceClient()

    // ── Read session state (ONE DB call) ──────────────────────────────────────
    const savedSession = sessionId
      ? await readSession(sessionId, access.userId)
      : null

    // ── Resolve subject (priority chain) ──────────────────────────────────────
    const subject = resolveSubject(
      {
        lockedSubject,
        sessionSubject: (sessionState as { currentSubject?: string } | null)?.currentSubject,
        message,
      },
      savedSession
    )

    const activeSubstrand = lockedSubstrand || savedSession?.lockedSubstrand || null

    // ── Get student profile ───────────────────────────────────────────────────
    const { data: student } = await db
      .from('students')
      .select('name, grade')
      .eq('id', learnerId || access.userId)
      .maybeSingle()

    // ── Get overall level from assessments ────────────────────────────────────
    const { data: context } = await db
      .from('student_learning_context')
      .select('overall_level, overall_tier')
      .eq('student_id', learnerId || access.userId)
      .maybeSingle()

    const overallLevel = (context?.overall_level as number | null) ?? savedSession?.overallLevel ?? 2

    // ── Detect struggle / confidence ──────────────────────────────────────────
    const msgLower = message.toLowerCase()
    const isStruggling = /don't understand|confused|help|sijaelewa|hard|sijui|ngumu|explain again|i don't get|not clear/i.test(msgLower)
    const isConfident  = /got it|understand|easy|nimeelewa|i see|makes sense|i get it|aha|clear now/i.test(msgLower)

    const prevRight = savedSession?.consecutiveRight ?? 0
    const prevWrong = savedSession?.consecutiveWrong ?? 0

    const consecutiveRight = isConfident  ? prevRight + 1 : 0
    const consecutiveWrong = isStruggling ? prevWrong + 1 : 0

    // ── Is this first message on topic? ───────────────────────────────────────
    const isFirstMessage =
      (previousMessages as unknown[]).length === 0 ||
      (lockedSubject && lockedSubject !== savedSession?.lockedSubject)

    // ── Build SHORT prompt ────────────────────────────────────────────────────
    const firstName    = (student?.name as string | null)?.split(' ')[0] ?? 'there'
    const studentGrade = (student?.grade as number | null) ?? 7

    const prompt = buildCompassPrompt({
      firstName,
      overallLevel,
      subject,
      substrand:        activeSubstrand,
      isRevision,
      revisionGrade:    (lockedGrade as number | undefined) ?? undefined,
      studentGrade,
      consecutiveRight,
      consecutiveWrong,
      message,
      isFirstMessage:   !!isFirstMessage,
    })

    // ── Call DeepSeek ─────────────────────────────────────────────────────────
    const response = await callDeepSeek(
      prompt,
      'You are a knowledgeable, calm tutor for Kenyan CBC students.'
    )

    // ── Save session state (ONE DB call) ──────────────────────────────────────
    if (sessionId) {
      await writeSession(sessionId, {
        lockedSubject:    lockedSubject    || savedSession?.lockedSubject    || null,
        lockedSubstrand:  activeSubstrand,
        lockedGrade:      (lockedGrade as number | null) || savedSession?.lockedGrade || null,
        isRevision,
        studentGrade,
        overallLevel,
        consecutiveRight,
        consecutiveWrong,
        initialized: true,
      })
    }

    // ── Log messages ──────────────────────────────────────────────────────────
    if (sessionId) {
      await db.from('compass_messages').insert([
        {
          session_id: sessionId,
          role:       'user',
          content:    message,
          created_at: new Date().toISOString(),
        },
        {
          session_id: sessionId,
          role:       'assistant',
          content:    response,
          metadata: {
            subject,
            substrand: activeSubstrand,
            level:     overallLevel,
          },
          created_at: new Date(Date.now() + 1).toISOString(),
        },
      ])
    }

    // ── Deduct tokens if needed ───────────────────────────────────────────────
    let tokensRemaining = -1
    if (access.deductTokens) {
      await deductFeatureTokens(access.userId, FEATURE, access.cost)
      const { data: bal } = await db
        .from('token_balances')
        .select('balance')
        .eq('user_id', access.userId)
        .maybeSingle()
      tokensRemaining = (bal?.balance as number | null) ?? 0
    }

    // ── Return ────────────────────────────────────────────────────────────────
    return apiSuccess({
      text: response,
      sessionUpdate: {
        currentSubject:  subject,
        currentConcept:  activeSubstrand || '',
        lockedSubject,
        lockedSubstrand: activeSubstrand,
      },
      tokensRemaining,
    })

  } catch (error) {
    console.error('[chat] Error:', error)
    return apiError('Internal server error', 500)
  }
}
