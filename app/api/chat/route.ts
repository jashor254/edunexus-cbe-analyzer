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
      lockedSubject,      // explicitly chosen via TopicChoice — highest priority
      lockedSubstrand,    // specific topic selected by student
      lockedGrade,        // grade for the selected topic (may differ for revision)
      sessionState,
      previousMessages = [],
      struggleTopic,
      subjectFilter,
      isRevision = false,
      revisionGrade,
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
      { data: currentOutcomeData },
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
      db.from('compass_outcomes')
        .select('id, concept, substrand, mastery_statement, milestones, status, sessions_spent')
        .eq('student_id', learnerId || access.userId)
        .eq('status', 'in_progress')
        .order('updated_at', { ascending: false })
        .limit(1)
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
          struggleTopic: lockedSubstrand || struggleTopic || undefined,
          subjectFilter: lockedSubject   || subjectFilter  || undefined,
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

    // ── Subject resolution — priority order ───────────────────────────────────
    // 1. lockedSubject from TopicChoice (explicit student choice) — highest
    // 2. Saved lockedSubject from session_state (persists across messages)
    // 3. sessionState.currentSubject (from previous turns in this session)
    // 4. Keyword detection from message — last resort only
    type StoredSessionState = {
      consecutiveSuccesses?: number
      initialized?: boolean
      lockedSubject?: string
      lockedSubstrand?: string
      [key: string]: unknown
    }
    const storedState = (savedState?.session_state ?? {}) as StoredSessionState

    const savedLockedSubject   = storedState.lockedSubject   as string | undefined
    const savedLockedSubstrand = storedState.lockedSubstrand as string | undefined

    const effectiveLockedSubject   = lockedSubject   || savedLockedSubject
    const effectiveLockedSubstrand = lockedSubstrand || savedLockedSubstrand

    let subject: string
    if (effectiveLockedSubject) {
      subject = effectiveLockedSubject
    } else if (sessionState?.currentSubject && sessionState.currentSubject !== '') {
      subject = sessionState.currentSubject
    } else {
      // Last resort: keyword detection
      const subjectKeywords: Record<string, string[]> = {
        mathematics:        ['math', 'algebra', 'fraction', 'percentage', 'geometry', 'equation', 'hesabu', 'numbers', 'calculate', 'sum', 'divide', 'multiplication'],
        english:            ['english', 'grammar', 'reading', 'writing', 'essay', 'spelling', 'vocabulary', 'noun', 'verb'],
        kiswahili:          ['kiswahili', 'sarufi', 'insha', 'kusoma', 'fasihi', 'ngeli', 'viambishi'],
        biology:            ['biology', 'cell', 'plant', 'animal', 'heart', 'photosynthesis', 'organism', 'digestion', 'respiratory'],
        chemistry:          ['chemistry', 'atom', 'molecule', 'reaction', 'element', 'compound', 'chemical', 'periodic'],
        physics:            ['physics', 'force', 'energy', 'electricity', 'circuit', 'motion', 'light', 'gravity', 'speed'],
        geography:          ['geography', 'map', 'weather', 'climate', 'river', 'mountain', 'population', 'volcano'],
        agriculture:        ['agriculture', 'farm', 'crop', 'soil', 'planting', 'harvest', 'fertilizer', 'irrigation', 'hay', 'silage'],
        history:            ['history', 'colonialism', 'independence', 'war', 'king', 'empire', 'ancient'],
        integrated_science: ['science', 'experiment', 'solar', 'ecosystem', 'environment'],
      }
      subject = subjectId || 'mathematics'
      for (const [subj, keywords] of Object.entries(subjectKeywords)) {
        if (keywords.some(k => msgLower.includes(k))) { subject = subj; break }
      }
    }

    // Active concept — locked substrand takes priority over session state
    const activeConcept = effectiveLockedSubstrand || (sessionState as { currentConcept?: string } | null)?.currentConcept || ''

    // ── BUILD previousTaskResult from conversation history ────────────────────
    const lastAssistantMsg = [...previousMessages].reverse().find((m: { role: string }) => m.role === 'assistant') as { role: string; metadata?: { questionProvided?: boolean; questionText?: string } } | undefined
    const lastTaskHadQuestion = lastAssistantMsg?.metadata?.questionProvided === true
    const lastTaskQuestion    = lastAssistantMsg?.metadata?.questionText || ''

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

    const task       = compassResponse.task
    const hasQuestion = !!task.content.question
    const hasVisual   = !!task.content.visualAid

    // ── Compass Bridge — specific AI briefing per student ────────────────────
    type CompassBridgeShape = {
      sessionGoal?: string
      firstSubject?: string
      firstConcept?: string
      startDifficulty?: 1 | 2 | 3
      subjectPriorities?: Array<{
        subject?: string
        displayName?: string
        currentTier?: string
        requiredTier?: string
        gap?: number
        careerReason?: string
        actionSteps?: string[]
      }>
      weeklyMilestones?: Array<{ week?: number; goal?: string; subject?: string; checkConcept?: string }>
      parentWhatsAppMessage?: string
      summary?: { recommendedPathway?: string }
    }
    const cb = (learningContext as { compass_bridge?: CompassBridgeShape } | null)?.compass_bridge
    const top = cb?.subjectPriorities?.[0]
    const compassBridgeContext = cb
      ? `\n## PERSONALIZED COMPASS BRIEFING:
Session Goal: ${cb.sessionGoal ?? ''}
Start Subject: ${cb.firstSubject ?? top?.subject ?? ''}
Start Concept: ${cb.firstConcept ?? ''}
Start Difficulty: ${cb.startDifficulty ?? 2}/5

Subject Priorities:
${(cb.subjectPriorities ?? []).slice(0, 3).map(s =>
  `${s.displayName ?? s.subject ?? ''}: ${s.currentTier ?? ''} → needs ${s.requiredTier ?? ''}
   Why: ${s.careerReason ?? ''}
   Steps: ${(s.actionSteps ?? []).join(', ')}`
).join('\n')}

Week 1 Goal: ${cb.weeklyMilestones?.[0]?.goal ?? ''}
When student asks WHY they need to learn this, use the career reason above.\n`
      : ''

    // ── Session context ───────────────────────────────────────────────────────
    const consecutiveSuccesses = (storedState.consecutiveSuccesses as number | undefined) ?? 0

    type MilestoneRecord = {
      step: number
      description: string
      checkQuestion: string
      achieved: boolean
      achievedAt?: string
    }
    const outcomeMilestones  = (currentOutcomeData?.milestones ?? []) as MilestoneRecord[]
    const currentOutcomeStep = outcomeMilestones.filter(m => m.achieved).length + 1

    const overallLevel = (learningContext?.overall_level as number | null) ?? 2
    const tier         = (learningContext?.overall_tier   as string | null) ?? 'developing'
    const isLevel1     = overallLevel <= 1 || tier === 'below_expectation'
    const isLevel4     = overallLevel >= 4 || tier === 'above_expectation'
    const profile = {
      toneKey:          isLevel1 ? 'patient and simple' : isLevel4 ? 'direct and challenging' : 'warm and focused',
      skipBasics:       isLevel4,
      openEndedAllowed: overallLevel >= 3,
      askToTeachBack:   overallLevel >= 3,
    }

    const firstName   = (studentProfile?.name as string | null)?.split(' ')[0] ?? 'there'
    const studentGrade = (studentProfile?.grade as number | null) ?? 7
    const topicGrade  = (lockedGrade as number | undefined) ?? studentGrade

    // ── STEP 3: Topic context block (replaces substrandContext) ───────────────
    // Built when a topic was explicitly selected — gives AI precise scope
    const topicContext = effectiveLockedSubstrand
      ? `\n## LOCKED TOPIC — TEACH ONLY THIS:
Subject: ${subject}
Specific Topic: ${effectiveLockedSubstrand.replace(/_/g, ' ')}
${topicGrade !== studentGrade
  ? `Revision Mode: Grade ${topicGrade} content (student is Grade ${studentGrade})`
  : `Grade: ${studentGrade}`}

FIRST MESSAGE RULE — if this is the first message about this topic:
  Do NOT say "Today we will learn about..."
  Ask ONE diagnostic question to find where they are:
  Level 1-2 (below/approaching): give A/B/C multiple choice
  Level 3-4 (meets/exceeds): ask open question — "What do you already know about [specific concept]?"

TOPIC LOCK — CRITICAL:
  Every single response must relate to this topic.
  Do NOT drift to other subjects even if student mentions them.
  If student asks about something else: "Let's finish [topic] first. We can cover that next."
  Question AND answer choices MUST both be about this topic — never mix topics.\n`
      : (struggleTopic && struggleTopic !== 'help_me_decide'
          ? `\n## SPECIFIC TOPIC SELECTED BY STUDENT:
Substrand: ${struggleTopic.replace(/_/g, ' ')}
Subject: ${subjectFilter ?? ''}
Stay focused on THIS specific substrand until the student shows mastery.
Do not drift to other topics unless directly asked.\n`
          : '')

    // ── Revision mode context ─────────────────────────────────────────────────
    const revisionContext = isRevision && revisionGrade && (revisionGrade as number) < studentGrade
      ? `\n## REVISION MODE:
Student is Grade ${studentGrade} revising Grade ${revisionGrade as number} content.
- They have seen this before — do not treat it as brand new
- Move faster than normal intro pace
- Opening question: "What do you remember about [concept]?" — NOT "Today we will learn about..."\n`
      : ''

    // ── Build response prompt ─────────────────────────────────────────────────
    const responsePrompt = `You are the EduNexus Learning Compass — a knowledgeable, calm tutor. Like a smart older sibling who knows their subject well.
${compassBridgeContext}${topicContext}${revisionContext}
VOICE — FOLLOW EXACTLY:
What you sound like: "What do you know about [concept] already?" / "Look at just the top number first." / "Right. Now try this one." / "Not quite. Think about what [specific thing] means." / "Got it. Here's a harder one."

What you NEVER say:
- "Sawa sawa!" / "That's awesome!" / "Keep going, you're doing great!" / "Excellent effort!"
- "Like sharing chapati..." / "Imagine Otieno/Wanjiku/Kamau..." / "Mama sells sukuma..."
- "Step 1... Step 2... Step 3..." (no numbered lists)
- Any food analogy / Any transport analogy / Any named character / Any emoji
- "I have a diagram — click the button" — NEVER narrate the UI; just teach

FORMAT: Short. Max 3 sentences + 1 question. ONE question per response — always.
No numbered lists. No bullet points. Direct prose + question.
${isLevel1 ? 'Level 1 student: one sentence max, then multiple choice (A/B/C options).' : ''}${isLevel4 ? 'Level 4 student: lead with the question; explain only if they struggle.' : ''}

EXAMPLES: use abstract objects — "a rectangle", "a number line", "a set of 8 items" — NOT food, NOT transport, NOT people.

TOPIC INTEGRITY:
Every question AND every answer choice must be about: ${subject} / ${activeConcept || subject}
NEVER ask about topic A and give answer choices about topic B.
If you catch yourself mixing topics — stop and redirect to the locked topic.

ALWAYS: End with a question. Name what was wrong specifically. When right: confirm briefly then advance ("Right. Now:"). When stuck 3+ attempts: show a worked example then a DIFFERENT problem.

CURRENT SESSION:
Student: ${firstName} | Subject: ${subject} | Topic: ${activeConcept || 'current topic'} | Difficulty: ${task.difficulty}/5
${currentOutcomeData ? `Goal: "${currentOutcomeData.mastery_statement as string}"
Milestone: Step ${currentOutcomeStep}/4 — ${outcomeMilestones[Math.min(currentOutcomeStep - 1, 3)]?.description ?? ''}` : ''}
Student said: "${message}"
${struggled ? 'STRUGGLING — be patient, try a completely different angle' : confident ? 'CONFIDENT — advance to harder problem' : 'WORKING THROUGH IT — steady pace'}
Consecutive successes: ${consecutiveSuccesses}
${lastTaskQuestion ? `Last question you asked: "${lastTaskQuestion}"` : ''}

WHAT TO TEACH (about ${activeConcept || subject}):
${task.content.instruction}
${task.content.example ? `Example: ${task.content.example}` : ''}
${hasQuestion ? `Ask: ${task.content.question}` : 'Guide without giving the answer'}
${hasVisual ? '(A diagram is shown automatically in the UI — do not mention it in text)' : ''}

RESPOND in ${profile.toneKey} tone. Max 3 sentences + 1 question.
${profile.skipBasics ? 'Skip recall — go straight to application.' : ''}${profile.openEndedAllowed ? ' Open-ended questions allowed.' : ' Multiple choice only (A/B/C options).'}${profile.askToTeachBack && consecutiveSuccesses >= 2 ? ' Ask them to explain their reasoning.' : ''}

Return ONLY the response text. No JSON. No markdown. No preamble.`

    const assistantResponse = await callDeepSeek(responsePrompt, ragSystemPrompt)

    // ── Advance outcome milestone if mastery threshold reached ───────────────
    let outcomeAdvanced = false
    let newOutcomeStep  = currentOutcomeStep
    let outcomeAchieved = false

    if (currentOutcomeData && confident && consecutiveSuccesses >= 2) {
      const nextUnachieved = outcomeMilestones.find(m => !m.achieved)
      if (nextUnachieved) {
        const updatedMilestones: MilestoneRecord[] = outcomeMilestones.map(m =>
          m.step === nextUnachieved.step
            ? { ...m, achieved: true, achievedAt: new Date().toISOString() }
            : m
        )
        const allAchieved = updatedMilestones.every(m => m.achieved)
        await db
          .from('compass_outcomes')
          .update({
            milestones:     updatedMilestones,
            status:         allAchieved ? 'achieved' : 'in_progress',
            achieved_at:    allAchieved ? new Date().toISOString() : null,
            sessions_spent: ((currentOutcomeData.sessions_spent as number | null) ?? 0) + 1,
            last_attempted: new Date().toISOString(),
            updated_at:     new Date().toISOString(),
          })
          .eq('id', currentOutcomeData.id)
        outcomeAdvanced = true
        newOutcomeStep  = updatedMilestones.filter(m => m.achieved).length + 1
        outcomeAchieved = allAchieved
      }
    }

    // ── SAVE COMPASS STATE — persist subject lock across messages ─────────────
    const updatedState = learningCompass.exportState(learnerId || access.userId)
    await db
      .from('compass_sessions')
      .update({
        session_state: {
          ...updatedState,
          initialized:      true,
          lockedSubject:    effectiveLockedSubject   || savedLockedSubject,
          lockedSubstrand:  effectiveLockedSubstrand || savedLockedSubstrand,
        },
        last_subject: subject,
        updated_at:   new Date().toISOString(),
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
          activeConcept:    activeConcept,
          type:             task.type,
          questionProvided: hasQuestion,
          questionText:     task.content.question,
          visualProvided:   hasVisual,
          adaptationReason: compassResponse.adaptationReason,
          parentInsight:    compassResponse.parentInsight,
          struggled,
          confidence,
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
      outcomeAdvanced,
      newOutcomeStep,
      outcomeAchieved,
      sessionUpdate: {
        timeOnTask:      (sessionState?.timeOnTask || 0) + 5,
        currentSubject:  subject,
        currentConcept:  activeConcept || task.concept || 'current',
        lockedSubject:   effectiveLockedSubject,
        lockedSubstrand: effectiveLockedSubstrand,
        needsBreak:      compassResponse.needsBreak,
        breakDuration:   compassResponse.breakDuration,
      },
      tokensRemaining,
    })
  } catch (error) {
    console.error('[chat] Error:', error)
    return apiError('Internal server error', 500)
  }
}
