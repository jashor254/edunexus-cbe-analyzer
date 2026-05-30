// lib/ai/ragContext.ts
// RAG (Retrieval-Augmented Generation) context builder for the Learning Compass
// Fetches all relevant student data from DB before every DeepSeek call

import { createServiceClient } from '@/utils/supabase/service'
import {
  getCurriculumConfig,
  getCurriculumPhase,
  getGradeLabel,
  type CurriculumType,
} from '@/lib/curriculum'

export interface StudentRAGContext {
  // Student profile
  studentName: string
  studentGrade: number
  studentSchool: string | null

  // Curriculum
  curriculumType: CurriculumType
  curriculumName: string
  gradingSystem: 'levels' | 'grades'
  currentPhase: 'junior' | 'senior'
  yearLevel: string         // "Grade 8" or "Year 10"
  examBoard?: string        // "Cambridge CAIE" for IGCSE

  // Performance data
  latestAssessment: {
    term: number
    year: number
    scores: Record<string, number | string>
    strongestSubjects: string[]
    strugglingSubjects: string[]
    overallLevel: string
  } | null

  // Learning history (from session state)
  masteredConcepts: string[]
  strugglingConcepts: string[]
  preferredExampleType: string
  consecutiveSuccesses: number

  // Session history
  recentMessages: {
    role: 'user' | 'assistant'
    content: string
  }[]

  // Progress over time
  previousAssessments: {
    term: number
    year: number
    overallLevel: string
  }[]
}

