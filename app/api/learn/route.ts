// app/api/learn/route.ts
// POST — start session, return first question
// PUT  — submit answer, return next question (or complete)

import { createServiceClient } from '@/utils/supabase/service'
import { callDeepSeek } from '@/lib/ai/deepseek'
import { checkFeatureAccess } from '@/lib/payments/access'
import {
  calculateNextDifficulty,
  calculateMastery,
  getNextPhase,
  getEncouragement,
  startingDifficulty,
} from '@/lib/learn/engine'
import { apiSuccess, apiError } from '@/lib/api/response'

// ── POST — Start session, get first question ──────────────────────────────────

export async function POST(req: Request) {
  try {
    const { subject, topic, topicDisplay, grade, studentId } = await req.json()

    const access = await checkFeatureAccess('learning_compass')
    if (access.allowed === false) {
      return apiError(access.reason, access.reason === 'unauthenticated' ? 401 : 403)
    }

    const db = createServiceClient()
    const targetStudentId = studentId || access.userId

    const [{ data: context }, { data: student }] = await Promise.all([
      db
        .from('student_learning_context')
        .select('overall_level')
        .eq('student_id', targetStudentId)
        .maybeSingle(),
      db
        .from('students')
        .select('name, grade')
        .eq('id', targetStudentId)
        .maybeSingle(),
    ])

    const overallLevel = (context?.overall_level as number) ?? 2
    const firstName    = student?.name?.split(' ')[0] ?? 'there'
    const studentGrade = student?.grade ?? grade
    const difficulty   = startingDifficulty(overallLevel)

    const { data: session, error: sessionError } = await db
      .from('learn_sessions')
      .insert({
        student_id:         targetStudentId,
        subject,
        topic,
        topic_display:      topicDisplay,
        grade:              studentGrade,
        overall_level:      overallLevel,
        current_phase:      'probe',
        current_difficulty: difficulty,
      })
      .select('id, started_at')
      .single()

    if (sessionError || !session) {
      return apiError('Could not start session', 500)
    }

    const q = await generateQuestion({
      subject, topic, topicDisplay,
      grade: studentGrade,
      level: overallLevel,
      difficulty,
      phase:             'probe',
      questionNum:       1,
      firstName,
      previousQuestions: [],
    })

    await db.from('learn_questions').insert({
      session_id:      session.id,
      question_number: 1,
      phase:           'probe',
      difficulty,
      question_text:   q.text,
      question_type:   q.type,
      choices:         q.choices ?? null,
      correct_answer:  q.correctAnswer,
      feedback:        q.feedback,
    })

    return apiSuccess({
      sessionId:     session.id,
      questionNum:   1,
      totalExpected: 10,
      phase:         'probe',
      question:      q,
      masteryScore:  0,
      progress: { attempted: 0, correct: 0, streak: 0 },
    })
  } catch (err) {
    console.error('[learn POST]', err)
    return apiError('Server error', 500)
  }
}

// ── PUT — Submit answer, get next question ────────────────────────────────────

