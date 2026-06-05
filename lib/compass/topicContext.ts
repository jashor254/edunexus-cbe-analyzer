// lib/compass/topicContext.ts
// Unified topic context provider for Learning Compass.
// Single function ragContext.ts calls — three-tier fallback:
//   Tier 1: Teacher's published SOW → current week lessons
//   Tier 2: KICD curriculum DB → grade-level substrands
//   Tier 3: Generic CBC context string

import { createServiceClient } from '@/utils/supabase/service'

export interface CompassTopic {
  subject:    string
  strand:     string
  sub_strand: string
  week?:      number
  source:     'sow' | 'kicd' | 'generic'
}

export interface CompassTopicContext {
  topics:         CompassTopic[]
  grade:          number | null
  tier:           1 | 2 | 3
  weekNumber?:    number
  contextSummary: string
}

export async function getCompassTopicContext(
  studentId: string,
  options?: {
    subjectFilter?: string
    struggleTopic?: string
  }
): Promise<CompassTopicContext> {

  try {
    const sowCtx = await getTier1SowContext(studentId, options?.subjectFilter)
    if (sowCtx && sowCtx.topics.length > 0) {
      return buildContext(sowCtx.topics, sowCtx.grade, 1, sowCtx.weekNumber, options)
    }
  } catch {
    // fall through to Tier 2
  }

  try {
    const kicdCtx = await getTier2KicdContext(studentId, options?.subjectFilter)
    if (kicdCtx && kicdCtx.topics.length > 0) {
      return buildContext(kicdCtx.topics, kicdCtx.grade, 2, undefined, options)
    }
  } catch {
    // fall through to Tier 3
  }

  return {
    topics:         [],
    grade:          null,
    tier:           3,
    contextSummary: buildGenericContext(),
  }
}

// ─── Tier 1: Teacher SOW (JSONB lessons column) ──────────────────────────────

// Lesson shape stored in schemes_of_work.lessons JSONB (matches GeneratedLesson type)
interface SowJsonLesson {
  week:       number
  lesson:     number
  strand:     string
  substrand:  string
  // week_number / weekNumber kept as fallback for legacy saves
  week_number?: number
  weekNumber?:  number
}