export async function buildStudentRAGContext(
  learnerId: string,
  sessionId: string
): Promise<StudentRAGContext> {
  const db = createServiceClient()

  const [
    studentResult,
    assessmentsResult,
    sessionStateResult,
    recentMessagesResult,
  ] = await Promise.all([

    // 1. Student profile — now includes curriculum fields
    db.from('students')
      .select('name, grade, school, curriculum_type, year_level')
      .eq('id', learnerId)
      .maybeSingle(),

    // 2. All assessments (most recent first)
    db.from('assessments')
      .select('subject_scores, grade, term, year, created_at, curriculum_type, assessment_style')
      .eq('student_id', learnerId)
      .order('created_at', { ascending: false })
      .limit(5),

    // 3. Session state (mastered/struggling concepts)
    sessionId
      ? db.from('compass_sessions')
          .select('session_state')
          .eq('id', sessionId)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // 4. Recent messages from this session
    db.from('compass_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const student      = studentResult.data
  const assessments  = assessmentsResult.data || []
  const sessionState = sessionStateResult.data?.session_state as Record<string, any> | null
  const recentMessages = (recentMessagesResult.data || []).reverse()

  // ── Curriculum resolution ─────────────────────────────────────────────────
  const curriculumType: CurriculumType =
    (student?.curriculum_type as CurriculumType) || 'cbc'
  const config      = getCurriculumConfig(curriculumType)
  const currentPhase = getCurriculumPhase(curriculumType, student?.grade || 7)
  const yearLevel   = student?.year_level ||
    (curriculumType === 'igcse' ? `Year ${student?.grade || 7}` : `Grade ${student?.grade || 7}`)

  // ── Process latest assessment ─────────────────────────────────────────────
  const latest = assessments[0]
  let latestAssessment: StudentRAGContext['latestAssessment'] = null

  if (latest?.subject_scores) {
    const scores = latest.subject_scores as Record<string, number | string>
    const entries = Object.entries(scores)

    if (curriculumType === 'igcse') {
      // IGCSE: grade strings A*-G
      const gradeToNum: Record<string, number> = {
        'A*': 9, 'A': 8, 'B': 7, 'C': 6, 'D': 5, 'E': 4, 'F': 3, 'G': 2, 'U': 1
      }
      const nums = entries.map(([, v]) => gradeToNum[String(v)] || 0)
      const avg  = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0

      const strongestSubjects = entries
        .filter(([, v]) => (gradeToNum[String(v)] || 0) >= 7)
        .map(([s]) => s)
      const strugglingSubjects = entries
        .filter(([, v]) => (gradeToNum[String(v)] || 0) <= 5)
        .map(([s]) => s)

      const overallLevel =
        avg >= 8 ? 'Grade A — Excellent' :
        avg >= 7 ? 'Grade B — Good' :
        avg >= 6 ? 'Grade C — Satisfactory' :
        avg >= 5 ? 'Grade D — Approaching' :
        'Grade E or below — Needs support'

      latestAssessment = {
        term: latest.term,
        year: latest.year,
        scores,
        strongestSubjects,
        strugglingSubjects,
        overallLevel,
      }
    } else {
      // CBC: numeric 1-4
      const numEntries = entries.filter(([, v]) => typeof v === 'number') as [string, number][]
      const strongestSubjects = numEntries
        .filter(([, score]) => score >= 3)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([subject]) => subject)

      const strugglingSubjects = numEntries
        .filter(([, score]) => score <= 2)
        .sort(([, a], [, b]) => a - b)
        .slice(0, 3)
        .map(([subject]) => subject)

      const avgScore = numEntries.length
        ? numEntries.reduce((sum, [, s]) => sum + s, 0) / numEntries.length
        : 0

      const overallLevel =
        avgScore >= 3.5 ? 'Exceeds Expectations' :
        avgScore >= 2.5 ? 'Meets Expectations' :
        avgScore >= 1.5 ? 'Approaching Expectations' :
        'Below Expectations'

      latestAssessment = {
        term: latest.term,
        year: latest.year,
        scores,
        strongestSubjects,
        strugglingSubjects,
        overallLevel,
      }
    }
  }

  // ── Session state ─────────────────────────────────────────────────────────
  const masteredConcepts: string[]  = sessionState?.masteredConcepts || []
  const strugglingConcepts: string[] = sessionState?.strugglingConcepts || []
  const preferredExampleType: string = sessionState?.preferredExampleType || 'general'
  const consecutiveSuccesses: number = sessionState?.consecutiveSuccesses || 0

  // ── Previous assessments summary ──────────────────────────────────────────
  const gradeToNum: Record<string, number> = {
    'A*': 9, 'A': 8, 'B': 7, 'C': 6, 'D': 5, 'E': 4, 'F': 3, 'G': 2, 'U': 1
  }
  const previousAssessments = assessments
    .slice(1)
    .map(a => {
      const s = a.subject_scores as Record<string, number | string>
      const vals = Object.values(s)
      let overallLevel: string

      if (curriculumType === 'igcse') {
        const nums = vals.map(v => gradeToNum[String(v)] || 0).filter(n => n > 0)
        const avg  = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
        overallLevel = avg >= 7 ? 'Grade B+' : avg >= 6 ? 'Grade C' : 'Grade D or below'
      } else {
        const numVals = vals.filter(v => typeof v === 'number') as number[]
        const avg = numVals.length ? numVals.reduce((a, b) => a + b, 0) / numVals.length : 0
        overallLevel =
          avg >= 3.5 ? 'Exceeds' :
          avg >= 2.5 ? 'Meets' :
          avg >= 1.5 ? 'Approaching' : 'Below'
      }

      return { term: a.term, year: a.year, overallLevel }
    })

  return {
    studentName:   student?.name || 'Student',
    studentGrade:  student?.grade || 7,
    studentSchool: student?.school || null,
    curriculumType,
    curriculumName: config.name,
    gradingSystem:  config.gradingSystem,
    currentPhase,
    yearLevel,
    examBoard: curriculumType === 'igcse'
      ? 'Cambridge Assessment International Education (CAIE)'
      : undefined,
    latestAssessment,
    masteredConcepts,
    strugglingConcepts,
    preferredExampleType,
    consecutiveSuccesses,
    recentMessages: recentMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    previousAssessments,
  }
}

export function buildRAGSystemPrompt(context: StudentRAGContext): string {

  const { curriculumType, yearLevel, curriculumName, gradingSystem } = context
  const isIGCSE = curriculumType === 'igcse'
  const firstName = context.studentName.split(' ')[0]

  // ── Score display ──────────────────────────────────────────────────────────
  const subjectDisplayNames: Record<string, string> = {
    mathematics:             'Mathematics',
    english:                 'English',
    kiswahili:               'Kiswahili',
    integrated_science:      'Science',
    social_studies:          'Social Studies',
    creative_arts_sports:    'Creative Arts',
    pre_technical_studies:   'Pre-Technical',
    agriculture:             'Agriculture',
    business_studies:        'Business Studies',
    geography:               'Geography',
    history:                 'History',
    biology:                 'Biology',
    chemistry:               'Chemistry',
    physics:                 'Physics',
    // IGCSE
    english_first_language:  'English First Language',
    english_second_language: 'English Second Language',
    additional_mathematics:  'Additional Mathematics',
    computer_science:        'Computer Science',
    economics:               'Economics',
    history_citizenship:     'History & Citizenship',
  }

  const cbcScoreLabels: Record<number, string> = {
    1: 'Below Expectations',
    2: 'Approaching Expectations',
    3: 'Meets Expectations',
    4: 'Exceeds Expectations',
  }

  const igcseGradeLabels: Record<string, string> = {
    'A*': 'Exceptional', 'A': 'Excellent', 'B': 'Good',
    'C': 'Satisfactory', 'D': 'Approaching', 'E': 'Borderline',
    'F': 'Below Standard', 'G': 'Minimum', 'U': 'Ungraded',
  }

  let assessmentContext = 'No assessments on record yet.'

  if (context.latestAssessment) {
    const a = context.latestAssessment

    let scoresText: string
    if (isIGCSE) {
      scoresText = Object.entries(a.scores)
        .map(([subj, grade]) => {
          const g = String(grade)
          const label = igcseGradeLabels[g] || g
          const note = g === 'C' ? ' ← minimum pass' : g === 'D' || g === 'E' ? ' ← needs improvement' : ''
          return `  ${subjectDisplayNames[subj] || subj}: ${g} (${label})${note}`
        }).join('\n')
    } else {
      scoresText = Object.entries(a.scores)
        .filter(([, v]) => typeof v === 'number')
        .map(([subj, score]) =>
          `  ${subjectDisplayNames[subj] || subj}: ${score}/4 (${cbcScoreLabels[score as number] || score})`
        ).join('\n')
    }

    const periodLabel = isIGCSE
      ? `${a.year}`
      : `Term ${a.term}, ${a.year}`

    assessmentContext = `
Latest Assessment — ${periodLabel}:
Overall: ${a.overallLevel}
Subject ${isIGCSE ? 'Grades' : 'Scores'}:
${scoresText}

Strongest subjects: ${a.strongestSubjects
  .map(s => subjectDisplayNames[s] || s)
  .join(', ') || 'None identified yet'}

Needs most support in: ${a.strugglingSubjects
  .map(s => subjectDisplayNames[s] || s)
  .join(', ') || 'None identified yet'}
`
  }

  let progressContext = ''
  if (context.previousAssessments.length > 0) {
    progressContext = `
Progress History:
${context.previousAssessments.map(p =>
  `  ${isIGCSE ? p.year : `Term ${p.term}, ${p.year}`}: ${p.overallLevel}`
).join('\n')}
`
  }

  let sessionContext = ''
  if (context.masteredConcepts.length > 0) {
    sessionContext += `\nConcepts mastered this session:\n  ${context.masteredConcepts.join(', ')}`
  }
  if (context.strugglingConcepts.length > 0) {
    sessionContext += `\nCurrently struggling with:\n  ${context.strugglingConcepts.join(', ')}`
  }
  if (context.consecutiveSuccesses > 0) {
    sessionContext += `\nConsecutive correct answers: ${context.consecutiveSuccesses}`
  }

  // ── Curriculum-specific context block ────────────────────────────────────
  const curriculumBlock = isIGCSE ? `
═══════════════════════════════
CURRICULUM CONTEXT
═══════════════════════════════
Exam Board: Cambridge CAIE
Assessment: End-of-year Cambridge exams
Grading: A* (Exceptional) → G (Minimum)
Target: Grade C or above = satisfactory pass
Ideal target: Grade B or above

IGCSE-SPECIFIC TEACHING RULES:
- Reference Cambridge syllabus structure
- Mention Paper types where relevant
  (Paper 1 = multiple choice, Paper 2 = structured questions)
- Frame difficulty as Core vs Extended
  (Extended paper = harder, needed for A*/A)
- Connect concepts to exam technique
- Use international examples; Kenyan context welcome where natural
- Encourage past paper practice mindset
` : `
═══════════════════════════════
CURRICULUM CONTEXT
═══════════════════════════════
Assessment: Continuous (formative)
Grading: Levels 1-4
Target: Level 3 (Meets Expectations)
Ideal: Level 4 (Exceeds Expectations)

CBC-SPECIFIC TEACHING RULES:
- Focus on competency development
- Rotate naturally through example types
  (universal, classroom, Kenyan — mix it up)
- Encourage real-world application
- Assessment is ongoing — every session builds their record
`

  // ── Encouragement style ───────────────────────────────────────────────────
  const encouragementBlock = isIGCSE ? `
7. Encouragement (international + warm):
   "Excellent work! Keep pushing for that A*!"
   "You're at Grade B — let's get you to A!"
   "This is exactly what Cambridge examiners look for!"
   "Great exam technique — your marker will love this!"
` : `
7. Encouragement (varied, human, not repetitive):
   "Nice thinking."
   "You're improving."
   "That step was correct."
   "You almost got it — keep going."
   "Excellent observation."
   Occasional Swahili/English mix is welcome but vary the phrases.
`

  // ── Context examples ──────────────────────────────────────────────────────
  const examplesBlock = isIGCSE ? `
6. Context guidelines:
   - Use international examples primarily
   - Kenya context welcome where natural
   - Money: KES or USD/GBP where relevant
   - Reference real-world global examples
   - Connect to Cambridge exam scenarios
   - Frame answers in exam-technique style when approaching assessment topics
` : `
6. Context guidelines:
   Rotate naturally between example types:
   - Universal: sharing, counting, dividing, patterns
   - Classroom: books, pencils, groups, tests
   - Real-world: money, food, sport, transport
   - Kenyan: KES, matatu, shamba, Nairobi — only when it genuinely helps
   Never force the same example type every response.
`

  return `
You are the Learning Compass — a personal AI tutor for EduNexus.
Always respond with valid JSON only — no markdown, no explanation, just raw JSON.

═══════════════════════════════
STUDENT PROFILE (use this always)
═══════════════════════════════
Name: ${context.studentName}
${yearLevel} (${curriculumName})
${context.studentSchool ? `School: ${context.studentSchool}` : ''}
Phase: ${context.currentPhase === 'junior' ? 'Junior / Lower Secondary' : 'Senior / Upper Secondary'}
${context.examBoard ? `Exam Board: ${context.examBoard}` : ''}

${assessmentContext}
${progressContext}
${sessionContext ? `\nThis Session:\n${sessionContext}` : ''}

Preferred example type: ${context.preferredExampleType}

${curriculumBlock}

═══════════════════════════════
HOW TO USE THIS DATA
═══════════════════════════════
1. ALWAYS address student by first name (${firstName})

2. Reference their ACTUAL performance:
   - If they struggle in a subject → be extra patient, break into smaller steps
   - If they excel in a subject → use it as a bridge to explain harder concepts
   - Example: "You're great at English — let me explain this Science concept using a story"

3. Track improvement explicitly:
   - If previousAssessments shows improvement: "You improved from [level] to [level]! Keep going!"
   - If declining: extra encouragement needed

4. Use curriculum-appropriate difficulty:
   ${isIGCSE
     ? `IGCSE ${yearLevel}
   - Grade E-G: simple chunks, lots of support
   - Grade C-D: building toward pass standard (Grade C)
   - Grade B-A: push toward Extended paper excellence
   - Grade A*: mastery-level challenges`
     : `Grade ${context.studentGrade} CBC Kenya
   - Score 1-2: simple chunks, lots of encouragement
   - Score 3-4: can handle complexity, push deeper thinking`
   }

5. NEVER give direct answers — guide with Socratic questions
   After 3 failed attempts → show worked example then new problem

${examplesBlock}
${encouragementBlock}
8. If student seems frustrated:
   Switch example type immediately, offer a brain break, reduce difficulty one level

═══════════════════════════════
RESPONSE FORMAT
═══════════════════════════════
Keep responses concise — max 150 words per field
Always end with a question or next step
Never give a monologue
Make it feel like a conversation
`
}
