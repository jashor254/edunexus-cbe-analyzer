// scripts/reference-school/09-seed-demo-content.ts
//
// Gives the Reference School the teaching content and learner evidence the
// product screens actually need in order to show something.
//
// The fixture seeded by 01–08 is structurally complete — school, classes,
// staff, 407 learners, Blueprint action items — but carries no marks and no
// teacher documents. Every screen therefore renders an honest empty state
// ("No schemes found", "Create your first Scheme of Work") or, for Blueprint
// and Career Intelligence, withholds output because there is no evidence to
// reason from. That is correct behaviour and a useless demonstration.
//
// This seed adds, for one teacher and one class only:
//   1. A Term 2 scheme of work with real CBC Grade 10 Mathematics strands,
//      plus lesson plans and a record of work drawn from the same scheme —
//      so Scheme → Lesson Plans → Record of Work reads as one connected flow.
//   2. One CAT with marks for the whole class, saved through the canonical
//      gradebook path so it produces real Evidence, a real Projection, and
//      therefore real Blueprint and Career Intelligence output.
//
// Everything written here is synthetic and belongs to Mwatate Ridge Senior
// School. No real learner, teacher or school is touched.
//
// Idempotent: re-running finds the existing scheme by its marker and skips,
// rather than stacking duplicates.
//
// Run: npx tsx --env-file=.env.local scripts/reference-school/09-seed-demo-content.ts

if (process.env.NODE_ENV === 'production') {
  throw new Error('[demo-content] refusing to run with NODE_ENV=production — reference-school fixture only.')
}

import { createServiceClient } from '@/utils/supabase/service'
import { createAssessment, bulkSaveMarks } from '@/lib/assessments/mutations'
import { recordAssessmentEvidence } from '@/lib/assessments/evidence'

const SCHOOL_NAME = 'Mwatate Ridge Senior School'
const TERM = 2
const YEAR = 2026
const LEARNING_AREA = 'Mathematics'
const GRADE_LABEL = 'Grade 10'
const SCHEME_MARKER = 'Reference-school demo scheme'

const db = createServiceClient()

// Real CBC Senior Mathematics strands/sub-strands, one row per lesson.
const STRANDS: Array<{ strand: string; substrands: string[] }> = [
  { strand: 'Numbers', substrands: ['Real Numbers', 'Indices and Logarithms', 'Surds'] },
  { strand: 'Algebra', substrands: ['Quadratic Expressions', 'Quadratic Equations', 'Inequalities'] },
  { strand: 'Measurement', substrands: ['Area of a Triangle', 'Area of Part of a Circle', 'Surface Area of Solids'] },
  { strand: 'Geometry', substrands: ['Coordinate Geometry', 'Trigonometric Ratios', 'Circle Theorems'] },
]

const LESSONS_PER_WEEK = 4
const TOTAL_WEEKS = 12

const LESSON_FOCUS = ['Introduction and definitions', 'Worked examples', 'Applied problems', 'Consolidation and review']

/** A full term: 12 weeks × 4 lessons, cycling the strands in curriculum order. */
function buildLessons() {
  const flat = STRANDS.flatMap(({ strand, substrands }) => substrands.map(substrand => ({ strand, substrand })))
  const lessons: Array<Record<string, unknown>> = []

  for (let i = 0; i < TOTAL_WEEKS * LESSONS_PER_WEEK; i++) {
    const { strand, substrand } = flat[Math.floor(i / LESSONS_PER_WEEK) % flat.length]
    const focus = LESSON_FOCUS[i % LESSONS_PER_WEEK]
    lessons.push({
      week: Math.floor(i / LESSONS_PER_WEEK) + 1,
      lesson: i + 1,
      strand,
      substrand,
      lessonFocus: focus,
      learningOutcomes: [
        `Identify the key properties of ${substrand.toLowerCase()}`,
        `Apply ${substrand.toLowerCase()} to solve problems in real-life contexts`,
      ],
      keyInquiryQuestions: [`Where do we meet ${substrand.toLowerCase()} in everyday life?`],
      learningResources: ['KLB Secondary Mathematics Form 4', 'Geometrical instruments', 'Manila charts'],
      confidence: 0.9,
    })
  }
  return lessons
}

