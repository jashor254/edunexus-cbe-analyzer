// lib/sow/aiLessonGenerator.ts
// Adapted from jashor-app aiLessonGenerator.js
// Replaces aiClient with direct DeepSeek API calls.
// Supports both CBC and 8-4-4 curricula.

import { validateLesson } from './validators'
import type { CurriculumMode } from './types'

const MAX_RETRIES = 3
const MAX_CONFIDENCE = 0.92

// ─── DeepSeek API call ──────────────────────────────────────────────────────

async function callDeepSeek(prompt: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'You are a Kenya curriculum expert. ' +
            'Return ONLY valid JSON. ' +
            'No markdown. No explanation. ' +
            'No code blocks. Pure JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildLessonPrompt({
  learningArea,
  grade,
  strand,
  substrand,
  lessonNumber,
  totalLessons,
  curriculumMode,
}: {
  learningArea: string
  grade: string
  strand: string
  substrand: string
  lessonNumber: number
  totalLessons: number
  curriculumMode: CurriculumMode
}): string {
  const isCBC = curriculumMode.startsWith('cbc')

  const curriculumContext = isCBC
    ? `Kenya CBC Competency-Based Curriculum
       Assessment: Continuous formative (Levels 1-4)
       Approach: Learner-centered, inquiry-based
       Context: Kenyan classroom, local examples`
    : `Kenya 8-4-4 KCSE Curriculum
       Assessment: Summative exams (marks-based)
       Approach: Content mastery, exam preparation
       Context: Kenyan secondary school`

  return `
You are a Kenyan curriculum expert preparing ONE lesson only.

CURRICULUM: ${curriculumContext}

STRICT RULES:
${
  isCBC
    ? `
- Follow KICD CBC curriculum design
- NO exams, NO tests, NO marks
- Learner-centered activities
- Real Kenyan context examples
- Competency-based outcomes
`
    : `
- Follow 8-4-4 KCSE syllabus
- Exam-oriented objectives
- Content mastery focus
- Past paper style questions
- KCSE marking scheme awareness
`
}

LESSON DETAILS:
Subject: ${learningArea}
${isCBC ? 'Grade' : 'Form'}: ${grade}
Strand/Topic: ${strand}
Substrand/Subtopic: ${substrand}
Lesson: ${lessonNumber} of ${totalLessons}

MANDATORY JSON FORMAT:
{
  "learning_outcomes": [
    "By end of lesson learner should...",
    "Learner should be able to...",
    "Learner should apply/appreciate..."
  ],
  "learning_experiences": [
    "Learners work in groups to...",
    "Learners discuss and explain...",
    "Learners demonstrate..."
  ],
  "key_inquiry_questions": [
    "Why does...?",
    "How can...?",
    "What would happen if...?"
  ],
  "assessment_methods": [
    "Observation",
    "Oral questions",
    "Written exercise"
  ],
  "learning_resources": [
    "Textbooks",
    "Charts",
    "Real objects"
  ],
  "core_competencies": "${
    isCBC
      ? 'Communication, Critical thinking, Collaboration'
      : 'Problem solving, Critical thinking'
  }",
  "values": "Respect, Responsibility, Unity",
  "pci_links": "${
    isCBC
      ? 'Health Education, Citizenship, Life Skills'
      : 'Guidance and Counselling, Life Skills'
  }"
}

IMPORTANT:
- Exactly 3 learning outcomes minimum
- Use ${isCBC ? 'Kenyan CBC' : 'KCSE'} terminology
- Outcomes must progress in complexity
- Output VALID JSON ONLY
  `
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface LessonGenerationContext {
  learningArea: string
  grade: string
  strand: string
  substrand: string
  lessonNumber: number
  totalLessons: number
  curriculumMode: CurriculumMode
}

export interface ValidatedLessonResult {
  learning_outcomes?: string[]
  learning_experiences?: string[]
  key_inquiry_questions?: string[]
  assessment_methods?: string[]
  learning_resources?: string[]
  core_competencies?: string
  values?: string
  pci_links?: string
  _validated: boolean
  _confidence: number
  _source: string
  error?: string
  details?: string
}

export async function generateValidatedLesson(
  context: LessonGenerationContext
): Promise<ValidatedLessonResult> {
  let attempt = 0
  let lastError: string | null = null

  while (attempt < MAX_RETRIES) {
    attempt++

    const prompt = buildLessonPrompt(context)

    let aiResponse: string
    try {
      aiResponse = await callDeepSeek(prompt)
    } catch (err: any) {
      lastError = `AI request failed: ${err.message}`
      continue
    }

    let lesson: Record<string, any>
    try {
      // Strip any accidental markdown fences before parsing
      const cleaned = aiResponse
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()
      lesson = JSON.parse(cleaned)
    } catch {
      lastError = 'AI returned invalid JSON'
      continue
    }

    const validation = validateLesson(lesson, context.substrand)

    if (validation.isValid) {
      return {
        ...lesson,
        _validated: true,
        _confidence: Math.min(0.85 + attempt * 0.03, MAX_CONFIDENCE),
        _source: 'deepseek_sow_generator',
      }
    }

    lastError = validation.issues.join('; ')
  }

  return {
    error: 'Lesson failed validation',
    details: lastError || 'Unknown error',
    _validated: false,
    _confidence: 0,
    _source: 'deepseek_sow_generator',
  }
}
