// app/api/chat/route.ts
import { learningCompass } from '@/lib/ai/learningCompass'
import { callDeepSeek } from '@/lib/ai/deepseek'
import { buildStudentRAGContext, buildRAGSystemPrompt } from '@/lib/ai/ragContext'
import { createServiceClient } from '@/utils/supabase/service'
import { checkFeatureAccess, deductFeatureTokens } from '@/lib/payments/access'
import { type FeatureKey } from '@/lib/payments/config'
import { apiSuccess, apiError, apiForbidden } from '@/lib/api/response'

const FEATURE: FeatureKey = 'learning_compass'

export async function POST(req: Request) {
  try {
    const {
      message,
      sessionId,
      learnerId,
      subjectId,
      sessionState,
      previousMessages = [],
      struggleTopic,
      subjectFilter,
    } = await req.json()

    // ── Access check — auth + tier resolution via server session ──────────────
    const access = await checkFeatureAccess(FEATURE)
    if (access.allowed === false) {
      const status = access.reason === 'unauthenticated' ? 401 : 403
      return apiError(access.reason, status)
    }

    const db = createServiceClient()

    // ── Verify learner access ──────────────────────────────────────────────────
    if (learnerId && learnerId !== access.userId) {
      const { data: student } = await db
        .from('students')
        .select('id')
        .eq('id', learnerId)
        .eq('user_id', access.userId)
        .maybeSingle()
      if (!student) return apiForbidden()
    }

    // ── Load or initialize compass state ──────────────────────────────────────
    const [
      { data: savedState },
      { data: learningContext },
      { data: studentProfile },
    ] = await Promise.all([
      sessionId
        ? db.from('compass_sessions')
            .select('session_state')
            .eq('id', sessionId)
            .eq('learner_id', access.userId)
            .eq('status', 'active')
            .maybeSingle()
        : Promise.resolve({ data: null }),
      db.from('student_learning_context')
        .select('overall_tier, subject_tiers, subject_action_steps, subject_velocities, recommended_pathway, pathway_confidence, top_careers, career_gaps, first_subject, session_goal, guided_topics, overall_level, curriculum_type, grade, compass_bridge')
        .eq('student_id', learnerId || access.userId)
        .maybeSingle(),
      db.from('students')
        .select('name, grade, curriculum_type, current_pathway')
        .eq('id', learnerId || access.userId)
        .maybeSingle(),
    ])

    const compassKnowsLearner = savedState?.session_state?.initialized === true

    if (!compassKnowsLearner) {
      const [{ data: assessments }, { data: interests }] = await Promise.all([
        db.from('assessments')
          .select('*, students(name, grade, curriculum_type)')
          .eq('student_id', learnerId || access.userId)
          .order('created_at', { ascending: false })
          .limit(5),
        db.from('student_interests')
          .select('*')
          .eq('student_id', learnerId || access.userId)
          .maybeSingle(),
      ])

      await learningCompass.initializeFromAssessments(
        learnerId || access.userId,
        assessments || [],
        interests,
        learningContext ?? null,
        studentProfile ?? null
      )
    } else if (savedState?.session_state) {
      learningCompass.restoreState(learnerId || access.userId, savedState.session_state)
    }

    // ── RAG context ───────────────────────────────────────────────────────────
    let ragSystemPrompt = ''
    let ragCurriculumType: 'cbc' | 'igcse' | 'ib' | 'other' = 'cbc'
    try {
      const ragContext = await buildStudentRAGContext(
        learnerId || access.userId,
        sessionId,
        {
          struggleTopic: struggleTopic ?? undefined,
          subjectFilter: subjectFilter ?? undefined,
        }
      )
      ragSystemPrompt = buildRAGSystemPrompt(ragContext)
      ragCurriculumType = ragContext.curriculumType
    } catch (ragError) {
      console.error('[chat] RAG failed:', ragError)
    }

    // ── Detect struggle/confidence from message ───────────────────────────────
    const msgLower = message.toLowerCase()
    const struggled = /don't understand|confused|help|sijaelewa|hard|sijui|ngumu|explain again|i don't get|not clear|repeat|tell me again/i.test(msgLower)
    const confident = /got it|understand|easy|nimeelewa|sawa|i see|makes sense|i get it|aha|clear now|now i understand/i.test(msgLower)
    const confidence: 'low' | 'medium' | 'high' = confident ? 'high' : struggled ? 'low' : 'medium'

    // ── Detect subject from message ───────────────────────────────────────────
    const subjectKeywords: Record<string, string[]> = {
      mathematics: ['math', 'algebra', 'fraction', 'percentage', 'geometry', 'equation', 'hesabu', 'numbers', 'calculate', 'sum', 'times', 'divide', 'multiplication', 'addition', 'subtraction'],
      english: ['english', 'grammar', 'reading', 'writing', 'essay', 'spelling', 'vocabulary', 'noun', 'verb', 'adjective'],
      kiswahili: ['kiswahili', 'sarufi', 'insha', 'kusoma', 'fasihi', 'ngeli', 'viambishi', 'vitendawili'],
      biology: ['biology', 'cell', 'plant', 'animal', 'heart', 'photosynthesis', 'organism', 'living', 'human body', 'digestion', 'respiratory'],
      chemistry: ['chemistry', 'atom', 'molecule', 'reaction', 'element', 'compound', 'chemical', 'periodic'],
      physics: ['physics', 'force', 'energy', 'electricity', 'circuit', 'motion', 'light', 'gravity', 'speed', 'velocity', 'acceleration'],
      geography: ['geography', 'map', 'weather', 'climate', 'river', 'mountain', 'population', 'volcano', 'earthquake', 'lake victoria'],
      agriculture: ['agriculture', 'farm', 'crop', 'soil', 'planting', 'shamba', 'harvest', 'fertilizer', 'irrigation', 'maize', 'cow'],
      history: ['history', 'colonialism', 'independence', 'war', 'king', 'empire', 'ancient', 'mau mau', 'kenyatta'],
      integrated_science: ['science', 'experiment', 'solar', 'ecosystem', 'environment', 'energy'],
    }

    let subject = subjectId || 'mathematics'
    for (const [subj, keywords] of Object.entries(subjectKeywords)) {
      if (keywords.some(k => msgLower.includes(k))) {
        subject = subj
        break
      }
    }

    // ── BUILD previousTaskResult from conversation history ────────────────────
    const lastAssistantMsg = [...previousMessages].reverse().find((m: { role: string }) => m.role === 'assistant') as { role: string; metadata?: { questionProvided?: boolean; questionText?: string } } | undefined
    const lastTaskHadQuestion = lastAssistantMsg?.metadata?.questionProvided === true
    const lastTaskQuestion = lastAssistantMsg?.metadata?.questionText || ''

    let completed = true
    if (lastTaskHadQuestion && lastTaskQuestion) {
      const userAnswered = message.length > 10 && !msgLower.includes('?') && !struggled && !msgLower.includes('help')
      completed = userAnswered
    }

    const previousTaskResult = {
      completed,
      timeSpent: sessionState?.timeOnTask || 5,
      struggled,
      confidence,
    }

    // ── GET COMPASS DECISION ──────────────────────────────────────────────────
    const compassResponse = await learningCompass.getNextTask(
      learnerId || access.userId,
      subject,
      previousTaskResult,
      ragSystemPrompt,
      ragCurriculumType
    )

    const task = compassResponse.task
    const hasQuestion = !!task.content.question
    const hasVisual = !!task.content.visualAid

    // ── Compass Bridge career context ─────────────────────────────────────────
    type CompassBridgeShape = {
      summary?: { recommendedPathway?: string }
      sessionGoal?: string
      subjectPriorities?: Array<{ displayName?: string; careerReason?: string }>
      weeklyMilestones?: Array<{ goal?: string }>
    }
    const cb = (learningContext as { compass_bridge?: CompassBridgeShape } | null)?.compass_bridge
    const compassBridgeContext = cb
      ? `\n## CAREER CONTEXT FOR THIS SESSION:\nCareer Target: ${cb.summary?.recommendedPathway ?? ''}\nSession Goal: ${cb.sessionGoal ?? ''}\nPriority Subject: ${cb.subjectPriorities?.[0]?.displayName ?? ''}\nCareer Reason: ${cb.subjectPriorities?.[0]?.careerReason ?? ''}\nThis Week's Milestone: ${cb.weeklyMilestones?.[0]?.goal ?? ''}\n\nWhen teaching, connect every concept back to this career. If student asks why they need to learn this, use the career reason above.\n`
      : ''

    // ── 🔥 GENERATE ACTUAL RESPONSE USING DEEPSEEK 🔥 ────────────────────────
    const responsePrompt = `
You are the Learning Compass tutor for a Kenyan student.
${compassBridgeContext}

## WHAT TO TEACH:
- Instruction: ${task.content.instruction}
- Example: ${task.content.example || 'No example provided'}
- Question: ${task.content.question || 'Help them understand the concept'}
- Difficulty: ${task.difficulty}/5
- Type: ${task.type}

## CONTEXT:
- Student said: "${message}"
- Subject: ${subject}
- They ${struggled ? 'are struggling' : 'seem to understand'}
- Confidence: ${confidence}
- Encouragement to give: ${compassResponse.encouragement}

## REAL-WORLD CONTEXT TO USE:
${task.content.realWorldContext}

## YOUR RESPONSE MUST:
1. Start with encouragement: "${compassResponse.encouragement}"
2. Acknowledge what they said
3. Teach the concept using the instruction
4. Show the example clearly
5. ${hasQuestion ? `Ask EXACTLY: "${task.content.question}"` : 'Ask if they understand'}
6. ${hasVisual ? 'Say: "I have a diagram to help visualize this. Click the Diagram button below!"' : ''}
7. Keep under 200 words
8. Rotate examples naturally — universal, classroom, and Kenyan contexts; don't force Kenyan references into every sentence
9. ${struggled ? 'Be extra patient and break it down more simply' : 'Keep going at good pace'}
10. NEVER give the answer directly — guide with questions

Return ONLY the response text, no JSON, no markdown, no quotes around the response.
`

    const assistantResponse = await callDeepSeek(responsePrompt, ragSystemPrompt)

    // ── SAVE COMPASS STATE ────────────────────────────────────────────────────
    const updatedState = learningCompass.exportState(learnerId || access.userId)
    await db
      .from('compass_sessions')
      .update({
        session_state: { ...updatedState, initialized: true },
        last_subject: subject,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    // ── DEDUCT TOKEN — only after AI succeeds, only for token users ───────────
    let tokensRemaining = -1
    if (access.deductTokens) {
      await deductFeatureTokens(access.userId, FEATURE, access.cost)
      await db.from('token_usage').insert({
        user_id:     access.userId,
        action:      'compass_session',
        tokens_used: access.cost,
        metadata: { session_id: sessionId, subject, difficulty: task.difficulty },
      })
      const { data: updatedBalance } = await db
        .from('token_balances')
        .select('balance')
        .eq('user_id', access.userId)
        .maybeSingle()
      tokensRemaining = updatedBalance?.balance ?? 0
    }

    // ── LOG MESSAGES WITH FULL METADATA ──────────────────────────────────────
    await db.from('compass_messages').insert([
      {
        session_id: sessionId,
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      },
      {
        session_id: sessionId,
        role: 'assistant',
        content: assistantResponse,
        metadata: {
          difficulty:       task.difficulty,
          subject:          subject,
          type:             task.type,
          questionProvided: hasQuestion,
          questionText:     task.content.question,
          visualProvided:   hasVisual,
          adaptationReason: compassResponse.adaptationReason,
          parentInsight:    compassResponse.parentInsight,
          struggled:        struggled,
          confidence:       confidence,
        },
        created_at: new Date(Date.now() + 1).toISOString(),
      }
    ])

    // ── RETURN FULL RESPONSE TO FRONTEND ─────────────────────────────────────
    return apiSuccess({
      text:             assistantResponse,
      audioText:        assistantResponse.substring(0, 400),
      difficulty:       task.difficulty,
      type:             task.type,
      adaptationReason: compassResponse.adaptationReason,
      encouragement:    compassResponse.encouragement,
      parentInsight:    compassResponse.parentInsight,
      visualAid:        task.content.visualAid || null,
      sessionUpdate: {
        timeOnTask:     (sessionState?.timeOnTask || 0) + 5,
        currentSubject: subject,
        currentConcept: task.concept || 'current',
        needsBreak:     compassResponse.needsBreak,
        breakDuration:  compassResponse.breakDuration,
      },
      tokensRemaining,
    })
  } catch (error) {
    console.error('[chat] Error:', error)
    return apiError('Internal server error', 500)
  }
}
