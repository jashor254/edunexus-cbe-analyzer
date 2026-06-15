// lib/sow/aiLessonGenerator.ts
// Generates and validates one lesson at a time via DeepSeek AI.
// Diversity at 5 levels is enforced by injecting DiversitySeed per call.

import { validateLesson } from './validators'
import type { CurriculumMode } from './types'
import type { DiversitySeed } from './diversityEngine'

const MAX_RETRIES   = 5
const MAX_CONFIDENCE = 0.92
const TEMPERATURE   = 0.65  // raised from 0.2 — low temp was the primary driver of repetition

// ─── Diversity system instruction ─────────────────────────────────────────────
// Injected into the SYSTEM role so it primes the model's full behavior.

const DIVERSITY_SYSTEM_RULES = `You are a Kenya curriculum expert producing ONE lesson for a Scheme of Work.
Return ONLY valid JSON. No markdown. No explanation. No code blocks. Pure JSON only.

DIVERSITY RULES — NON-NEGOTIABLE:

RULE 1 — VERB DIVERSITY
Never use the same opening verb in consecutive lessons.
Level 1 alternatives: classify, locate, select, match, recall, name, label, record,
  collect, observe, count, trace, outline, give, read, sort, copy, mark, find, show,
  detect, measure, sketch, note, draw, examine, list, describe, identify, state
Level 2 alternatives: analyze, compare, contrast, apply, calculate, construct, convert,
  deduce, determine, differentiate, discuss, estimate, experiment, formulate, illustrate,
  infer, interpret, investigate, justify, measure, model, predict, relate, research,
  review, sequence, simulate, solve, summarize, test, verify, explain, demonstrate
Level 3 alternatives: advocate, assess, collaborate, compose, create, critique, design,
  develop, evaluate, generalize, implement, integrate, organize, plan, produce, promote,
  propose, protect, reflect, synthesize, validate, value, defend, generate, appreciate

RULE 2 — OUTCOME STRUCTURE DIVERSITY
Use a DIFFERENT sentence structure for each learning outcome.
Never write all three outcomes with the same shape.
Rotate through: Action+Object, Action+How, Action+Comparison, Action+Purpose,
  Action+Condition, Action+Audience, Action+Standard, Value/Attitude

RULE 3 — INQUIRY QUESTION DIVERSITY
Use DIFFERENT question starters each lesson.
Never use "What would happen if..." or "Why is..." in more than 1 of every 4 lessons.
Rotate: Causal, Comparative, Evaluative, Hypothetical, Personal, Predictive,
  Investigative, Critical, Connective, Application, Open

RULE 4 — LEARNING EXPERIENCE DIVERSITY
Never start more than 1 in 3 consecutive experiences with "Learners work in groups to observe and..."
ALL activities MUST happen INSIDE the classroom. No field trips, no external visitors,
  no going to other locations. No inviting community members to class.
Rotate activity structures: Demonstration, Problem-solving, Case study, Simulation,
  Gallery walk, Debate, Jigsaw, Role play, Think-Pair-Share, Question and Answer,
  Discussion, Brainstorming, Sorting, Peer teaching

LENGTH RULE — NON-NEGOTIABLE:
Each learning experience = ONE sentence only. Maximum 20 words.
Plain sentence only — NO activity-type labels or prefixes.
WRONG: "Think-Pair-Share: Learners identify conflict triggers from a Kisumu boundary dispute."
RIGHT: "Learners identify conflict triggers from a boundary dispute case study in Kisumu."

MAP RULE — NON-NEGOTIABLE:
Never reference a specific city map a teacher cannot access (e.g. "map of Kisumu", "Nairobi map", "map of Mombasa").
Use generic terms only: "a sample topographical map", "a printed map", "a hand-drawn map", "a blackboard sketch map".

RULE 5 — ASSESSMENT DIVERSITY
Never use the same 3 assessments in consecutive lessons.
Use: observation checklist, oral questioning, written exercise, practical demonstration,
  peer assessment, self-assessment, exit ticket, product assessment, portfolio entry,
  quiz, reflection journal, debate assessment.

KENYAN CONTEXT RULE:
Every learning experience MUST reference at least one specific Kenyan location, crop,
community, or practice — but as classroom DISCUSSION EXAMPLES only, never as physical visits.
Correct: "Learners discuss how maize farmers in the Rift Valley manage soil erosion"
Correct: "Learners analyse trade practices at Gikomba market using case study cards"
WRONG:   "Learners visit Gikomba market" / "Invite a local elder to class"

RESOURCE RULE — NON-NEGOTIABLE:
Output EXACTLY 3 resources. No more, no fewer.
Format: clean name only — no page numbers, no descriptions, no dashes, no extra text.
1. "[Textbook name]"
2. "Teacher's Guide for [Subject] [Grade]"
3. "[One classroom item: chart / blackboard diagram / newspaper cutout / real object]"
NEVER: page numbers, "pp.", descriptions after the name, community resource persons,
  farm visits, radio recordings, government maps, purchased materials, internet resources.`

