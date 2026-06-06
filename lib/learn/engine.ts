// lib/learn/engine.ts
// Adaptation math for /learn sessions.
// Pure functions — no DB, no side effects.

export type Phase = 'probe' | 'teach' | 'confirm' | 'complete'
export type QuestionType = 'multiple_choice' | 'open_ended' | 'true_false'

export interface SessionState {
  sessionId:           string
  studentId:           string
  subject:             string
  topic:               string
  topicDisplay:        string
  grade:               number
  overallLevel:        number  // 1-4 from assessment
  currentPhase:        Phase
  questionsAttempted:  number
  questionsCorrect:    number
  rightStreak:         number
  wrongStreak:         number
  currentDifficulty:   number  // 1-4
  masteryScore:        number  // 0-100
}

export interface Question {
  text:          string
  type:          QuestionType
  choices?:      string[]
  correctAnswer: string
  feedback:      string
  difficulty:    number
  phase:         Phase
}

export interface AnswerResult {
  isCorrect:     boolean
  feedback:      string
  newState:      SessionState
  nextAction:    'continue' | 'complete'
  masteryScore:  number
  encouragement: string
}

// ── Adaptation rules ──────────────────────────────────────────────────────────
// Wrong ×2 → difficulty down. Right ×3 → difficulty up.

export function calculateNextDifficulty(
  state: Pick<SessionState, 'rightStreak' | 'wrongStreak' | 'currentDifficulty' | 'questionsAttempted'>,
  isCorrect: boolean
): number {
  let difficulty = state.currentDifficulty

  if (isCorrect) {
    if (state.rightStreak + 1 >= 3) {
      difficulty = Math.min(4, difficulty + 1)
    }
  } else {
    if (state.wrongStreak + 1 >= 2) {
      difficulty = Math.max(1, difficulty - 1)
    }
  }

  return Math.min(4, Math.max(1, difficulty))
}

export function calculateMastery(
  correct:    number,
  attempted:  number,
  difficulty: number
): number {
  if (attempted === 0) return 0
  const baseScore     = (correct / attempted) * 100
  const difficultyBonus = (difficulty - 1) * 5
  return Math.min(100, Math.round(baseScore + difficultyBonus))
}

export function getNextPhase(
  state: Pick<SessionState, 'currentPhase' | 'questionsAttempted' | 'masteryScore'>
): Phase {
  const { currentPhase, questionsAttempted, masteryScore } = state

  if (currentPhase === 'probe' && questionsAttempted >= 2) return 'teach'

  if (currentPhase === 'teach' &&
    (questionsAttempted >= 7 || masteryScore >= 80)) return 'confirm'

  if (currentPhase === 'confirm' && questionsAttempted >= 9) return 'complete'

  return currentPhase
}

export function getEncouragement(
  isCorrect:    boolean,
  overallLevel: number,
  rightStreak:  number
): string {
  if (!isCorrect) {
    if (overallLevel <= 2) {
      const msgs = [
        "Not quite — let's look at it differently.",
        'Close. Try again.',
        "That's okay. Here's a hint:",
      ]
      return msgs[Math.floor(Math.random() * msgs.length)]
    }
    const msgs = [
      'Not right. Think about it again.',
      'No — what went wrong in your reasoning?',
      'Try again.',
    ]
    return msgs[Math.floor(Math.random() * msgs.length)]
  }

  if (overallLevel <= 2) {
    if (rightStreak >= 2) return 'Vizuri! Keep going.'
    const msgs = ['Correct.', 'Yes.', 'Right.', 'Good.']
    return msgs[Math.floor(Math.random() * msgs.length)]
  }

  if (rightStreak >= 3) return 'Strong. Moving up.'
  const msgs = ['Right.', 'Correct.', 'Good.', 'Yes.']
  return msgs[Math.floor(Math.random() * msgs.length)]
}

// Starting difficulty based on overall level:
// Level 1 → 1, Level 2 → 1, Level 3 → 2, Level 4 → 3
export function startingDifficulty(overallLevel: number): number {
  if (overallLevel >= 4) return 3
  if (overallLevel >= 3) return 2
  return 1
}
