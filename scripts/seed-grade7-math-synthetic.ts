// scripts/seed-grade7-math-synthetic.ts
//
// ⚠️  SYNTHETIC / TEST DATA — safe to wipe.
// Seeds ~10 fake Grade 7 Mathematics learners with strand_assessments at two
// timepoints (T1, T2), so both the "did learning take place" primitive
// (lib/learningSignal) and the prerequisite quick-wins engine
// (lib/knowledgeGraph/quickWins) can be exercised end to end before any real
// teacher has entered Grade 7 Maths marks on the platform.
//
// Every synthetic student's `school` column is set to SYNTHETIC_MARKER below —
// to wipe everything this script created:
//   delete from students where school = 'SYNTHETIC_TEST_GRADE7_MATH_SEED';
// (cascades to strand_assessments via student_id FK, and the shared
// `assessments` parent row is tagged the same way in its `source` column and
// can be deleted separately — its own cascade would also wipe every
// strand_assessments row seeded here, since they all share one assessment_id.)
//
// Run: npx tsx scripts/seed-grade7-math-synthetic.ts
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createServiceClient } from '@/utils/supabase/service'

const SYNTHETIC_MARKER = 'SYNTHETIC_TEST_GRADE7_MATH_SEED'
const SUBJECT = 'mathematics'
const GRADE   = 7
const T1      = '2026-05-04T09:00:00.000Z'  // start of term
const T2      = '2026-07-04T09:00:00.000Z'  // ~2 months later

type TopicKey = { subject: string; strand: string; topic: string; node_id: string }

// Rating per topic for one learner at one timepoint. Missing topic = not assessed that timepoint.
type LearnerProfile = {
  label:   string  // shows in console output only
  t1:      Record<string, number>  // node_id -> rating
  t2:      Record<string, number>
}