// ─── DeepSeek API call ───────────────────────────────────────────────────────

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
        { role: 'system', content: DIVERSITY_SYSTEM_RULES },
        { role: 'user',   content: prompt },
      ],
      temperature: TEMPERATURE,
      max_tokens: 1200,
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
  previousVerbs,
  diversitySeed,
  kicdContext,
  textbook,
}: {
  learningArea:   string
  grade:          string
  strand:         string
  substrand:      string
  lessonNumber:   number
  totalLessons:   number
  curriculumMode: CurriculumMode
  subjectType?:   string
  previousVerbs?: string[]
  diversitySeed?: DiversitySeed
  textbook?:      string
  kicdContext?: {
    subjectData:  Record<string, Record<string, unknown>>
    strandData:   Array<{ title: string; kicd_data: Record<string, unknown>[] }>
    subtopicMap?: Record<string, string[]>
  }
}, retryNote = ''): string {

  const isCBC   = curriculumMode.startsWith('cbc')
  const isMaths = subjectType === 'mathematics' || subjectType === 'cbc_senior_mathematics' || subjectType === 'kcse_mathematics'


  // KICD context sections
  const subtopics = kicdContext?.subtopicMap?.[strand]
  const subtopicsSection = subtopics?.length
    ? `\nSYLLABUS CONTENT (distribute across ${totalLessons} lessons):\n${subtopics.join(' | ')}\nLesson ${lessonNumber} covers points ${lessonNumber}–${Math.min(lessonNumber + 1, subtopics.length)}.\n`
    : ''

  const kicdStrand = kicdContext?.strandData
    ?.find(s => s.title.toLowerCase().includes(strand.toLowerCase().slice(0, 10)))
  const kicdSection = kicdStrand?.kicd_data?.length
    ? `\nOFFICIAL KICD CONTENT (use as base, adapt language):\n${JSON.stringify(kicdStrand.kicd_data[0], null, 2)}\n`
    : ''

  // Curriculum-mode descriptors
  const curriculumContext = isCBC
    ? 'Kenya CBC — Competency-Based, learner-centered, inquiry-driven, no marks/exams, real Kenyan examples'
    : 'Kenya 8-4-4 KCSE — Content mastery, exam-oriented, past-paper style questions, KCSE marking awareness'

  // ── Outcome instructions ────────────────────────────────────────────────────
  // Use seed verbs when available; fall back to broad verb groups.
  const seed = diversitySeed

  const verbAvoidLine = previousVerbs && previousVerbs.length > 0
    ? `VERBS ALREADY USED — do NOT start any outcome with: ${previousVerbs.slice(-15).join(', ')}`
    : 'First lesson — choose freely, but avoid starting all outcomes with the same verb.'

  let outcomeBlock: string

  if (isMaths) {
    const l1 = seed?.outcomePattern.l1 ?? 'identify'
    const l2 = seed?.outcomePattern.l2 ?? 'calculate'
    const l3 = seed?.outcomePattern.l3 ?? 'appreciate'
    outcomeBlock = `
LEARNING OUTCOMES — MATHEMATICS:
Write EXACTLY 3 outcomes in this cognitive progression:
a) LEVEL 1 (knowledge/recall) — start with: "${l1}" or any equivalent Level 1 maths verb
   e.g. "${l1} the properties of ${substrand}"
b) LEVEL 2 (computation/application) — start with: "${l2}" or any equivalent Level 2 maths verb
   e.g. "${l2} problems involving ${substrand}"
c) LEVEL 3 (real-life value) — start with: "${l3}" or any equivalent Level 3 verb
   e.g. "${l3} the use of ${substrand} in everyday Kenyan contexts"

Sentence structure for this lesson: ${seed?.outcomePattern.structure ?? 'A'} — use structure variety across the three outcomes.
${verbAvoidLine}
`
  } else if (isCBC) {
    const l1 = seed?.outcomePattern.l1 ?? 'describe'
    const l2 = seed?.outcomePattern.l2 ?? 'analyze'
    const l3 = seed?.outcomePattern.l3 ?? 'reflect on'
    outcomeBlock = `
LEARNING OUTCOMES — CBC:
Write EXACTLY 3 outcomes in this cognitive progression:
a) LEVEL 1 (knowledge/observation) — start with: "${l1}" or any equivalent Level 1 verb
   e.g. "${l1} the [key aspect] of ${substrand} in a Kenyan context"
b) LEVEL 2 (understanding/application) — start with: "${l2}" or any equivalent Level 2 verb
   e.g. "${l2} how ${substrand} is applied in [real Kenyan situation]"
c) LEVEL 3 (values/advocacy) — start with: "${l3}" or any equivalent Level 3 verb
   e.g. "${l3} the importance of ${substrand} in [community or national context]"

Sentence structure for this lesson: ${seed?.outcomePattern.structure ?? 'A'} — vary structure across the three outcomes.
${verbAvoidLine}
`
  } else {
    // 8-4-4
    const l1 = seed?.outcomePattern.l1 ?? 'state'
    const l2 = seed?.outcomePattern.l2 ?? 'explain'
    const l3 = seed?.outcomePattern.l3 ?? 'evaluate'
    outcomeBlock = `
LEARNING OUTCOMES — 8-4-4 KCSE:
Write EXACTLY 3 specific objectives in this progression:
a) KNOWLEDGE — start with: "${l1}" or any equivalent recall verb
   e.g. "${l1} the [key fact] about ${substrand}"
b) COMPREHENSION/APPLICATION — start with: "${l2}" or any equivalent application verb
   e.g. "${l2} how ${substrand} applies to [KCSE exam context]"
c) EVALUATION/ATTITUDE — start with: "${l3}" or any equivalent higher-order verb
   e.g. "${l3} the significance of ${substrand} in [Kenyan context]"

${verbAvoidLine}
`
  }

  // ── Experience instruction ──────────────────────────────────────────────────
  const classroomRule = `IMPORTANT: All activities happen INSIDE the classroom only.
No field trips, no external visitors, no going to other locations.
Use only: discussion, role play, think-pair-share, gallery walk, case study, group work, Q&A, debate, demonstration.
LENGTH RULE — NON-NEGOTIABLE: Each learning experience = ONE plain sentence only. Maximum 20 words.
No activity-type labels or prefixes (no "Think-Pair-Share:", "Demonstration:", "Pair practice:", etc.).
BAD: "Think-Pair-Share: Learners identify conflict triggers from a Kisumu boundary dispute."
GOOD: "Learners identify conflict triggers from a boundary dispute case study in Kisumu."
MAP RULE: Never name a specific city map. Use "a sample topographical map", "a printed map", or "a blackboard sketch map" only.
Kenyan contexts appear as discussion examples only — not as places the class physically visits.`

  const experienceInstruction = seed
    ? `LEARNING EXPERIENCE FRAMEWORK — ${seed.framework.label}: ${seed.framework.name}
${seed.framework.template}
Replace [topic], [location], [context] with specifics from: ${substrand}, ${strand}, ${learningArea}
${classroomRule}`
    : `Design 3 varied classroom activities.
${classroomRule}`

  // ── Inquiry question instruction ────────────────────────────────────────────
  const questionInstruction = seed
    ? `INQUIRY QUESTIONS — ${seed.questionFrame.name} frame:
Use THESE specific starters (adapt to topic):
  Q1 starter: "${seed.questionFrame.starters[0]}"
  Q2 starter: "${seed.questionFrame.starters[1]}"
  Q3 starter: "${seed.questionFrame.starters[2]}"`
    : `Write 3 inquiry questions using DIFFERENT starters. Rotate: Why / How / What if / In what ways / Which / How might / Where / Can you...`

  // ── Assessment instruction ──────────────────────────────────────────────────
  const assessmentInstruction = seed
    ? `ASSESSMENT — use EXACTLY these three methods (no substitution):
  "${seed.assessmentMethods[0]}"
  "${seed.assessmentMethods[1]}"
  "${seed.assessmentMethods[2]}"`
    : `Choose 3 DIFFERENT assessment methods. Rotate from: observation checklist, oral questions, written exercise, practical demo, peer assessment, self-assessment, exit ticket, portfolio entry, quiz, reflection.`

  // ── Values and competencies ─────────────────────────────────────────────────
  const valuesStr       = seed?.values           ?? 'Respect, Responsibility, Unity'
  const competenciesStr = seed?.coreCompetencies ?? (isCBC ? 'Communication, Critical thinking, Collaboration' : 'Problem solving, Critical thinking')

  // ── Dynamic JSON example — NEVER hardcode identify/explain/appreciate ───────
  const l1ex = seed?.outcomePattern.l1 ?? 'describe'
  const l2ex = seed?.outcomePattern.l2 ?? 'investigate'
  const l3ex = seed?.outcomePattern.l3 ?? 'reflect on'

  const experienceEx = seed
    ? [
        `${seed.framework.name}: [specific activity referencing ${substrand} in Kenyan context]`,
        '[second distinct activity — different structure from first]',
        '[third activity — individual, pair, or group work]',
      ]
    : [
        'Learners [activity 1 referencing specific local context]',
        'Learners [activity 2 — different mode from activity 1]',
        'Learners [activity 3 — individual task to consolidate]',
      ]

  return `CURRICULUM: ${curriculumContext}

LESSON DETAILS:
Subject: ${learningArea}
${isCBC ? 'Grade' : 'Form'}: ${grade}
Strand/Topic: ${strand}
Substrand/Subtopic: ${substrand}
Lesson: ${lessonNumber} of ${totalLessons}

${outcomeBlock}

${experienceInstruction}

${questionInstruction}

${assessmentInstruction}

RESOURCES — EXACTLY 3 ITEMS, CLEAN NAMES ONLY:
1. "${textbook || `${learningArea} ${isCBC ? 'Grade' : 'Form'} ${grade} Textbook`}"
2. "Teacher's Guide for ${learningArea} ${isCBC ? 'Grade' : 'Form'} ${grade}"
3. "[One classroom item: chart / blackboard diagram / newspaper cutout / real object]"
No page numbers. No descriptions. No dashes after the name. Clean names only.
NEVER: community resource persons, farm visits, radio recordings, government maps, purchased materials.

KEYWORD REQUIREMENT:
Your lesson is about: ${substrand}
Use at least ONE word from this set somewhere in outcomes or experiences:
${substrand.split(/[\s\-:,\/()]+/).filter(w => w.length >= 4).slice(0, 3).join(', ')}

${kicdSection}${subtopicsSection}
${seed?.contextBlock ? `\nPER-LESSON DIVERSITY CONTEXT:\n${seed.contextBlock}` : ''}

OUTPUT — Return ONLY this JSON structure:
{
  "learning_outcomes": [
    "${l1ex} [specific knowledge about ${substrand} using Kenyan context]",
    "${l2ex} how ${substrand} [applies or functions in real situation]",
    "${l3ex} the significance of ${substrand} in [Kenyan community or national context]"
  ],
  "learning_experiences": [
    "${experienceEx[0]}",
    "${experienceEx[1]}",
    "${experienceEx[2]}"
  ],
  "key_inquiry_questions": [
    "[question using first starter from the frame above]",
    "[question using second starter from the frame above]",
    "[question using third starter from the frame above]"
  ],
  "assessment_methods": [
    "${seed?.assessmentMethods[0] ?? 'Observation checklist for [skill]'}",
    "${seed?.assessmentMethods[1] ?? 'Oral questioning using higher-order prompts'}",
    "${seed?.assessmentMethods[2] ?? 'Written exercise: [specific task]'}"
  ],
  "learning_resources": [
    "${textbook || `${learningArea} ${isCBC ? 'Grade' : 'Form'} ${grade} Textbook`}",
    "Teacher's Guide for ${learningArea} ${isCBC ? 'Grade' : 'Form'} ${grade}",
    "[chart / blackboard diagram / newspaper cutout / real object]"
  ],
  "core_competencies": "${competenciesStr}",
  "values": "${valuesStr}",
  "pci_links": "${isCBC ? 'Health Education, Citizenship, Life Skills' : 'Guidance and Counselling, Life Skills'}"
}

IMPORTANT:
- 3 learning outcomes: Level 1 → Level 2 → Level 3 cognitive order
- Use ${isCBC ? 'CBC Kenya' : 'KCSE 8-4-4 Kenya'} terminology throughout
- All examples must reference real Kenyan places, crops, practices, or communities
- Output VALID JSON ONLY — no extra text
${retryNote}`
}