async function getTier1SowContext(
  studentId:     string,
  subjectFilter?: string
): Promise<{ topics: CompassTopic[]; grade: number | null; weekNumber: number } | null> {
  const db = createServiceClient()

  const { data: student } = await db
    .from('students')
    .select('teacher_id, grade')
    .eq('id', studentId)
    .maybeSingle()

  if (!student?.teacher_id) return null

  const grade = student.grade as number | null
  const currentMonth = new Date().getMonth() + 1
  const term = currentMonth <= 4 ? 1 : currentMonth <= 8 ? 2 : 3

  // Current week within term (weeks 1–14)
  const termStartMonth = term === 1 ? 1 : term === 2 ? 5 : 9
  const termStart = new Date(new Date().getFullYear(), termStartMonth - 1, 1)
  const weekNumber = Math.min(
    Math.max(Math.floor((Date.now() - termStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1, 1),
    14
  )

  // Grade stored in SOW as "Grade 8" — match students.grade (integer 8)
  const gradeStr = grade ? `Grade ${grade}` : null

  let sowQuery = db
    .from('schemes_of_work')
    .select('id, learning_area, grade, lessons')
    .eq('teacher_id', student.teacher_id)
    .eq('term', term)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (gradeStr) sowQuery = sowQuery.eq('grade', gradeStr)
  if (subjectFilter) sowQuery = sowQuery.ilike('learning_area', `%${subjectFilter}%`)

  const { data: sows } = await sowQuery.limit(5)
  if (!sows || sows.length === 0) return null

  const topics: CompassTopic[] = []

  for (const sow of sows) {
    const allLessons = sow.lessons as SowJsonLesson[] | null
    if (!Array.isArray(allLessons) || allLessons.length === 0) continue

    const subject = (sow.learning_area as string | null) ?? 'Unknown'

    // Try exact week match first; fall back to ±1 week if nothing found
    const exactWeek = allLessons.filter(l =>
      (l.week ?? l.week_number ?? l.weekNumber) === weekNumber
    )
    const lessonsToUse = exactWeek.length > 0
      ? exactWeek
      : allLessons
          .filter(l => {
            const w = l.week ?? l.week_number ?? l.weekNumber ?? 0
            return Math.abs(w - weekNumber) === 1
          })
          .slice(0, 6)

    for (const l of lessonsToUse) {
      topics.push({
        subject,
        strand:     l.strand     ?? subject,
        sub_strand: l.substrand  ?? 'General',
        week:       weekNumber,
        source:     'sow',
      })
    }
  }

  if (topics.length === 0) return null

  return { topics, grade, weekNumber }
}

// ─── Tier 2: KICD curriculum DB ───────────────────────────────────────────────

type SowGradeRow      = { id: string }
type SowLaRow         = { id: string; name: string }
type SowStrandRow     = { id: string; title: string; learning_area_id: string }
type SowSubstrandRow  = { title: string; strand_id: string }

async function getTier2KicdContext(
  studentId:     string,
  subjectFilter?: string
): Promise<{ topics: CompassTopic[]; grade: number | null } | null> {
  const db = createServiceClient()

  const { data: student } = await db
    .from('students')
    .select('grade')
    .eq('id', studentId)
    .maybeSingle()

  const grade = student?.grade as number | null
  if (!grade) return null

  // 1. Resolve grade row IDs
  const { data: gradeRows } = await db
    .from('sow_grades')
    .select('id')
    .eq('numeric_grade', grade) as { data: SowGradeRow[] | null }

  if (!gradeRows || gradeRows.length === 0) return null
  const gradeIds = gradeRows.map(g => g.id)

  // 2. Learning areas for those grades
  let laQuery = db
    .from('sow_learning_areas')
    .select('id, name')
    .in('grade_id', gradeIds)
    .order('name')

  if (subjectFilter) {
    // 'Core Mathematics' / 'Essential Mathematics' must match exactly — ilike would catch both
    const isExactMathName = subjectFilter === 'Core Mathematics' || subjectFilter === 'Essential Mathematics'
    if (isExactMathName) {
      laQuery = laQuery.ilike('name', subjectFilter)
    } else {
      laQuery = laQuery.ilike('name', `%${subjectFilter}%`)
    }
  }

  const { data: learningAreas } = await laQuery as { data: SowLaRow[] | null }
  if (!learningAreas || learningAreas.length === 0) return null

  const laIds = learningAreas.map(la => la.id)
  const laNameMap: Record<string, string> = {}
  for (const la of learningAreas) laNameMap[la.id] = la.name

  // 3. Strands for those learning areas
  const { data: strands } = await db
    .from('sow_strands')
    .select('id, title, learning_area_id')
    .in('learning_area_id', laIds)
    .order('order_index') as { data: SowStrandRow[] | null }

  if (!strands || strands.length === 0) return null

  const strandIds = strands.map(s => s.id)
  const strandMap: Record<string, SowStrandRow> = {}
  for (const s of strands) strandMap[s.id] = s

  // 4. Substrands for those strands (cap at 120 to keep prompt manageable)
  const { data: substrands } = await db
    .from('sow_substrands')
    .select('title, strand_id')
    .in('strand_id', strandIds)
    .order('order_index')
    .limit(120) as { data: SowSubstrandRow[] | null }

  if (!substrands || substrands.length === 0) return null

  const topics: CompassTopic[] = substrands.map(ss => {
    const strand = strandMap[ss.strand_id]
    const laName = strand ? (laNameMap[strand.learning_area_id] ?? 'Unknown') : 'Unknown'
    return {
      subject:    laName,
      strand:     strand?.title ?? '',
      sub_strand: ss.title,
      source:     'kicd' as const,
    }
  })

  return { topics, grade }
}

// ─── Context string builder ────────────────────────────────────────────────────

function buildContext(
  topics:      CompassTopic[],
  grade:       number | null,
  tier:        1 | 2 | 3,
  weekNumber?: number,
  options?:    { struggleTopic?: string }
): CompassTopicContext {

  const gradeLabel = grade ? `Grade ${grade}` : ''

  // Group substrands by subject for a compact, readable prompt block
  const bySubject: Record<string, string[]> = {}
  for (const t of topics) {
    if (!bySubject[t.subject]) bySubject[t.subject] = []
    bySubject[t.subject].push(t.sub_strand)
  }

  let summary = ''

  if (tier === 1 && weekNumber) {
    summary += `CURRENT WEEK (Week ${weekNumber}) TOPICS:\n`
    summary += `The student's teacher has assigned these topics this week:\n`
  } else if (tier === 2) {
    summary += `${gradeLabel} CBC CURRICULUM TOPICS:\n`
    summary += `These are the topics for this student's grade level:\n`
  }

  for (const [subject, substrands] of Object.entries(bySubject)) {
    summary += `\n${subject}:\n`
    substrands.slice(0, 8).forEach(s => { summary += `  • ${s}\n` })
    if (substrands.length > 8) {
      summary += `  ... and ${substrands.length - 8} more topics\n`
    }
  }

  if (options?.struggleTopic) {
    summary += `\nSTUDENT SELECTED STRUGGLE AREA:\n`
    summary += `"${options.struggleTopic}"\n`
    summary += `Address this topic first. Ask what specifically confuses them `
    summary += `before explaining. Use CBC Level 3 language — clear, practical, `
    summary += `Kenya-context examples.\n`
  }

  summary += `\nIMPORTANT: Reference exact topic names the student recognises `
  summary += `from their textbook/class. Avoid generic explanations — anchor `
  summary += `every response to the specific sub-strand named above.`

  return { topics, grade, tier, weekNumber, contextSummary: summary }
}

function buildGenericContext(): string {
  return (
    `You are a CBC-aligned learning assistant for Kenyan Junior School students ` +
    `(Grade 7–9). Focus on CBC competencies: communication, critical thinking, ` +
    `creativity, and citizenship. Use Kenya-relevant examples. Respond in English ` +
    `or Swahili as the student prefers.`
  )
}
