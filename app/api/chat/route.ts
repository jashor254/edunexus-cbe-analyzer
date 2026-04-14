// app/api/chat/route.ts
import { learningCompass } from '@/lib/ai/learningCompass'
import { buildStudentRAGContext, buildRAGSystemPrompt } from '@/lib/ai/ragContext'
import { createClient } from '@/utils/supabase/server'       // ✅ correct path
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'

export async function POST(req: Request) {
  try {
    // ── 1. Parse body (matches what chat UI sends) ───────────────────────────
    const {
      message,
      sessionId,
      learnerId,
      subjectId,
      sessionState,   // optional — sent on subsequent messages
    } = await req.json()

    // ── 2. Auth ──────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return apiUnauthorized()
    }

    // ── 3. Check access — subscription OR token balance ──────────────────────
    const db = createServiceClient()

    // Verify learnerId belongs to this user
    if (learnerId && learnerId !== user.id) {
      const { data: student } = await db
        .from('students')
        .select('id')
        .eq('id', learnerId)
        .eq('user_id', user.id)
        .single()

      if (!student) {
        return apiForbidden()
      }
    }

    const [{ data: subscription }, { data: tokenData }] = await Promise.all([
      db
        .from('subscriptions')
        .select('plan, expires_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .single(),

      // ✅ token_balances (not user_tokens)
      db
        .from('token_balances')
        .select('balance')
        .eq('user_id', user.id)
        .single(),
    ])

    const hasSubscription = !!subscription
    const tokenBalance    = tokenData?.balance || 0

    if (!hasSubscription && tokenBalance < 1) {
      return apiError('Insufficient tokens', 403)
    }

    // ── 4. Load or initialize learner state from DB ──────────────────────────
    // This fixes the in-memory state loss between requests
    const { data: savedState } = await db
      .from('compass_sessions')
      .select('session_state')
      .eq('id', sessionId)
      .eq('learner_id', user.id)
      .eq('status', 'active')
      .single()

    // If compass doesn't know this learner yet, initialize from their assessments
    const compassKnowsLearner = savedState?.session_state?.initialized === true

    if (!compassKnowsLearner) {
      // Fetch latest assessments to initialize compass
      const { data: assessments } = await db
        .from('assessments')
        .select(`
          *,
          students (name, grade)
        `)
        .eq('student_id', learnerId || user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      const { data: interests } = await db
        .from('student_interests')
        .select('id, student_id, interests, learning_style, created_at')
        .eq('student_id', learnerId || user.id)
        .single()

      if (assessments && assessments.length > 0) {
        await learningCompass.initializeFromAssessments(
          learnerId || user.id,
          assessments,
          interests
        )
      }
    } else if (savedState?.session_state) {
      // Restore state into compass memory for this request
      learningCompass.restoreState(learnerId || user.id, savedState.session_state)
    }

    // ── 5. RAG: Retrieve full student context for personalized responses ────────
    let ragSystemPrompt = ''
    let ragCurriculumType: 'cbc' | 'igcse' | 'ib' | 'other' = 'cbc'
    try {
      const ragContext = await buildStudentRAGContext(
        learnerId || user.id,
        sessionId
      )
      ragSystemPrompt = buildRAGSystemPrompt(ragContext)
      ragCurriculumType = ragContext.curriculumType
    } catch (ragError) {
      console.error('[chat] RAG context failed (continuing without personalization):', ragError)
    }

    // ── 7. Detect struggle / confidence from message ─────────────────────────
    const msgLower = message.toLowerCase()

    const struggled =
      msgLower.includes("don't understand") ||
      msgLower.includes("confused") ||
      msgLower.includes("help") ||
      msgLower.includes("sijaelewa") ||
      msgLower.includes("hard") ||
      msgLower.includes("sijui") ||
      msgLower.includes("ngumu")

    const confident =
      msgLower.includes("got it") ||
      msgLower.includes("understand") ||
      msgLower.includes("easy") ||
      msgLower.includes("nimeelewa") ||
      msgLower.includes("sawa")

    const confidence: 'low' | 'medium' | 'high' =
      confident ? 'high' : struggled ? 'low' : 'medium'

    // ── 8. Detect subject from message ───────────────────────────────────────
    const subjectKeywords: Record<string, string[]> = {
      mathematics:        ['math', 'algebra', 'fraction', 'percentage', 'geometry', 'equation', 'number', 'hesabu'],
      english:            ['english', 'grammar', 'reading', 'writing', 'essay', 'vocabulary'],
      kiswahili:          ['kiswahili', 'sarufi', 'insha', 'kusoma', 'fasihi'],
      biology:            ['biology', 'cell', 'plant', 'animal', 'heart', 'photosynthesis', 'organism'],
      chemistry:          ['chemistry', 'atom', 'molecule', 'reaction', 'element', 'compound'],
      physics:            ['physics', 'force', 'energy', 'electricity', 'circuit', 'motion', 'light'],
      geography:          ['geography', 'map', 'weather', 'climate', 'river', 'mountain', 'population'],
      agriculture:        ['agriculture', 'farm', 'crop', 'soil', 'planting', 'harvest', 'irrigation'],
      history:            ['history', 'colonialism', 'independence', 'war', 'civilization'],
      integrated_science: ['science', 'experiment', 'hypothesis', 'solar', 'ecosystem'],
    }

    let subject = subjectId || 'mathematics'
    for (const [subj, keywords] of Object.entries(subjectKeywords)) {
      if (keywords.some(k => msgLower.includes(k))) {
        subject = subj
        break
      }
    }

    // ── 9. Detect preferred example type and persist to session state ────────
    let detectedExampleType: string | null = null
    if (
      msgLower.includes('food') || msgLower.includes('chapati') ||
      msgLower.includes('ugali') || msgLower.includes('cook')
    ) {
      detectedExampleType = 'food'
    } else if (
      msgLower.includes('money') || msgLower.includes('kes') ||
      msgLower.includes('pay') || msgLower.includes('buy')
    ) {
      detectedExampleType = 'money'
    } else if (
      msgLower.includes('sport') || msgLower.includes('football') ||
      msgLower.includes('run') || msgLower.includes('play')
    ) {
      detectedExampleType = 'sports'
    }

    if (detectedExampleType && savedState?.session_state) {
      await db
        .from('compass_sessions')
        .update({
          session_state: {
            ...savedState.session_state,
            preferredExampleType: detectedExampleType,
          },
        })
        .eq('id', sessionId)
    }

    // ── 10. Get compass decision ─────────────────────────────────────────────
    const compassResponse = await learningCompass.getNextTask(
      learnerId || user.id,
      subject,
      {
        completed: true,
        timeSpent: sessionState?.timeOnTask || 0,
        struggled,
        confidence,
      },
      ragSystemPrompt,
      ragCurriculumType
    )

    // ── 8. Persist updated learner state to DB ───────────────────────────────
    const updatedState = learningCompass.exportState(learnerId || user.id)

    await db
      .from('compass_sessions')
      .update({
        session_state:  { ...updatedState, initialized: true },
        last_subject:   subject,
        updated_at:     new Date().toISOString(),
      })
      .eq('id', sessionId)

    // ── 9. Deduct token (only if not on subscription) ────────────────────────
    if (!hasSubscription) {
      await db
        .from('token_balances')
        .update({ balance: tokenBalance - 1 })
        .eq('user_id', user.id)

      // Log token usage
      await db.from('token_usage').insert({
        user_id:     user.id,
        action:      'compass_session',
        tokens_used: 1,
        metadata: {
          session_id: sessionId,
          subject,
          difficulty: compassResponse.task.difficulty,
        }
      })
    }

    // ── 10. Log chat message ─────────────────────────────────────────────────
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
        content:    compassResponse.task.content.instruction,
        metadata: {
          difficulty:       compassResponse.task.difficulty,
          subject,
          struggled,
          confidence,
          visual_provided:  !!compassResponse.task.content.visualAid,
        },
        created_at: new Date(Date.now() + 1).toISOString(),
      }
    ])

    // ── 11. Format response to match what chat UI expects ────────────────────
    const task = compassResponse.task

    const responseText =
      task.content.instruction +
      (task.content.example
        ? `\n\n📌 Example: ${task.content.example}`
        : '') +
      (task.content.question
        ? `\n\n✏️ Try this: ${task.content.question}`
        : '') +
      `\n\n💡 ${compassResponse.encouragement}`

    // ✅ Response shape matches exactly what chat UI destructures
    return apiSuccess({
      text:      responseText,
      visualAid: task.content.visualAid || null,

      pedagogy: {
        strategy:              task.type,
        checkForUnderstanding: task.successCriteria,
      },

      parentInsight: {
        conceptAttempted:   task.concept,
        childApproach:      `Working at difficulty level ${task.difficulty} — ${compassResponse.adaptationReason}`,
        celebrationMoment:  compassResponse.encouragement,
        practiceIdea:       compassResponse.parentInsight,
        whyThisTask:        compassResponse.adaptationReason,
        emotionDetected:    struggled ? 'needs support' : confidence === 'high' ? 'confident' : 'engaged',
      },

      difficulty:        task.difficulty,
      adaptationReason:  compassResponse.adaptationReason,
      audioText:         task.content.instruction, // clean text for TTS

      tokensRemaining: hasSubscription
        ? 999  // unlimited
        : tokenBalance - 1,

      sessionUpdate: {
        timeOnTask:     (sessionState?.timeOnTask || 0) + task.estimatedMinutes,
        currentSubject: subject,
        currentConcept: task.concept,
        needsBreak:     compassResponse.needsBreak,
        breakDuration:  compassResponse.breakDuration,
      },
    })

  } catch (error: any) {
    console.error('[chat] error:', error.message)
    return apiError('Internal server error')
  }
}