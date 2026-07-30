// scripts/seed-mock-grade9-learner.ts
// One-off: creates a mock Grade 9 CBC learner (average performance) under the
// existing parent account kariukimatthias@gmail.com, then records two rounds
// of assessment marks through the sanctioned evidence path
// (lib/assessments/evidence.ts::recordAssessmentEvidence) so a real Learner
// Blueprint can be generated for them.
//
// Run: npx tsx scripts/seed-mock-grade9-learner.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const TEACHER_ID          = '45699ad6-f89c-4376-985f-31730a341801' // Grade 9Y class teacher
const CLASS_ID             = 'c2a5b2bc-1314-4ab9-b4d9-2767f151b857' // Grade 9Y
const INITIATED_BY_USER_ID = '5cb45b89-0473-40f8-be70-0857424432a7' // teacher's auth user id
const PARENT_USER_ID       = 'd9282246-f7db-4a5b-a4a5-2669b8ee6a17' // kariukimatthias@gmail.com
const PARENT_EMAIL         = 'kariukimatthias@gmail.com'
const LEARNER_NAME         = 'BRIAN MATTHIAS'

// Average-band marks (58-72%) across subjects that cover all 6 capability
// dimensions (analytical_reasoning, communication, creative_thinking,
// technical_aptitude, social_intelligence) per lib/career/capabilityExtractor.ts.
// Two rounds so `resilience` has the 2+ snapshots it needs.
const ROUNDS: Array<{ title: string; term: string; scores: Record<string, number> }> = [
  {
    title: 'Term 2 CAT 1 2026',
    term: '2',
    scores: {
      mathematics: 61,
      english: 66,
      kiswahili: 64,
      integrated_science: 59,
      social_studies: 68,
      creative_arts_sports: 70,
      pre_technical_studies: 62,
    },
  },
  {
    title: 'Term 2 CAT 2 2026',
    term: '2',
    scores: {
      mathematics: 65,
      english: 69,
      kiswahili: 63,
      integrated_science: 64,
      social_studies: 66,
      creative_arts_sports: 72,
      pre_technical_studies: 60,
    },
  },
]

async function main() {
  const { repos } = await import('../lib/repositories')
  const { recordAssessmentEvidence } = await import('../lib/assessments/evidence')

  console.log('▸ Creating mock Grade 9 learner…')
  const { data: student, error: studentErr } = await db
    .from('students')
    .insert({
      name: LEARNER_NAME,
      grade: 9,
      level: 'Junior School',
      curriculum_type: 'cbc',
      teacher_id: TEACHER_ID,
      parent_user_id: PARENT_USER_ID,
      parent_email: PARENT_EMAIL,
      parent_first_name: 'Kariuki',
      added_by: 'teacher',
      is_beta_tester: true,
      selected_subjects: Object.keys(ROUNDS[0].scores),
    })
    .select('id, name')
    .single()
  if (studentErr) throw studentErr
  console.log(`  ✅ ${student.name} → ${student.id}`)

  for (const round of ROUNDS) {
    console.log(`▸ Recording ${round.title}…`)
    const subjects = Object.keys(round.scores)
    const total = Object.values(round.scores).reduce((a, b) => a + b, 0)
    const mean = total / subjects.length

    const assessment = await repos.assessments.createAssessment(TEACHER_ID, CLASS_ID, {
      title: round.title,
      assessmentType: 'cat',
      term: round.term,
      year: 2026,
      maxScore: 100,
      subjects,
      curriculumType: 'cbc',
    })

    await repos.assessments.insertMarks([{
      assessment_id: assessment.id,
      class_id: CLASS_ID,
      teacher_id: TEACHER_ID,
      student_name: LEARNER_NAME,
      admission_number: null,
      subject_scores: round.scores,
      total_marks: total,
      mean_score: mean,
      mean_grade: 'ME',
      student_id: student.id,
    }])

    await recordAssessmentEvidence(assessment.id, TEACHER_ID, INITIATED_BY_USER_ID)
    console.log(`  ✅ evidence recorded for ${assessment.id}`)
  }

  console.log(`\n━━━ Mock learner ready: ${student.id} ━━━`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
