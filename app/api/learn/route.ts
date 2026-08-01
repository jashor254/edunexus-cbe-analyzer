// app/api/learn/route.ts
import { createServiceClient } from '@/utils/supabase/service'
import { streamDeepSeek } from '@/lib/ai/deepseek'
import { getOrCreateSession, readSession, writeSession, resolveSubject, recordExchange, tierToLevel } from '@/lib/compass/session'
import { resolveCompassStudentAccess } from '@/lib/compass/ownership'
import { buildCompassPrompt, type CompassPromptParams, type KnowledgeContextBlock } from '@/lib/compass/prompt'
import type { RootCauseResult } from '@/lib/knowledgeGraph/types'
import { getGradeTopics } from '@/lib/compass/topics'
import { checkFeatureAccess, deductFeatureTokens } from '@/lib/payments/access'
import { checkDailyCallLimit } from '@/lib/ai/rateLimit'
import { type FeatureKey } from '@/lib/payments/config'
import { apiError } from '@/lib/api/response'
import { repos } from '@/lib/repositories'

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

// Keywords that unambiguously belong to maths — not to any science subject
const MATH_ONLY_KEYWORDS = [
  'equation', 'linear', 'algebra', 'polynomial', 'quadratic',
  'factori', 'indices', 'surds', 'logarithm', 'trigonometr',
  'calculus', 'matrix', 'vector',
]

// Keywords that unambiguously belong to science — not to mathematics
const SCIENCE_ONLY_KEYWORDS = [
  'photosynthesis', 'respiration', 'ecosystem', 'genetics',
  'evolution', 'organisms', 'digestion', 'periodic table',
  'atomic', 'ionic', 'covalent', 'momentum', 'magnetism',
]