async function seedTeachingDocuments(teacher: { id: string; user_id: string; full_name: string }) {
  const { data: existing } = await db
    .from('schemes_of_work')
    .select('id')
    .eq('teacher_id', teacher.id)
    .eq('learning_area', LEARNING_AREA)
    .eq('term', TERM)
    .eq('year', YEAR)
    .maybeSingle()

  if (existing) {
    console.log(`  scheme already present (${existing.id}) — skipping documents`)
    return existing.id as string
  }

  const lessons = buildLessons()

  const { data: scheme, error: schemeErr } = await db
    .from('schemes_of_work')
    .insert({
      teacher_id: teacher.id,
      curriculum_mode: 'cbc_senior',
      school: SCHOOL_NAME,
      grade: GRADE_LABEL,
      learning_area: LEARNING_AREA,
      term: TERM,
      year: YEAR,
      lessons_per_week: LESSONS_PER_WEEK,
      total_weeks: TOTAL_WEEKS,
      total_lessons: lessons.length,
      average_confidence: 0.9,
      status: 'active',
      teacher_name: teacher.full_name,
      lessons,
      textbook: 'KLB Secondary Mathematics',
    })
    .select('id')
    .single()
  if (schemeErr) throw new Error(`scheme insert: ${schemeErr.message} (${SCHEME_MARKER})`)

  const schemeId = scheme.id as string
  console.log(`  scheme of work: ${lessons.length} lessons across 12 weeks`)

  // Lesson plans for the first six lessons — the "planned" half of the flow.
  // lesson_plans.teacher_id and records_of_work.teacher_id both store
  // auth.users.id, not teachers.id — see supabase/migrations/20260530_sow_tables.sql.
  const plans = lessons.slice(0, 6).map(l => ({
    sow_id: schemeId,
    teacher_id: teacher.user_id,
    week_number: l.week as number,
    lesson_number: l.lesson as number,
    strand: l.strand as string,
    sub_strand: l.substrand as string,
    learning_outcomes: l.learningOutcomes as string[],
    key_inquiry_questions: l.keyInquiryQuestions as string[],
    learning_resources: l.learningResources as string[],
    organisation_of_learning: 'Whole class, then pairs for guided practice.',
    introduction: `Review the previous lesson and connect it to ${String(l.substrand).toLowerCase()}.`,
    step_1: 'Teacher models one worked example on the board.',
    step_2: 'Learners attempt a parallel example in pairs.',
    step_3: 'Selected pairs present their working; class critiques the method.',
    conclusion: 'Learners summarise the rule in their own words.',
    extended_activities: 'Three problems from the course book for home practice.',
    status: 'generated',
  }))

  const { error: planErr } = await db.from('lesson_plans').insert(plans)
  if (planErr) throw new Error(`lesson plans insert: ${planErr.message}`)
  console.log(`  lesson plans: ${plans.length}`)

  // Record of work for the four lessons already taught — the "delivered" half.
  const { data: row, error: rowErr } = await db
    .from('records_of_work')
    .insert({
      // records_of_work.teacher_id keys off teachers.id, unlike lesson_plans
      // above which keys off auth.users.id. Verified against the live schema.
      teacher_id: teacher.id,
      scheme_id: schemeId,
      school: SCHOOL_NAME,
      grade: GRADE_LABEL,
      learning_area: LEARNING_AREA,
      term: TERM,
      year: YEAR,
      curriculum_mode: 'cbc_senior',
      teacher_name: teacher.full_name,
    })
    .select('id')
    .single()
  if (rowErr) throw new Error(`record of work insert: ${rowErr.message}`)

  const taughtFrom = new Date(YEAR, 4, 5) // early May, inside Term 2
  const entries = lessons.slice(0, 4).map((l, i) => {
    const date = new Date(taughtFrom)
    date.setDate(date.getDate() + i * 2)
    return {
      row_id: row.id as string,
      week: l.week as number,
      lesson: l.lesson as number,
      date_taught: date.toISOString().slice(0, 10),
      strand: l.strand as string,
      substrand: l.substrand as string,
      learning_outcomes: l.learningOutcomes as string[],
      key_inquiry_questions: l.keyInquiryQuestions as string[],
      learning_resources: l.learningResources as string[],
      activities_summary: 'Worked examples, paired practice, class critique of methods.',
      status: 'taught',
      remarks: i === 3
        ? 'Most learners confident; a small group still needs support with factorising.'
        : 'Lesson delivered as planned.',
    }
  })

  const { error: entryErr } = await db.from('row_entries').insert(entries)
  if (entryErr) throw new Error(`row entries insert: ${entryErr.message}`)
  console.log(`  record of work: ${entries.length} entries taught`)

  return schemeId
}

