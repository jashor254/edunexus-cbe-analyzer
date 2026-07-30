// scripts/seed-grade10-opener-term3.ts
// One-off: creates a mock Grade 10 CBC learner at the Reference School
// (Mwatate Ridge Senior School — already fully bridged Core<->legacy), then
// records an Opener Term 3 2026 assessment through the sanctioned evidence
// path (lib/assessments/evidence.ts::recordAssessmentEvidence) so a real
// Learner Blueprint can be composed for them.
//
// Run: npx tsx scripts/seed-grade10-opener-term3.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const SCHOOL_ID = '10fa6eab-7209-485b-880a-bafaf3038277' // Mwatate Ridge Senior School
const CORE_CLASS_ID = 'f08f5941-e10b-4f3b-88a4-95135f7ff6cc' // Grade 10 East
const TERM_ID = '0985dd8d-0576-48ba-8da3-2f9d23d0d24d' // Term 3 2026
const ACADEMIC_YEAR_ID = '6709cefa-2084-4b87-bc8d-7839775e2f1e' // 2026
const LEGACY_TEACHER_ID = '63714442-fe90-455c-968b-c254de0675d7' // Achieng Nafula (Grade 10 East)
const LEGACY_CLASS_ID = 'f86af520-2e9f-40d2-8521-cd26f491cd07' // teacher_classes row bridged to CORE_CLASS_ID
const TEACHER_USER_ID = '3d806cf1-f63e-40f9-bd62-ed50fbcdd601'

const LEARNER_FIRST = 'Kevin'
const LEARNER_LAST = 'Otieno'
const ADMISSION_NUMBER = `MRSS-G10-${Date.now()}`

// Mid-to-strong band (65-82%), covering every subject node_assessment_map has for Grade 10.
const SCORES: Record<string, number> = {
  mathematics: 71,
  biology: 78,
  chemistry: 65,
  physics: 74,
  kiswahili_lugha: 80,
  kiswahili_fasihi: 69,
}

async function main() {
  const { repos } = await import('../lib/repositories')
  const { recordAssessmentEvidence } = await import('../lib/assessments/evidence')

  console.log('▸ Creating Core learner…')
  const { data: learner, error: learnerErr } = await db
    .from('learners')
    .insert({
      school_id: SCHOOL_ID,
      admission_number: ADMISSION_NUMBER,
      first_name: LEARNER_FIRST,
      last_name: LEARNER_LAST,
      nationality: 'Kenyan',
      special_needs: [],
      status: 'active',
      admission_date: '2026-01-06',
    })
    .select('id')
    .single()
  if (learnerErr) throw learnerErr
  const learnerId = learner.id as string
  console.log(`  ✅ learner_id=${learnerId}`)

  console.log('▸ Enrolling in Grade 10 East, Term 3 2026…')
  const { error: enrollErr } = await db.from('learner_enrollments').insert({
    school_id: SCHOOL_ID,
    learner_id: learnerId,
    class_id: CORE_CLASS_ID,
    term_id: TERM_ID,
    academic_year_id: ACADEMIC_YEAR_ID,
    enrollment_date: '2026-01-06',
    status: 'active',
  })
  if (enrollErr) throw enrollErr
  console.log('  ✅ enrolled')

  console.log('▸ Bridging legacy `students` row…')
  const { data: student, error: studentErr } = await db
    .from('students')
    .insert({
      name: `${LEARNER_FIRST} ${LEARNER_LAST}`.toUpperCase(),
      grade: 10,
      level: 'Senior School',
      curriculum_type: 'cbc',
      teacher_id: LEGACY_TEACHER_ID,
      added_by: 'system',
      is_beta_tester: false,
      external_id: learnerId,
      term: '3',
      year: 2026,
      selected_subjects: Object.keys(SCORES),
    })
    .select('id, name')
    .single()
  if (studentErr) throw studentErr
  const legacyStudentId = student.id as string
  console.log(`  ✅ ${student.name} → ${legacyStudentId}`)

  console.log('▸ Recording Opener Term 3 2026…')
  const subjects = Object.keys(SCORES)
  const total = Object.values(SCORES).reduce((a, b) => a + b, 0)
  const mean = total / subjects.length

  const assessment = await repos.assessments.createAssessment(LEGACY_TEACHER_ID, LEGACY_CLASS_ID, {
    title: 'Opener Term 3 2026',
    assessmentType: 'opener',
    term: '3',
    year: 2026,
    maxScore: 100,
    subjects,
    curriculumType: 'cbc',
  })

  await repos.assessments.insertMarks([{
    assessment_id: assessment.id,
    class_id: LEGACY_CLASS_ID,
    teacher_id: LEGACY_TEACHER_ID,
    student_name: `${LEARNER_FIRST} ${LEARNER_LAST}`.toUpperCase(),
    admission_number: ADMISSION_NUMBER,
    subject_scores: SCORES,
    total_marks: total,
    mean_score: mean,
    mean_grade: 'ME',
    student_id: legacyStudentId,
  }])

  await recordAssessmentEvidence(assessment.id, LEGACY_TEACHER_ID, TEACHER_USER_ID)
  console.log(`  ✅ evidence recorded for ${assessment.id}`)

  console.log(`\n━━━ Ready: Core learner ${learnerId} / legacy student ${legacyStudentId} ━━━`)
  console.log(JSON.stringify({ learnerId, legacyStudentId, schoolId: SCHOOL_ID, actorUserId: TEACHER_USER_ID }))
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