async function main() {
  const db = createServiceClient()

  // Pull the real (subject, strand, topic) -> node_id mapping so every
  // strand/topic string we write is byte-identical to what buildStudentNodeData
  // and the class-aggregate query will look for. No hand-typed topic strings.
  const { data: mappings, error: mapError } = await db
    .from('node_assessment_map')
    .select('subject, strand, topic, node_id')
    .eq('grade', GRADE)

  if (mapError) throw new Error(`node_assessment_map fetch failed: ${mapError.message}`)
  const topics = (mappings ?? []).filter(m => m.subject === SUBJECT) as TopicKey[]
  if (topics.length === 0) throw new Error(`No node_assessment_map rows found for ${SUBJECT} grade ${GRADE}`)

  console.log(`Found ${topics.length} real Grade 7 Mathematics topics to seed against.`)

  // Node IDs, for readability below (these are the real ids from knowledge_nodes).
  const WHOLE_NUMBERS   = 'G7-MAT-NUM-T01'
  const FRACTIONS       = 'G7-MAT-NUM-T02'
  const DECIMALS        = 'G7-MAT-NUM-T03'
  const PERCENTAGES     = 'G7-MAT-NUM-T04'
  const INTEGERS        = 'G7-MAT-NUM-T05'
  const PATTERNS        = 'G7-MAT-ALG-T01'
  const ALGEBRAIC_EXPR  = 'G7-MAT-ALG-T02'
  const SHAPES_2D       = 'G7-MAT-GEO-T01'
  const ANGLES          = 'G7-MAT-GEO-T02'
  const TRANSFORMATIONS = 'G7-MAT-GEO-T03'
  const LENGTH_AREA     = 'G7-MAT-MEA-T01'
  const VOLUME          = 'G7-MAT-MEA-T02'
  const TIME_MONEY       = 'G7-MAT-MEA-T03'
  const DATA_COLLECTION = 'G7-MAT-STA-T01'
  const DATA_REPR       = 'G7-MAT-STA-T02'

  const ALL_NODE_IDS = topics.map(t => t.node_id)

  // Baseline "everyone starts around here" rating, so every profile below only
  // needs to specify what's DIFFERENT about that learner.
  function baseline(rating: number): Record<string, number> {
    const r: Record<string, number> = {}
    for (const id of ALL_NODE_IDS) r[id] = rating
    return r
  }

  const profiles: LearnerProfile[] = [
    {
      label: 'Broadly improving',
      t1: baseline(2),
      t2: baseline(3),
    },
    {
      label: 'Flat / stagnant (no learning took place)',
      t1: baseline(2),
      t2: baseline(2),
    },
    {
      label: 'Regressing broadly',
      t1: baseline(3),
      t2: baseline(2),
    },
    {
      label: 'Weak root: Whole Numbers stuck (high blast radius)',
      t1: { ...baseline(3), [WHOLE_NUMBERS]: 1 },
      t2: { ...baseline(3), [WHOLE_NUMBERS]: 1 }, // unfixed both timepoints
    },
    {
      label: 'Weak root: Fractions stuck (hard-blocks Decimals + Percentages)',
      t1: { ...baseline(3), [FRACTIONS]: 2, [DECIMALS]: 2, [PERCENTAGES]: 2 },
      t2: { ...baseline(3), [FRACTIONS]: 2, [DECIMALS]: 2, [PERCENTAGES]: 2 },
    },
    {
      label: 'Mostly mastered, one topic crosses the ME threshold',
      t1: { ...baseline(4), [DECIMALS]: 2 },
      t2: { ...baseline(4), [DECIMALS]: 3 }, // crossedThreshold = true for Decimals
    },
    {
      label: 'Weak root: Angles stuck (blocks Geometrical/Transformations chain)',
      t1: { ...baseline(3), [SHAPES_2D]: 2, [ANGLES]: 1 },
      t2: { ...baseline(3), [SHAPES_2D]: 2, [ANGLES]: 1 },
    },
    {
      label: 'Mixed bag — some up, some down, some flat',
      t1: { ...baseline(2), [PATTERNS]: 3, [ALGEBRAIC_EXPR]: 2, [LENGTH_AREA]: 3, [VOLUME]: 2 },
      t2: { ...baseline(2), [PATTERNS]: 2, [ALGEBRAIC_EXPR]: 3, [LENGTH_AREA]: 1, [VOLUME]: 2 },
    },
    {
      label: 'Partial data — some topics only assessed once (insufficient_data)',
      t1: (() => {
        const r = baseline(2)
        delete r[TRANSFORMATIONS]
        delete r[TIME_MONEY]
        return r
      })(),
      t2: baseline(3), // TRANSFORMATIONS/TIME_MONEY appear only at T2 -> insufficient_data
    },
    {
      label: 'Weak root: Data Collection stuck (blocks Data Representation)',
      t1: { ...baseline(3), [DATA_COLLECTION]: 1, [DATA_REPR]: 2 },
      t2: { ...baseline(3), [DATA_COLLECTION]: 1, [DATA_REPR]: 2 },
    },
    // Extra Integers/Percentages nudge so those nodes aren't perpetually mastered no-ops
    {
      label: 'Weak in Integers only, otherwise solid',
      t1: { ...baseline(4), [INTEGERS]: 2 },
      t2: { ...baseline(4), [INTEGERS]: 2 },
    },
  ]

  console.log(`Seeding ${profiles.length} synthetic learners...`)

  // 1. Synthetic students
  const studentRows = profiles.map((p, i) => ({
    name:            `SYNTHETIC-G7MATH-${String(i + 1).padStart(2, '0')} (${p.label})`,
    grade:           GRADE,
    level:           'junior',
    curriculum_type: 'cbc',
    school:          SYNTHETIC_MARKER,
    added_by:        'system',
  }))

  const { data: insertedStudents, error: studentErr } = await db
    .from('students')
    .insert(studentRows)
    .select('id, name')

  if (studentErr) throw new Error(`students insert failed: ${studentErr.message}`)
  console.log(`Inserted ${insertedStudents!.length} synthetic students.`)

  // 2. One shared `assessments` parent row (the FK wrinkle from the Step D audit —
  // strand_assessments.assessment_id references the career/pathway `assessments`
  // table, not a classroom test event). One throwaway row satisfies the FK for
  // every strand_assessments row seeded below.
  const { data: assessmentRow, error: assessmentErr } = await db
    .from('assessments')
    .insert({
      student_id:       insertedStudents![0].id,
      term:              2,
      year:              2026,
      grade:             GRADE,
      curriculum_type:   'cbc',
      assessment_style:  'formative',
      source:            'teacher', // assessments.source CHECK only allows 'teacher' | 'parent' — synthetic marker lives in raw_marks.note instead
      subject_scores:    {},
      raw_marks:         { note: 'SYNTHETIC TEST DATA — Grade 7 Maths prerequisite engine seed. Safe to delete.' },
    })
    .select('id')
    .single()

  if (assessmentErr) throw new Error(`assessments insert failed: ${assessmentErr.message}`)
  const assessmentId = assessmentRow!.id as string
  console.log(`Inserted shared synthetic assessments parent row: ${assessmentId}`)

  // 3. strand_assessments at both timepoints for every learner x topic they have data for.
  const strandRows: Array<{
    assessment_id: string
    student_id:    string
    subject:       string
    strand:        string
    topic:         string
    rating:        number
    created_at:    string
  }> = []

  profiles.forEach((profile, i) => {
    const studentId = insertedStudents![i].id as string
    for (const t of topics) {
      const r1 = profile.t1[t.node_id]
      const r2 = profile.t2[t.node_id]
      if (r1 !== undefined) {
        strandRows.push({
          assessment_id: assessmentId, student_id: studentId,
          subject: t.subject, strand: t.strand, topic: t.topic,
          rating: r1, created_at: T1,
        })
      }
      if (r2 !== undefined) {
        strandRows.push({
          assessment_id: assessmentId, student_id: studentId,
          subject: t.subject, strand: t.strand, topic: t.topic,
          rating: r2, created_at: T2,
        })
      }
    }
  })

  const { error: strandErr } = await db.from('strand_assessments').insert(strandRows)
  if (strandErr) throw new Error(`strand_assessments insert failed: ${strandErr.message}`)

  console.log(`Inserted ${strandRows.length} strand_assessments rows across ${profiles.length} learners x ${topics.length} topics x up to 2 timepoints.`)
  console.log('')
  console.log('Synthetic learner IDs (for headless run):')
  insertedStudents!.forEach((s, i) => console.log(`  ${i + 1}. ${s.id}  ${profiles[i].label}`))
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