function isSubtopicCompatible(subject: string, subtopic: string): boolean {
  const subj = subject.toLowerCase().replace(/_/g, ' ')
  const sub  = subtopic.toLowerCase().replace(/_/g, ' ')

  const isScienceSubject = subj.includes('science') || subj.includes('biology') ||
                           subj.includes('chemistry') || subj.includes('physics')
  const isMathSubject    = subj.includes('math') || subj.includes('mathematics')

  if (isScienceSubject && MATH_ONLY_KEYWORDS.some(kw => sub.includes(kw))) return false
  if (isMathSubject    && SCIENCE_ONLY_KEYWORDS.some(kw => sub.includes(kw))) return false

  return true
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
      subjectLevel,
      conversationHistory,
    } = await req.json()

    if (!learnerId) return apiError('learnerId is required', 400)
    const db = createServiceClient()
    const studentId = learnerId as string

    // ── Term mode (pure computation — needed early for getOrCreateSession) ────
    const { mode, holidayWeek } = detectMode(new Date())

    // Subject is often known from the request params — if so, we can start
    // getGradeTopics and getOrCreateSession in parallel with auth + DB reads.
    // When lockedSubject is absent we fall back to deriving it after the first batch.
    const earlySubject  = (lockedSubject as string | null) ?? null
    const earlyGrade    = typeof lockedGrade === 'number' ? lockedGrade : null

    const CLOSING_WORDS = ['done', 'goodbye', 'bye', 'kwa heri', 'tutaonana', "that's all", 'stop', 'quit']
    const isClosing = CLOSING_WORDS.some(w => (message as string).toLowerCase().includes(w))

    // ── Single parallel round: auth + all DB reads + topics ───────────────────
    // NOTE: getOrCreateSession() is intentionally NOT included here — it writes to
    // compass_sessions and must not run before ownership is verified below.
    const [
      access,
      savedSession,
      studentResult,
      contextResult,
      lastSessionResult,
      keepaliveRow,
      earlyTopics,
    ] = await Promise.all([
      // Auth + token check (was sequential before, now parallel)
      checkFeatureAccess(FEATURE),

      // Session history (only if resuming)
      sessionId ? readSession(sessionId, studentId) : Promise.resolve(null),

      // Student profile
      db.from('students')
        .select('name, grade, current_pathway')
        .eq('id', studentId)
        .maybeSingle(),

      // Learning context (levels, root causes, bridge)
      db.from('student_learning_context')
        .select('overall_level, subject_tiers, compass_bridge, session_goal, guided_topics, knowledge_root_causes, subject_action_steps, recommended_pathway, sessions_without_improvement')
        .eq('student_id', studentId)
        .maybeSingle(),

      // Last session summary for opener
      db.from('compass_sessions')
        .select('one_line_summary')
        .eq('learner_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Keepalive check (was a separate sequential await before)
      sessionId
        ? db.from('compass_sessions').select('updated_at').eq('id', sessionId as string).maybeSingle()
        : Promise.resolve(null),

      // KICD topics — start immediately if subject+grade are in the request
      earlySubject && earlyGrade
        ? getGradeTopics(earlyGrade, earlySubject, { minGrade: earlyGrade <= 9 ? 7 : earlyGrade })
        : Promise.resolve(null),
    ])
    const lastSessionRow = lastSessionResult.data

    // ── Auth result ───────────────────────────────────────────────────────────
    if (access.allowed === false) {
      const status = access.reason === 'unauthenticated' ? 401 : 403
      return apiError(access.reason, status)
    }

    // ── Ownership: verify this student belongs to the authenticated user ───────
    if (!studentResult.data) return apiError('Student not found', 404)
    const ownership = await resolveCompassStudentAccess(access.userId, studentId)
    if (!ownership.allowed) return apiError('Access denied', 403)

    // Session upsert — only runs once ownership is verified above, since this writes
    // to compass_sessions. Started immediately post-auth if subject is in the request.
    const earlySession = earlySubject
      ? await getOrCreateSession(studentId, earlySubject, mode)
      : null

    // ── Daily abuse-prevention cap ────────────────────────────────────────────
    const rateLimit = await checkDailyCallLimit(access.userId, FEATURE)
    if (rateLimit.allowed === false) {
      return apiError(`Daily limit of ${rateLimit.limit} sessions reached. Resets at ${rateLimit.resetAt}`, 429)
    }

    // ── Keepalive: idle session check (no AI call needed) ─────────────────────
    if (sessionId && !isClosing && keepaliveRow) {
      const lastActive = (keepaliveRow as { data: { updated_at: string } | null }).data?.updated_at ?? null
      if (lastActive) {
        const idleMs = Date.now() - new Date(lastActive).getTime()
        if (idleMs > 20 * 60 * 1000) {
          return new Response("Still there? Your session is still active.", {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Session-Id': sessionId as string,
            },
          })
        }
      }
    }

    // ── Resolve subject ───────────────────────────────────────────────────────
    const subject = resolveSubject(
      {
        lockedSubject,
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
    // compass_bridge.firstConcept is validated: if it belongs to a different subject (e.g.
    // linear_equations stored against integrated_science), treat it as null so we fall back
    // to the subject name rather than confusing the AI with a mismatched topic.
    const compassBridge = (ctx?.compass_bridge ?? {}) as Record<string, unknown>
    const bridgeConcept = compassBridge.firstConcept as string | null
    const validBridgeConcept = bridgeConcept && isSubtopicCompatible(subject, bridgeConcept)
      ? bridgeConcept
      : null
    const subtopic = activeSubstrand ?? validBridgeConcept ?? subject

    // Teacher recommendation — only when teacher explicitly set a compass topic
    const teacherSuggested: boolean = !!(compassBridge.teacherSuggested)
    const teacherRecommendation: string | undefined = teacherSuggested
      ? ((compassBridge.strandName as string | null) ?? undefined)
      : undefined

    // Holiday focus from the session goal stored in learning context
    const holidayFocus: string | undefined =
      (ctx?.session_goal as string | null) ?? undefined

    // ── Knowledge graph context ───────────────────────────────────────────────
    // Build a concise block for the system prompt when root cause data exists for
    // the current subject. Only injected when data is fresh and subject-relevant.
    let knowledgeContext: KnowledgeContextBlock | undefined

    const knowledgeRootCauses = (ctx?.knowledge_root_causes as RootCauseResult[] | null) ?? []
    const guidedTopics        = (ctx?.guided_topics as string[] | null) ?? []
    const subjectActionStepsAll = (ctx?.subject_action_steps as Record<string, string[]> | null) ?? {}

    // Match action steps to current subject (case-insensitive)
    const actionStepKey = Object.keys(subjectActionStepsAll).find(
      k => k.toLowerCase() === subject.toLowerCase()
    )
    const subjectActionSteps = actionStepKey ? (subjectActionStepsAll[actionStepKey] ?? []) : []

    // Find root causes for this specific subject
    const subjectRootCauses = knowledgeRootCauses.filter(
      r => r.subject.toLowerCase() === subject.toLowerCase()
    )

    if (subjectRootCauses.length > 0 || guidedTopics.length > 0) {
      let rootCauseSummary: string | null = null
      let rootCauseTopic:   string | null = null
      let failingTopic:     string | null = null

      if (subjectRootCauses.length > 0) {
        // Sort by worst performance first
        const top = [...subjectRootCauses].sort((a, b) => (a.performance ?? 0) - (b.performance ?? 0))[0]
        const deepest = top.root_causes.slice().sort((a, b) => b.depth - a.depth)[0]

        if (deepest) {
          rootCauseTopic   = deepest.name
          failingTopic     = top.failing_topic_name
          rootCauseSummary = `${failingTopic} blocked by: ${rootCauseTopic}${top.root_causes.length > 1 ? ` (${top.root_causes.length}-step chain)` : ''}`
        }
      }

      knowledgeContext = {
        sessionGoal:        (ctx?.session_goal as string | null) ?? null,
        guidedTopics:       guidedTopics.slice(0, 4),
        rootCauseSummary,
        subjectActionSteps: subjectActionSteps.slice(0, 2),
        graphOpener:        false,   // set to true below once session.isNew is known
        rootCauseTopic,
        failingTopic,
      }
    }

    // ── Topics + session — use early results if subject/grade matched request params ─
    // Junior (Grade 7–9): include topics from all lower grades for revision context.
    // Senior (Grade 10+): locked to their own grade.
    const gradeTopicsPromise = (earlySubject === subject && earlyGrade === grade && earlyTopics !== null)
      ? Promise.resolve(earlyTopics)
      : getGradeTopics(grade, subject, { minGrade: isJunior ? 7 : grade })

    const sessionPromise = (earlySubject === subject && earlySession !== null)
      ? Promise.resolve(earlySession)
      : getOrCreateSession(studentId, subject, mode)

    const [gradeTopics, session] = await Promise.all([gradeTopicsPromise, sessionPromise])
    const activeSessionId = sessionId ?? session.sessionId

    // Enable graph-driven opener only for brand-new sessions with root cause data
    if (knowledgeContext && session.isNew && knowledgeContext.rootCauseTopic && knowledgeContext.failingTopic) {
      knowledgeContext = { ...knowledgeContext, graphOpener: true }
    }

    // Record starting level on new sessions so completion screen can show level gained
    if (session.isNew) {
      void db.from('compass_sessions')
        .update({ starting_level: level })
        .eq('id', activeSessionId)
    }

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
      knowledgeContext,
      sessionsWithoutImprovement: (ctx?.sessions_without_improvement as number | null) ?? 0,
      mode,
      holidayWeek,
      holidayFocus,
      languageMode,
      questionMode,
    }

    const systemPrompt = buildCompassPrompt(promptParams)

    const history = Array.isArray(conversationHistory)
      ? (conversationHistory as { role: 'user' | 'assistant'; content: string }[])
      : []

    // ── Stream from DeepSeek ──────────────────────────────────────────────────
    // costContext resolved server-side (never trusted from the request);
    // a student/parent with no resolvable organization gets no costContext,
    // which is a no-op per lib/ai/deepseek.ts's contract.
    const [compassOrg] = await repos.organizations.findUserOrganizations(access.userId)
    const costContext = compassOrg
      ? { organizationId: compassOrg.id, feature: FEATURE }
      : undefined
    const rawStream = await streamDeepSeek(systemPrompt, message as string, history, { temperature: 0.3, costContext })

    type CompassEval = {
      genuine_progress: boolean
      recommend_subject_rest: boolean
      one_line_summary: string
    }

    const EVAL_START = 'COMPASS_EVAL_START'
    const EVAL_END   = 'COMPASS_EVAL_END'

    const encoder = new TextEncoder()
    let accumulated  = ''
    let sseBuffer    = ''
    let firstToken   = false

    const transformStream = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        sseBuffer += new TextDecoder().decode(chunk)
        const lines = sseBuffer.split('\n')
        sseBuffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data) as { choices: [{ delta: { content?: string } }] }
            const content = parsed.choices[0]?.delta?.content ?? ''
            if (content) {
              if (!firstToken) firstToken = true
              accumulated += content
              controller.enqueue(encoder.encode(content))
            }
          } catch { /* malformed SSE line */ }
        }
      },

      async flush(controller) {
        // Flush any remaining SSE buffer line
        if (sseBuffer.startsWith('data: ')) {
          const data = sseBuffer.slice(6).trim()
          if (data && data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data) as { choices: [{ delta: { content?: string } }] }
              const content = parsed.choices[0]?.delta?.content ?? ''
              if (content) {
                accumulated += content
                controller.enqueue(encoder.encode(content))
              }
            } catch { /* malformed */ }
          }
        }

        // Parse eval block if session is closing
        const evalStartIdx = accumulated.indexOf(EVAL_START)
        const evalEndIdx   = accumulated.indexOf(EVAL_END)

        let parsedEval: CompassEval | null = null
        if (evalStartIdx !== -1 && evalEndIdx !== -1 && evalEndIdx > evalStartIdx) {
          try {
            parsedEval = JSON.parse(
              accumulated.slice(evalStartIdx + EVAL_START.length, evalEndIdx).trim()
            ) as CompassEval
          } catch (parseErr) {
            console.error('[learn] eval parse failed:', parseErr)
          }
        }

        const visibleResponse = parsedEval
          ? (accumulated.slice(0, evalStartIdx) + accumulated.slice(evalEndIdx + EVAL_END.length)).trim()
          : accumulated.trim()

        // Increment exchange count
        await recordExchange(activeSessionId)

        // Clear teacherSuggested flag after first message so greeting only fires once
        if (teacherSuggested && session.isNew) {
          const updatedBridge = { ...compassBridge, teacherSuggested: false }
          await db.from('student_learning_context')
            .update({ compass_bridge: updatedBridge })
            .eq('student_id', studentId)
        }

        // Persist eval results
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

        // A substrand the AI itself assessed as genuine progress this exchange
        // counts as evidence of mastery for the Learner Model at session end.
        const priorMastered = savedSession?.masteredConcepts ?? []
        const masteredConcepts =
          parsedEval?.genuine_progress && activeSubstrand && !priorMastered.includes(activeSubstrand)
            ? [...priorMastered, activeSubstrand].slice(-20)
            : priorMastered

        // Save session state
        await writeSession(activeSessionId, {
          lockedSubject:    lockedSubject    || savedSession?.lockedSubject    || null,
          lockedSubstrand:  activeSubstrand,
          lockedGrade:      (lockedGrade as number | null) || savedSession?.lockedGrade || null,
          isRevision,
          studentGrade:     grade,
          overallLevel:     level,
          initialized:      true,
          masteredConcepts,
        })

        // Log messages
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

        // Deduct tokens
        if (access.deductTokens) {
          await deductFeatureTokens(access.userId, FEATURE, access.cost)
        }
      },
    })

    return new Response(rawStream.pipeThrough(transformStream), {
      headers: {
        'Content-Type':     'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Session-Id':     activeSessionId,
      },
    })

  } catch (error) {
    console.error('[learn] FATAL:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