export async function PUT(req: Request) {
  try {
    const { sessionId, questionNum, studentAnswer, timeTaken } = await req.json()

    const access = await checkFeatureAccess('learning_compass')
    if (access.allowed === false) {
      return apiError(access.reason, access.reason === 'unauthenticated' ? 401 : 403)
    }

    const db = createServiceClient()

    const [{ data: session }, { data: question }] = await Promise.all([
      db.from('learn_sessions').select('*').eq('id', sessionId).single(),
      db
        .from('learn_questions')
        .select('*')
        .eq('session_id', sessionId)
        .eq('question_number', questionNum)
        .single(),
    ])

    if (!session) return apiError('Session not found', 404)
    if (!question) return apiError('Question not found', 404)

    const isCorrect = await gradeAnswer(
      question.question_text as string,
      question.correct_answer as string,
      studentAnswer,
      question.question_type as string,
    )

    await db.from('learn_questions').update({
      student_answer:     studentAnswer,
      is_correct:         isCorrect,
      time_taken_seconds: timeTaken,
    }).eq('id', question.id)

    const newRightStreak = isCorrect ? (session.right_streak as number) + 1 : 0
    const newWrongStreak = !isCorrect ? (session.wrong_streak as number) + 1 : 0
    const newAttempted   = (session.questions_attempted as number) + 1
    const newCorrect     = isCorrect
      ? (session.questions_correct as number) + 1
      : (session.questions_correct as number)

    const newDifficulty = calculateNextDifficulty(
      {
        rightStreak:        session.right_streak as number,
        wrongStreak:        session.wrong_streak as number,
        currentDifficulty:  session.current_difficulty as number,
        questionsAttempted: session.questions_attempted as number,
      },
      isCorrect,
    )

    const newMastery = calculateMastery(newCorrect, newAttempted, newDifficulty)
    const newPhase   = getNextPhase({
      currentPhase:       session.current_phase as 'probe' | 'teach' | 'confirm' | 'complete',
      questionsAttempted: newAttempted,
      masteryScore:       newMastery,
    })

    const encouragement = getEncouragement(
      isCorrect,
      session.overall_level as number,
      newRightStreak,
    )

    const sessionUpdates = {
      current_phase:       newPhase,
      questions_attempted: newAttempted,
      questions_correct:   newCorrect,
      right_streak:        newRightStreak,
      wrong_streak:        newWrongStreak,
      current_difficulty:  newDifficulty,
      mastery_score:       newMastery,
      updated_at:          new Date().toISOString(),
    }

    // Session complete
    if (newPhase === 'complete') {
      await db.from('learn_sessions').update({
        ...sessionUpdates,
        status:       'complete',
        completed_at: new Date().toISOString(),
      }).eq('id', sessionId)

      return apiSuccess({
        isCorrect,
        encouragement,
        feedback:    question.feedback,
        nextAction:  'complete',
        masteryScore: newMastery,
        sessionSummary: {
          topic:       session.topic_display,
          attempted:   newAttempted,
          correct:     newCorrect,
          mastery:     newMastery,
          timeMinutes: Math.round(
            (Date.now() - new Date(session.started_at as string).getTime()) / 60000,
          ),
          nextTopic: getNextTopic(session.topic as string, newMastery),
        },
      })
    }

    await db.from('learn_sessions').update(sessionUpdates).eq('id', sessionId)

    const [{ data: student }, { data: prevQs }] = await Promise.all([
      db.from('students').select('name, grade').eq('id', session.student_id as string).maybeSingle(),
      db
        .from('learn_questions')
        .select('question_text')
        .eq('session_id', sessionId)
        .order('question_number'),
    ])

    const firstName = student?.name?.split(' ')[0] ?? 'there'

    const nextQ = await generateQuestion({
      subject:      session.subject as string,
      topic:        session.topic as string,
      topicDisplay: session.topic_display as string,
      grade:        session.grade as number,
      level:        session.overall_level as number,
      difficulty:   newDifficulty,
      phase:        newPhase,
      questionNum:  questionNum + 1,
      firstName,
      previousQuestions: (prevQs ?? []).map(q => q.question_text as string),
    })

    await db.from('learn_questions').insert({
      session_id:      sessionId,
      question_number: questionNum + 1,
      phase:           newPhase,
      difficulty:      newDifficulty,
      question_text:   nextQ.text,
      question_type:   nextQ.type,
      choices:         nextQ.choices ?? null,
      correct_answer:  nextQ.correctAnswer,
      feedback:        nextQ.feedback,
    })

    return apiSuccess({
      isCorrect,
      encouragement,
      feedback:       question.feedback,
      nextAction:     'continue',
      masteryScore:   newMastery,
      progress:       { attempted: newAttempted, correct: newCorrect, streak: newRightStreak },
      nextQuestion:   nextQ,
      nextQuestionNum: questionNum + 1,
    })
  } catch (err) {
    console.error('[learn PUT]', err)
    return apiError('Server error', 500)
  }
}

// ── Question generator ────────────────────────────────────────────────────────

interface GenerateParams {
  subject:           string
  topic:             string
  topicDisplay:      string
  grade:             number
  level:             number
  difficulty:        number
  phase:             string
  questionNum:       number
  firstName:         string
  previousQuestions: string[]
}

interface GeneratedQuestion {
  text:          string
  type:          string
  choices?:      string[]
  correctAnswer: string
  feedback:      string
}

