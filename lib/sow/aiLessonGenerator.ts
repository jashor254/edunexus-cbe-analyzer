// lib/sow/aiLessonGenerator.ts
// Adapted from jashor-app aiLessonGenerator.js
// Replaces aiClient with direct DeepSeek API calls.
// Supports both CBC and 8-4-4 curricula.

import { validateLesson } from './validators'
import type { CurriculumMode } from './types'

const MAX_RETRIES = 5
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
  subjectType = 'default',
  kicdContext,
}: {
  learningArea: string
  grade: string
  strand: string
  substrand: string
  lessonNumber: number
  totalLessons: number
  curriculumMode: CurriculumMode
  subjectType?: string
  kicdContext?: { subjectData: Record<string, any>; strandData: Array<{ title: string; kicd_data: any[] }>; subtopicMap?: Record<string, string[]> }
}, retryNote = ''): string {
  const isCBC = curriculumMode.startsWith('cbc')
  const isMaths = subjectType === 'mathematics'

  const skillWords = substrand
    .split(/[\s\-:,\/()]+/)
    .filter(w => w.length >= 4)
    .slice(0, 3)
    .join(', ')

  // Estimate page range based on lesson position (early topics = p.1-50, later = p.50-150+)
  const topicFraction = totalLessons > 1 ? (lessonNumber - 1) / (totalLessons - 1) : 0
  const estimatedPage = Math.round(1 + topicFraction * 149)
  const estimatedPageEnd = estimatedPage + 3

  const subtopics = kicdContext?.subtopicMap?.[strand]
  const subtopicsSection = subtopics?.length
    ? `\nSYLLABUS CONTENT for this topic (distribute across ${totalLessons} lessons):\n${subtopics.join(' | ')}\n\nCover these points progressively across lessons. Lesson ${lessonNumber} should focus on points ${lessonNumber}–${Math.min(lessonNumber + 1, subtopics.length)}.\n`
    : ''

  const kicdStrand = kicdContext?.strandData
    ?.find(s => s.title.toLowerCase().includes(strand.toLowerCase().slice(0, 10)))

  const kicdSection = kicdStrand?.kicd_data?.length
    ? `
OFFICIAL KICD CONTENT FOR THIS STRAND (use as your base):
${JSON.stringify(kicdStrand.kicd_data[0], null, 2)}

Instructions:
- Use these official outcomes as your BASE for lesson ${lessonNumber} of ${totalLessons}
- Adapt the language for this specific lesson focus
- Maintain CBC competency-based approach
- Do not copy verbatim — generate lesson-specific content
`
    : ''

  const curriculumContext = isCBC
    ? `Kenya CBC Competency-Based Curriculum
       Assessment: Continuous formative (Levels 1-4)
       Approach: Learner-centered, inquiry-based
       Context: Kenyan classroom, local examples`
    : `Kenya 8-4-4 KCSE Curriculum
       Assessment: Summative exams (marks-based)
       Approach: Content mastery, exam preparation
       Context: Kenyan secondary school`

  const outcomeBlock = !isCBC ? '' : isMaths ? `
MANDATORY MATHS OUTCOME STRUCTURE:
Write EXACTLY 3 learning outcomes in THIS progression:

Outcome a) MUST start with: identify / state / define / describe / list / name / recognize / recall
Example: 'identify the steps in solving ${substrand}'

Outcome b) MUST start with: solve / calculate / apply / compute / determine / evaluate / find / work out / construct / draw / plot / measure
Example: 'solve problems involving ${substrand}'

Outcome c) MUST start with: appreciate / value / recognize the importance of / develop interest / show confidence
Example: 'appreciate the application of ${substrand} in real life situations'

WRONG — will be REJECTED:
❌ a) explain ${substrand}     (explain is level 2, not level 1)
❌ b) appreciate ${substrand}  (appreciate is level 3, not level 2)
❌ c) solve ${substrand}       (solve belongs at level 1 or 2, not level 3)
` : `
CRITICAL — TSC INSPECTION REQUIREMENT:
Write EXACTLY 3 learning outcomes in THIS progression:

Outcome a) MUST start with ONE of these LEVEL 1 words:
identify, describe, define, list, name, state,
outline, locate, observe, collect, note, read,
record, recognize, select, match, label

Outcome b) MUST start with ONE of these LEVEL 2 words:
explain, discuss, analyze, compare, examine,
classify, interpret, differentiate, investigate,
express, predict, relate, demonstrate, apply

Outcome c) MUST start with ONE of these LEVEL 3 words:
appreciate, value, evaluate, reflect, advocate,
promote, create, develop, recognize the importance of

CORRECT EXAMPLE for "${substrand}":
a) identify the key features of ${substrand} in context,
b) explain how ${substrand} is applied in communication,
c) appreciate the role of ${substrand} in effective language use.

WRONG — will be REJECTED:
❌ a) understand ${substrand}  ('understand' not allowed)
❌ a) explain ${substrand}     (explain is level 2, not level 1)
❌ b) appreciate ${substrand}  (appreciate is level 3, not level 2)
`

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
${outcomeBlock}
MANDATORY JSON FORMAT:
{
  "learning_outcomes": [
    "identify [specific knowledge from this substrand]",
    "explain [understanding of concept]",
    "appreciate [value or relevance to learner's life]"
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
    "KLB ${learningArea} ${grade} pg. ${estimatedPage}-${estimatedPageEnd}",
    "Charts showing [specific aspect of topic]",
    "Real objects: [relevant specimen or material]",
    "Digital: YouTube — [topic] explanation"
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

RESOURCES REQUIREMENT:
"learning_resources" MUST include exactly 4 items in this order:
1. The specific textbook with page range — Format: '[Publisher] [Subject] Grade [N] pg. [X]-[Y]'
   For this lesson (${lessonNumber} of ${totalLessons}): use pages around ${estimatedPage}–${estimatedPageEnd}
   Example: 'KLB ${learningArea} ${grade} pg. ${estimatedPage}–${estimatedPageEnd}'
   (Substitute correct publisher if not KLB. Use realistic consecutive page numbers.)
2. A specific chart or diagram relevant to ${substrand}
3. Real objects, specimens, or materials specific to this lesson
4. A digital resource (YouTube video, educational website) about ${substrand}

KEYWORD REQUIREMENT:
Your lesson is about: ${substrand}
You MUST use at least ONE of these exact words or their direct forms in your outcomes/experiences:
${skillWords}

Example — for 'Previewing and Predicting':
MUST include 'preview' or 'predict' somewhere ✅

${kicdSection}${subtopicsSection}
IMPORTANT:
- Exactly 3 learning outcomes: Level 1 verb → Level 2 verb → Level 3 verb
- Use ${isCBC ? 'Kenyan CBC' : 'KCSE'} terminology
- Outcomes must progress from knowledge → understanding → values
- Output VALID JSON ONLY
${retryNote}  `
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
  subjectType?: string
  kicdContext?: {
    subjectData: Record<string, any>
    strandData: Array<{ title: string; kicd_data: any[] }>
    subtopicMap?: Record<string, string[]>
  }
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

  const skillWords = context.substrand
    .split(/[\s\-:,\/()]+/)
    .filter(w => w.length >= 4)
    .slice(0, 3)
    .join(', ')

  while (attempt < MAX_RETRIES) {
    attempt++

    let retryNote = ''
    if (attempt > 1 && lastError) {
      const isMathsRetry = (context.subjectType ?? 'default') === 'mathematics'
      const progressReminder = isMathsRetry
        ? 'REMINDER: Maths outcomes — a)=identify/state/define/solve, b)=calculate/apply/compute, c)=appreciate/value'
        : 'REMINDER: outcome a)=identify/describe, b)=explain/discuss, c)=appreciate/value'
      retryNote = `
PREVIOUS ATTEMPT FAILED BECAUSE: ${lastError}
Fix this specific issue in your next response.
${lastError.includes('progress') ? progressReminder : ''}
${lastError.includes('aligned') ? `REMINDER: Must include at least one word from: ${skillWords}` : ''}
`
    }

    const prompt = buildLessonPrompt(context, retryNote)

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

    const validation = validateLesson(lesson, context.substrand, context.subjectType ?? 'default')

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
