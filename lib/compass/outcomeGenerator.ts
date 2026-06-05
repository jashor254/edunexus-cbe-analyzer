import { callDeepSeek } from '@/lib/ai/deepseek'
import type { LessonOutcome } from './lessonOutcomes'

type RawMilestone = {
  step: number
  description: string
  checkQuestion: string
}

type RawOutcome = {
  masteryStatement: string
  masteryEvidence: string[]
  milestones: RawMilestone[]
}

export async function generateLessonOutcome(
  subject: string,
  concept: string,
  substrand: string,
  grade: number,
  currentLevel: number,
  curriculumType: 'cbc' | '8-4-4' | 'igcse'
): Promise<LessonOutcome> {
  const prompt = `You are setting a lesson outcome for a Grade ${grade} ${curriculumType} student.

Subject: ${subject}
Concept: ${concept} (${substrand})
Current level: ${currentLevel}/4

Generate a lesson outcome as JSON with this exact structure:

{
  "masteryStatement": "One sentence starting with a verb — what they will DO when done",
  "masteryEvidence": [
    "Specific observable proof 1",
    "Specific observable proof 2",
    "Specific observable proof 3"
  ],
  "milestones": [
    { "step": 1, "description": "Understands the concept", "checkQuestion": "Simple recall question" },
    { "step": 2, "description": "Applies with support", "checkQuestion": "Guided practice question" },
    { "step": 3, "description": "Applies independently", "checkQuestion": "Independent problem" },
    { "step": 4, "description": "Can explain to others", "checkQuestion": "Explain why question" }
  ]
}

Rules:
- masteryStatement is ONE sentence starting with a verb
- Exactly 4 milestones, each harder than the last
- checkQuestions are specific, not "Do you understand?"
- No Kenyan context unless the subject genuinely requires it
- Return ONLY valid JSON`

  const raw = await callDeepSeek(prompt)

  let parsed: RawOutcome
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const candidate = JSON.parse(jsonMatch[0]) as RawOutcome
    if (!candidate.masteryStatement || !Array.isArray(candidate.milestones) || candidate.milestones.length !== 4) {
      throw new Error('Invalid outcome structure')
    }
    parsed = candidate
  } catch {
    parsed = {
      masteryStatement: `Solve ${concept} problems independently`,
      masteryEvidence: [
        'Solves 3 consecutive problems correctly without hints',
        'Can explain the reasoning behind the answer',
        'Solves a new variant without prompting',
      ],
      milestones: [
        { step: 1, description: 'Understands the concept',  checkQuestion: `What does ${concept} mean?` },
        { step: 2, description: 'Applies with support',     checkQuestion: 'Walk me through this step by step.' },
        { step: 3, description: 'Applies independently',    checkQuestion: 'Solve this on your own.' },
        { step: 4, description: 'Can explain to others',    checkQuestion: 'Why does this method work?' },
      ],
    }
  }

  return {
    id: crypto.randomUUID(),
    subject,
    concept,
    substrand,
    masteryStatement: parsed.masteryStatement,
    masteryEvidence: parsed.masteryEvidence,
    milestones: parsed.milestones.map(m => ({
      step:          m.step,
      description:   m.description,
      checkQuestion: m.checkQuestion,
      achieved:      false,
    })),
    status:       'in_progress',
    sessionsSpent: 0,
    setBy:        'learner',
  }
}