async function generateQuestion(params: GenerateParams): Promise<GeneratedQuestion> {
  const {
    subject, topicDisplay, grade, level, difficulty,
    phase, questionNum, previousQuestions,
  } = params

  // Level 1-2: always multiple choice
  // Level 4 + hard question: open ended
  // Otherwise: alternate by question number
  const qType =
    level <= 2
      ? 'multiple_choice'
      : level >= 4 && difficulty >= 3
      ? 'open_ended'
      : questionNum % 2 === 0
      ? 'open_ended'
      : 'multiple_choice'

  const phaseInstructions: Record<string, string> = {
    probe:   'Find their current level. Start simple to gauge understanding.',
    teach:   'Teach the concept step by step. Build on what they know.',
    confirm: 'Confirm mastery with a different angle on the same concept.',
  }

  const difficultyDesc: Record<number, string> = {
    1: 'Very simple. Basic recall. One-step answer.',
    2: 'Simple application. Straightforward.',
    3: 'Grade-level. Requires thinking.',
    4: 'Challenging. Multi-step. Explain reasoning.',
  }

  const prevContext = previousQuestions.length
    ? `Previous questions asked:\n${previousQuestions
        .slice(-3)
        .map((q, i) => `${i + 1}. ${q}`)
        .join('\n')}\nDo NOT repeat these.`
    : ''

  const prompt = `Generate ONE exam-style question.

TOPIC: ${topicDisplay} (${subject})
GRADE: ${grade} CBC Kenya
STUDENT LEVEL: ${level}/4
DIFFICULTY: ${difficulty}/4 — ${difficultyDesc[difficulty] ?? 'Standard'}
PHASE: ${phase} — ${phaseInstructions[phase] ?? ''}
QUESTION TYPE: ${qType}

${prevContext}

RULES:
1. Question must be ONLY about: ${topicDisplay}
2. Never ask about other topics
3. ${
    qType === 'multiple_choice'
      ? '3 choices (A, B, C). One correct. Others plausible but wrong.'
      : 'Open ended — student types answer'
  }
4. Feedback explains WHY the answer is correct
5. Keep question under 30 words
6. No named characters (Wanjiku, Otieno etc)
7. No food analogies

Return ONLY this JSON:
{
  "text": "the question",
  "type": "${qType}",
  "choices": ${qType === 'multiple_choice' ? '["A) ...", "B) ...", "C) ..."]' : 'null'},
  "correctAnswer": "the correct answer",
  "feedback": "explanation of why correct (1-2 sentences)"
}`

  try {
    const raw   = await callDeepSeek(prompt, undefined, { temperature: 0.3, maxTokens: 400 })
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean) as GeneratedQuestion
  } catch {
    return {
      text:          `What do you know about ${topicDisplay}?`,
      type:          'multiple_choice',
      choices:       ['A) I understand it well', 'B) I know a little', 'C) I need help with this'],
      correctAnswer: 'A) I understand it well',
      feedback:      `${topicDisplay} is an important concept in ${subject}.`,
    }
  }
}

// ── Grade open-ended answers ──────────────────────────────────────────────────

async function gradeAnswer(
  question:     string,
  correctAnswer: string,
  studentAnswer: string,
  questionType:  string,
): Promise<boolean> {
  if (questionType === 'multiple_choice') {
    // Check letter match (A/B/C) or if student answer contains the correct option text
    const normalize = (s: string) => s.trim().toLowerCase().replace(/^([abc])[).:\s].*/i, '$1')
    if (normalize(studentAnswer) === normalize(correctAnswer)) return true
    // Fallback: full string includes
    return studentAnswer.trim().toLowerCase().includes(
      correctAnswer.trim().toLowerCase().slice(0, 10),
    )
  }

  const gradePrompt = `Grade this answer.

Question: ${question}
Correct answer: ${correctAnswer}
Student answer: ${studentAnswer}

Is the student's answer correct or essentially correct?
Reply with ONLY: "correct" or "incorrect"`

  try {
    const result = await callDeepSeek(gradePrompt, undefined, { temperature: 0.1, maxTokens: 10 })
    return result.toLowerCase().includes('correct') && !result.toLowerCase().includes('incorrect')
  } catch {
    return false
  }
}

// ── Suggest next topic ────────────────────────────────────────────────────────

function getNextTopic(currentTopic: string, mastery: number): string | null {
  if (mastery < 60) return null
  const progressions: Record<string, string> = {
    fractions:       'decimals',
    decimals:        'percentages',
    percentages:     'ratios',
    cell_structure:  'photosynthesis',
    photosynthesis:  'ecosystems',
  }
  return progressions[currentTopic] ?? null
}