// Grade 10 senior subjects, with a deliberate spread so the resulting
// Blueprint and Career Intelligence have real contour rather than a flat line.
const SUBJECT_PROFILE: Record<string, [number, number]> = {
  mathematics:         [58, 82],
  english:             [62, 88],
  kiswahili:           [55, 84],
  physics:             [48, 76],
  chemistry:           [50, 78],
  biology:             [56, 86],
  geography:           [60, 88],
  business_studies:    [58, 85],
  history_citizenship: [61, 90],
}

function scoreFor(subject: string, seed: number): number {
  const [min, max] = SUBJECT_PROFILE[subject]
  // Deterministic per learner+subject so re-running produces the same marks.
  const spread = max - min
  const pseudo = Math.abs(Math.sin(seed * 12.9898 + subject.length * 78.233)) % 1
  return Math.round(min + pseudo * spread)
}

async function seedAssessment(teacherId: string, classId: string) {
  const subjects = Object.keys(SUBJECT_PROFILE)

  const { data: existing } = await db
    .from('class_assessments')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('title', 'Term 2 CAT 1')
    .maybeSingle()

  if (existing) {
    console.log(`  assessment already present (${existing.id}) — re-emitting evidence only`)
    await recordAssessmentEvidence(existing.id as string, teacherId, '')
    return
  }

  const { data: roster } = await db
    .from('class_students')
    .select('student_id')
    .eq('class_id', classId)

  const studentIds = (roster ?? []).map(r => r.student_id as string)
  const { data: students } = await db
    .from('students')
    .select('id, name')
    .in('id', studentIds)

  const assessment = await createAssessment(teacherId, classId, {
    title: 'Term 2 CAT 1',
    assessmentType: 'cat',
    term: String(TERM),
    year: YEAR,
    maxScore: 100,
    subjects,
    curriculumType: 'cbc',
  })

  const marks = (students ?? []).map((s, i) => ({
    studentName: s.name as string,
    subjectScores: Object.fromEntries(subjects.map(sub => [sub, scoreFor(sub, i + 1)])),
  }))

  const saved = await bulkSaveMarks(assessment.id, classId, teacherId, marks, 'cbc', 100)

  // Count the links from the table rather than the returned rows: LearnerMark
  // does not declare student_id, and this is the number that decides whether
  // any Evidence gets produced at all.
  const { count: linked } = await db
    .from('learner_marks')
    .select('id', { count: 'exact', head: true })
    .eq('assessment_id', assessment.id)
    .not('student_id', 'is', null)
  console.log(`  assessment: ${saved.length} learners marked, ${linked} linked to a learner record`)

  const { data: teacher } = await db.from('teachers').select('user_id').eq('id', teacherId).maybeSingle()
  await recordAssessmentEvidence(assessment.id, teacherId, teacher!.user_id as string)

  const { count } = await db
    .from('learner_evidence')
    .select('id', { count: 'exact', head: true })
    .in('learner_id', studentIds)
  console.log(`  evidence rows for this class: ${count}`)
}

async function main() {
  const { data: school } = await db
    .from('schools').select('id').eq('school_name', SCHOOL_NAME).maybeSingle()
  if (!school) throw new Error(`[demo-content] ${SCHOOL_NAME} not found — run the reference-school seed first.`)

  // The class teacher of a real reference-school class, via the legacy bridge
  // the teacher-facing pages read from.
  const { data: cls } = await db
    .from('teacher_classes')
    .select('id, name, teacher_id')
    .eq('name', 'Grade 10 Central')
    .maybeSingle()
  if (!cls) throw new Error('[demo-content] legacy class "Grade 10 Central" not found — run 06-seed-legacy-bridge.')

  const { data: teacher } = await db
    .from('teachers')
    .select('id, user_id, full_name, school')
    .eq('id', cls.teacher_id as string)
    .maybeSingle()
  if (!teacher || teacher.school !== SCHOOL_NAME) {
    throw new Error('[demo-content] class teacher is not a reference-school teacher — refusing to seed.')
  }

  console.log(`Seeding demo content for ${teacher.full_name} — ${cls.name} @ ${SCHOOL_NAME}\n`)

  console.log('Teaching documents:')
  await seedTeachingDocuments(teacher as { id: string; user_id: string; full_name: string })

  console.log('\nAssessment and evidence:')
  await seedAssessment(teacher.id as string, cls.id as string)

  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exitCode = 1 })
