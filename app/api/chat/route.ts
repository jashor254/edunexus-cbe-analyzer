// app/api/chat/route.ts - COMPLETE FIXED VERSION
import { learningCompass } from '@/lib/ai/learningCompass'
import { callDeepSeek } from '@/lib/ai/deepseek'
import { buildStudentRAGContext, buildRAGSystemPrompt } from '@/lib/ai/ragContext'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'

export async function POST(req: Request) {
  try {
    const {
      message,
      sessionId,
      learnerId,
      subjectId,
      sessionState,
      previousMessages = [],
    } = await req.json()

    // ── Auth ──
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    // ── Verify learner access ──
    if (learnerId && learnerId !== user.id) {
      const { data: student } = await db
        .from('students')
        .select('id')
        .eq('id', learnerId)
        .eq('user_id', user.id)
        .single()
      if (!student) return apiForbidden()
    }

    // ── Check subscription/tokens ──
    const [{ data: subscription }, { data: tokenData }] = await Promise.all([
      db.from('subscriptions').select('plan, expires_at').eq('user_id', user.id).eq('status', 'active').gt('expires_at', new Date().toISOString()).single(),
      db.from('token_balances').select('balance').eq('user_id', user.id).single(),
    ])

    const hasSubscription = !!subscription
    const tokenBalance = tokenData?.balance || 0

    if (!hasSubscription && tokenBalance < 1) {
      return apiError('Insufficient tokens', 403)
    }

    // ── Load or initialize compass state ──
    const { data: savedState } = await db
      .from('compass_sessions')
      .select('session_state')
      .eq('id', sessionId)
      .eq('learner_id', user.id)
      .eq('status', 'active')
      .single()

    const compassKnowsLearner = savedState?.session_state?.initialized === true

    if (!compassKnowsLearner) {
      const { data: assessments } = await db
        .from('assessments')
        .select(`*, students (name, grade)`)
        .eq('student_id', learnerId || user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      const { data: interests } = await db
        .from('student_interests')
        .select('*')
        .eq('student_id', learnerId || user.id)
        .single()

      if (assessments?.length) {
        await learningCompass.initializeFromAssessments(
          learnerId || user.id,
          assessments,
          interests
        )
      }
    } else if (savedState?.session_state) {
      learningCompass.restoreState(learnerId || user.id, savedState.session_state)
    }

    // ── RAG context ──
    let ragSystemPrompt = ''
    let ragCurriculumType: 'cbc' | 'igcse' | 'ib' | 'other' = 'cbc'
    try {
      const ragContext = await buildStudentRAGContext(learnerId || user.id, sessionId)
      ragSystemPrompt = buildRAGSystemPrompt(ragContext)
      ragCurriculumType = ragContext.curriculumType
    } catch (ragError) {
      console.error('[chat] RAG failed:', ragError)
    }

    // ── Detect struggle/confidence from message ──
    const msgLower = message.toLowerCase()
    const struggled = /don't understand|confused|help|sijaelewa|hard|sijui|ngumu|explain again|i don't get|not clear|repeat|tell me again/i.test(msgLower)
    const confident = /got it|understand|easy|nimeelewa|sawa|i see|makes sense|i get it|aha|clear now|now i understand/i.test(msgLower)
    const confidence: 'low' | 'medium' | 'high' = confident ? 'high' : struggled ? 'low' : 'medium'

    // ── Detect subject from message ──
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

    // ── BUILD previousTaskResult from conversation history ──
    const lastAssistantMsg = [...previousMessages].reverse().find((m: any) => m.role === 'assistant')
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

    // ── GET COMPASS DECISION ──
    const compassResponse = await learningCompass.getNextTask(
      learnerId || user.id,
      subject,
      previousTaskResult,
      ragSystemPrompt,
      ragCurriculumType
    )

    const task = compassResponse.task
    const hasQuestion = !!task.content.question
    const hasVisual = !!task.content.visualAid

    // ── 🔥 GENERATE ACTUAL RESPONSE USING DEEPSEEK 🔥 ──
    const responsePrompt = `
You are the Learning Compass tutor for a Kenyan student.

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
8. Use Kenyan context naturally (matatu, ugali, Nairobi, shamba, etc.)
9. ${struggled ? 'Be extra patient and break it down more simply' : 'Keep going at good pace'}
10. NEVER give the answer directly — guide with questions

Return ONLY the response text, no JSON, no markdown, no quotes around the response.
`

    const assistantResponse = await callDeepSeek(responsePrompt, ragSystemPrompt)

    // ── SAVE COMPASS STATE ──
    const updatedState = learningCompass.exportState(learnerId || user.id)
    await db
      .from('compass_sessions')
      .update({
        session_state: { ...updatedState, initialized: true },
        last_subject: subject,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    // ── DEDUCT TOKEN ──
    let newTokenBalance = tokenBalance
    if (!hasSubscription && tokenBalance > 0) {
      newTokenBalance = tokenBalance - 1
      await db.from('token_balances').update({ balance: newTokenBalance }).eq('user_id', user.id)
      await db.from('token_usage').insert({
        user_id: user.id,
        action: 'compass_session',
        tokens_used: 1,
        metadata: { session_id: sessionId, subject, difficulty: task.difficulty }
      })
    }

    // ── LOG MESSAGES WITH FULL METADATA ──
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
          difficulty: task.difficulty,
          subject: subject,
          type: task.type,
          questionProvided: hasQuestion,
          questionText: task.content.question,
          visualProvided: hasVisual,
          adaptationReason: compassResponse.adaptationReason,
          parentInsight: compassResponse.parentInsight,
          struggled: struggled,
          confidence: confidence,
        },
        created_at: new Date(Date.now() + 1).toISOString(),
      }
    ])

    // ── RETURN FULL RESPONSE TO FRONTEND ──
    return apiSuccess({
      text: assistantResponse,
      audioText: assistantResponse.substring(0, 400),
      difficulty: task.difficulty,
      type: task.type,
      adaptationReason: compassResponse.adaptationReason,
      encouragement: compassResponse.encouragement,
      parentInsight: compassResponse.parentInsight,
      visualAid: task.content.visualAid || null,
      sessionUpdate: {
        timeOnTask: (sessionState?.timeOnTask || 0) + 5,
        currentSubject: subject,
        currentConcept: task.concept || 'current',
        needsBreak: compassResponse.needsBreak,
        breakDuration: compassResponse.breakDuration,
      },
      tokensRemaining: hasSubscription ? -1 : newTokenBalance,
    })
  } catch (error) {
    console.error('[chat] Error:', error)
    return apiError('Internal server error', 500)
  }
}