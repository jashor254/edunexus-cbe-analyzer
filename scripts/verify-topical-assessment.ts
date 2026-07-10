// scripts/verify-topical-assessment.ts
//
// Manual verification run for the topical-assessment feature — calls the
// exact same lib function the API route calls, against real beta-tester
// data (Grade 9, "Beta Testers" class). Prints before/after state so the
// run can be read and judged, not just "no errors thrown".
//
// Not wired into any npm script — one-off, run directly with:
//   npx tsx --env-file=.env.local scripts/verify-topical-assessment.ts

import { createServiceClient } from '@/utils/supabase/service'
import { recordTopicalAssessment } from '@/lib/assessments/topical'

const CLASS_ID   = '024a5fc3-812e-4358-ad97-6561ebbe0bc6' // "Beta Testers", Grade 9
const TEACHER_ID = '45699ad6-f89c-4376-985f-31730a341801'
const STUDENT_A  = '4f9dbb62-b9b3-44ae-b4e9-8a34ba6073eb' // TUCYLA NYAWIRA (is_beta_tester=true)
const STUDENT_B  = '38f2da17-e982-4399-bc21-e5fdf79ad9de' // ALEX GICHOBI (same Beta Testers class)

async function main() {
  const db = createServiceClient()

  console.log('── BEFORE ──────────────────────────────────────────────')
  const before = await db
    .from('learner_profiles')
    .select('student_id, knowledge_state, risk_flags, growth_milestones')
    .in('student_id', [STUDENT_A, STUDENT_B])
  console.log(JSON.stringify(before.data, null, 2))

  const beforeStrandCount = await db
    .from('strand_assessments')
    .select('id', { count: 'exact', head: true })
    .in('student_id', [STUDENT_A, STUDENT_B])
  console.log('strand_assessments rows before:', beforeStrandCount.count)

  console.log('\n── RUNNING recordTopicalAssessment ─────────────────────')
  const result = await recordTopicalAssessment({
    classId:   CLASS_ID,
    teacherId: TEACHER_ID,
    subject:   'mathematics',
    strand:    'Numbers',
    topic:     'Fractions',
    term:      2,
    year:      2026,
    ratings: [
      { studentId: STUDENT_A, rating: 2 }, // Tucyla — Approaching
      { studentId: STUDENT_B, rating: 4 }, // Alex — Exceeding
    ],
  })
  console.log('recordTopicalAssessment result:', result)

  console.log('\n── AFTER ───────────────────────────────────────────────')
  const after = await db
    .from('learner_profiles')
    .select('student_id, knowledge_state, risk_flags, growth_milestones')
    .in('student_id', [STUDENT_A, STUDENT_B])
  console.log(JSON.stringify(after.data, null, 2))

  const strandRows = await db
    .from('strand_assessments')
    .select('*')
    .in('student_id', [STUDENT_A, STUDENT_B])
    .eq('source', 'topical_check')
  console.log('\nstrand_assessments rows written:')
  console.log(JSON.stringify(strandRows.data, null, 2))
}

main().then(() => process.exit(0)).catch(err => {
  console.error('VERIFICATION FAILED:', err)
  process.exit(1)
})