// ─── Context interface ────────────────────────────────────────────────────────

export interface LessonGenerationContext {
  learningArea:   string
  grade:          string
  strand:         string
  substrand:      string
  lessonNumber:   number
  totalLessons:   number
  curriculumMode: CurriculumMode
  subjectType?:   string
  previousVerbs?: string[]
  diversitySeed?: DiversitySeed
  textbook?:      string
  kicdContext?: {
    subjectData:  Record<string, Record<string, unknown>>
    strandData:   Array<{ title: string; kicd_data: Record<string, unknown>[] }>
    subtopicMap?: Record<string, string[]>
  }
}

export interface ValidatedLessonResult {
  learning_outcomes?:      string[]
  learning_experiences?:   string[]
  key_inquiry_questions?:  string[]
  assessment_methods?:     string[]
  learning_resources?:     string[]
  core_competencies?:      string
  values?:                 string
  pci_links?:              string
  _validated:  boolean
  _confidence: number
  _source:     string
  error?:      string
  details?:    string
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateValidatedLesson(
  context: LessonGenerationContext
): Promise<ValidatedLessonResult> {
  let attempt   = 0
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
      const isMathsRetry = (context.subjectType ?? '').includes('mathematics')
      retryNote = `
PREVIOUS ATTEMPT FAILED: ${lastError}
Fix this specific issue in your next response.
${lastError.includes('progress') ? `REMINDER: outcomes must go Level 1 → Level 2 → Level 3 cognitive order` : ''}
${lastError.includes('aligned')  ? `REMINDER: must include at least one word from: ${skillWords}` : ''}
${isMathsRetry && lastError.includes('progress') ? 'MATHS REMINDER: a)=recall/identify, b)=calculate/apply, c)=appreciate/value' : ''}
`
    }

    const prompt = buildLessonPrompt({ ...context }, retryNote)

    let aiResponse: string
    try {
      aiResponse = await callDeepSeek(prompt)
    } catch (err: unknown) {
      lastError = `AI request failed: ${err instanceof Error ? err.message : String(err)}`
      continue
    }

    let lesson: Record<string, any>
    try {
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
        _validated:  true,
        _confidence: Math.min(0.85 + attempt * 0.03, MAX_CONFIDENCE),
        _source:     'deepseek_sow_generator',
      }
    }

    lastError = validation.issues.join('; ')
  }

  return {
    error:       'Lesson failed validation',
    details:     lastError || 'Unknown error',
    _validated:  false,
    _confidence: 0,
    _source:     'deepseek_sow_generator',
  }
}
