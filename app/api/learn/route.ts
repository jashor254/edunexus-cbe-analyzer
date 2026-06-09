// app/api/learn/route.ts
import { createServiceClient } from '@/utils/supabase/service'
import { callDeepSeek } from '@/lib/ai/deepseek'
import { getOrCreateSession, readSession, writeSession, resolveSubject, recordExchange } from '@/lib/compass/session'
import { buildCompassPrompt, type CompassPromptParams } from '@/lib/compass/prompt'
import { getGradeTopics } from '@/lib/compass/topics'
import { checkFeatureAccess, deductFeatureTokens } from '@/lib/payments/access'
import { type FeatureKey } from '@/lib/payments/config'
import { apiSuccess, apiError } from '@/lib/api/response'

const FEATURE: FeatureKey = 'learning_compass'

// Kenya CBC term calendar
// Term 1: Jan 1 – Apr 11 | Term 2: Apr 29 – Aug 1 | Term 3: Sep 1 – Oct 31
function detectMode(date: Date): { mode: 'school' | 'holiday'; holidayWeek?: number } {
  const mmdd = (date.getMonth() + 1) * 100 + date.getDate()

  const inTerm =
    (mmdd >= 101 && mmdd <= 411) ||
    (mmdd >= 429 && mmdd <= 801) ||
    (mmdd >= 901 && mmdd <= 1031)

  if (inTerm) return { mode: 'school' }

  let holidayStart: Date
  if (mmdd >= 412 && mmdd <= 428) {
    holidayStart = new Date(date.getFullYear(), 3, 12)  // Apr 12
  } else if (mmdd >= 802 && mmdd <= 831) {
    holidayStart = new Date(date.getFullYear(), 7, 2)   // Aug 2
  } else {
    holidayStart = new Date(date.getFullYear(), 10, 1)  // Nov 1
  }

  const week = Math.min(4, Math.max(1, Math.floor(
    (date.getTime() - holidayStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
  ) + 1))

  return { mode: 'holiday', holidayWeek: week }
}

// Maps DB tier string to 1–4.
// Current values: 'challenge' | 'standard' | 'reinforcement' | 'remedial'
// Legacy fallback handles old 'approaching_expectations' style strings.
function tierToLevel(tier: string): 1 | 2 | 3 | 4 {
  if (tier === 'challenge'     || tier.includes('exceeding'))   return 4
  if (tier === 'standard'      || tier.includes('meeting'))     return 3
  if (tier === 'reinforcement' || tier.includes('approaching')) return 2
  return 1 // remedial or unknown
}

const VALID_PATHWAYS = ['STEM', 'Social Sciences', 'Arts & Sports'] as const
type ValidPathway = (typeof VALID_PATHWAYS)[number]

function normalisePathway(raw: string | null): ValidPathway | null {
  if (!raw) return null
  // 'Arts & Sports Science' → 'Arts & Sports'
  const cleaned = raw.replace(/\s*Science\s*$/, '').trim()
  return (VALID_PATHWAYS as readonly string[]).includes(cleaned)
    ? (cleaned as ValidPathway)
    : null
}

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
      subjectLevel,
      conversationHistory,
    } = await req.json()

    console.log('[learn] conversationHistory received:', JSON.stringify(conversationHistory?.slice(-3)))

    // ── Auth ──────────────────────────────────────────────────────────────────
    const access = await checkFeatureAccess(FEATURE)
    if (access.allowed === false) {
      const status = access.reason === 'unauthenticated' ? 401 : 403
      return apiError(access.reason, status)
    }

    if (!learnerId) return apiError('learnerId is required', 400)
    const db = createServiceClient()
    const studentId = learnerId as string

    // ── Keepalive: if session idle > 20 min, return soft nudge without calling DeepSeek
    if (sessionId) {
      const { data: sessionRow } = await db
        .from('compass_sessions')
        .select('updated_at')
        .eq('id', sessionId as string)
        .maybeSingle()

      const CLOSING_WORDS = ['done', 'goodbye', 'bye', 'kwa heri', 'tutaonana', "that's all", 'stop', 'quit']
      const isClosing = CLOSING_WORDS.some(w => (message as string).toLowerCase().includes(w))

      const lastActive = sessionRow?.updated_at as string | null
      if (lastActive && !isClosing) {
        const idleMs = Date.now() - new Date(lastActive).getTime()
        if (idleMs > 20 * 60 * 1000) {
          return apiSuccess({
            text:          "Still there? Your session is still active.",
            evalSummary:   null,
            sessionId,
            sessionUpdate: null,
            tokensRemaining: -1,
          })
        }
      }
    }

    // ── Parallel DB reads ─────────────────────────────────────────────────────
    const [savedSession, studentResult, contextResult] = await Promise.all([
      sessionId ? readSession(sessionId, studentId) : Promise.resolve(null),
      db.from('students')
        .select('name, grade, current_pathway')
        .eq('id', studentId)
        .maybeSingle(),
      db.from('student_learning_context')
        .select('overall_level, subject_tiers, compass_bridge, session_goal, recommended_pathway, sessions_without_improvement')
        .eq('student_id', studentId)
        .maybeSingle(),
    ])

    // ── Last session summary (separate — needs studentId, not sessionId) ───────
    const { data: lastSessionRow } = await db
      .from('compass_sessions')
      .select('one_line_summary')
      .eq('learner_id', studentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // ── Resolve subject ───────────────────────────────────────────────────────
    const subject = resolveSubject(
      {
        lockedSubject,
        sessionSubject: (sessionState as { currentSubject?: string } | null)?.currentSubject,
        message,
      },
      savedSession
    )

    const activeSubstrand = lockedSubstrand || savedSession?.lockedSubstrand || null

    // ── Derive student data ───────────────────────────────────────────────────
    const student = studentResult.data
    const ctx     = contextResult.data

    const firstName = (student?.name as string | null)?.split(' ')[0] ?? 'there'
    const grade     = (student?.grade as number | null) ?? 7
    const isJunior  = grade <= 9

    // Level priority: client-provided subjectLevel → per-subject tier → overall_level
    const subjectTiers = (ctx?.subject_tiers ?? {}) as Record<string, string>
    const tierKey      = Object.keys(subjectTiers).find(
      k => k.toLowerCase() === subject.toLowerCase()
    )
    const tierLevel = tierKey
      ? tierToLevel(subjectTiers[tierKey])
      : ((ctx?.overall_level as number | null) ?? savedSession?.overallLevel ?? 2)
    const clientLevel = typeof subjectLevel === 'number' && subjectLevel >= 1 && subjectLevel <= 4
      ? subjectLevel as 1 | 2 | 3 | 4
      : null
    const level = clientLevel ?? (Math.max(1, Math.min(4, tierLevel)) as 1 | 2 | 3 | 4)

    // Pathway — only meaningful for senior students; prefer student record, fall back to context
    const pathway: ValidPathway | null = isJunior
      ? null
      : normalisePathway(
          (student?.current_pathway as string | null) ??
          (ctx?.recommended_pathway as string | null)
        )

    // Subtopic — locked substrand → compass_bridge concept → subject name
    const compassBridge = (ctx?.compass_bridge ?? {}) as Record<string, unknown>
    const subtopic = activeSubstrand
      ?? (compassBridge.firstConcept as string | null)
      ?? subject

    // Teacher recommendation — only when teacher explicitly set a compass topic
    const teacherSuggested: boolean = !!(compassBridge.teacherSuggested)
    const teacherRecommendation: string | undefined = teacherSuggested
      ? ((compassBridge.strandName as string | null) ?? undefined)
      : undefined

    // Holiday focus from the session goal stored in learning context
    const holidayFocus: string | undefined =
      (ctx?.session_goal as string | null) ?? undefined

    // Term mode
    const { mode, holidayWeek } = detectMode(new Date())

    // ── Grade topics from KICD curriculum ────────────────────────────────────
    const gradeTopics = await getGradeTopics(grade, subject)

    // ── Create / resume compass_sessions DB record ─────────────────────────────
    const session = await getOrCreateSession(studentId, subject, mode)
    console.log('[learn] session:', session)

    const activeSessionId = sessionId ?? session.sessionId

    // Derived from level
    const languageMode: 'mixed' | 'english-only'                  = level <= 2 ? 'mixed'              : 'english-only'
    const questionMode: 'mcq-and-structured' | 'structured-only'  = level <= 2 ? 'mcq-and-structured' : 'structured-only'

    // ── Build prompt ──────────────────────────────────────────────────────────
    const promptParams: CompassPromptParams = {
      firstName,
      grade,
      level,
      isJunior,
      pathway,
      subject,
      subtopic,
      gradeTopics,
      lastSessionSummary:         (lastSessionRow?.one_line_summary as string | null) ?? undefined,
      teacherRecommendation,
      teacherSuggested,
      sessionsWithoutImprovement: (ctx?.sessions_without_improvement as number | null) ?? 0,
      mode,
      holidayWeek,
      holidayFocus,
      languageMode,
      questionMode,
    }

    const systemPrompt = buildCompassPrompt(promptParams)

    // ── Call DeepSeek ─────────────────────────────────────────────────────────
    const history = Array.isArray(conversationHistory)
      ? (conversationHistory as { role: 'user' | 'assistant'; content: string }[])
      : []

    const response = await callDeepSeek(
      message,
      systemPrompt,
      { temperature: 0.3, maxTokens: 400, history }
    )

    // ── Increment exchange count ──────────────────────────────────────────────
    await recordExchange(activeSessionId)

    // ── Parse eval block (if session is closing) ──────────────────────────────
    console.log('[learn] raw response:', response?.slice(0, 200))
    console.log('[learn] has eval:', response?.includes('COMPASS_EVAL_START'))

    type CompassEval = {
      genuine_progress: boolean
      recommend_subject_rest: boolean
      one_line_summary: string
    }

    const EVAL_START = 'COMPASS_EVAL_START'
    const EVAL_END   = 'COMPASS_EVAL_END'

    const evalStartIdx = response.indexOf(EVAL_START)
    const evalEndIdx   = response.indexOf(EVAL_END)

    let visibleResponse = response
    let parsedEval: CompassEval | null = null

    if (evalStartIdx !== -1 && evalEndIdx !== -1 && evalEndIdx > evalStartIdx) {
      visibleResponse = (
        response.slice(0, evalStartIdx) +
        response.slice(evalEndIdx + EVAL_END.length)
      ).trim()

      try {
        parsedEval = JSON.parse(
          response.slice(evalStartIdx + EVAL_START.length, evalEndIdx).trim()
        ) as CompassEval
      } catch (parseErr) {
        console.error('[learn] eval parse failed:', parseErr)
      }
    }

    // ── Clear teacherSuggested flag after first message so greeting only fires once
    if (teacherSuggested && session.isNew) {
      const updatedBridge = { ...compassBridge, teacherSuggested: false }
      await db.from('student_learning_context')
        .update({ compass_bridge: updatedBridge })
        .eq('student_id', studentId)
    }

    // ── Persist eval results ──────────────────────────────────────────────────
    if (parsedEval !== null) {
      const currentSwi = (ctx?.sessions_without_improvement as number | null) ?? 0

      try {
        await db.from('compass_sessions')
          .update({ one_line_summary: parsedEval.one_line_summary })
          .eq('id', activeSessionId)

        await db.from('student_learning_context')
          .update({
            sessions_without_improvement: parsedEval.genuine_progress ? 0 : currentSwi + 1,
            ...(parsedEval.recommend_subject_rest && {
              subject_rest_until: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            }),
          })
          .eq('student_id', studentId)
      } catch (err) {
        console.error('[learn] eval DB update failed:', err)
      }
    }

    // ── Save session state ────────────────────────────────────────────────────
    await writeSession(activeSessionId, {
      lockedSubject:    lockedSubject    || savedSession?.lockedSubject    || null,
      lockedSubstrand:  activeSubstrand,
      lockedGrade:      (lockedGrade as number | null) || savedSession?.lockedGrade || null,
      isRevision,
      studentGrade:     grade,
      overallLevel:     level,
      consecutiveRight: savedSession?.consecutiveRight ?? 0,
      consecutiveWrong: savedSession?.consecutiveWrong ?? 0,
      initialized:      true,
    })

    // ── Log messages ──────────────────────────────────────────────────────────
    await db.from('compass_messages').insert([
      {
        session_id: activeSessionId,
        role:       'user',
        content:    message,
        created_at: new Date().toISOString(),
      },
      {
        session_id: activeSessionId,
        role:       'assistant',
        content:    visibleResponse,
        metadata: {
          subject,
          substrand: activeSubstrand,
          level,
        },
        created_at: new Date(Date.now() + 1).toISOString(),
      },
    ])

    // ── Deduct tokens ─────────────────────────────────────────────────────────
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
      text:        visibleResponse,
      evalSummary: parsedEval?.one_line_summary ?? null,
      sessionId:   activeSessionId,
      sessionUpdate: {
        currentSubject:  subject,
        currentConcept:  activeSubstrand || '',
        lockedSubject,
        lockedSubstrand: activeSubstrand,
      },
      tokensRemaining,
    })

  } catch (error) {
    console.error('[learn] Error:', error)
    return apiError('Internal server error', 500)
  }
}
