// scripts/seed-tucyla-assessment.ts
// One-off: records a real Term 2 CAT assessment for TUCYLA NYAWIRA (Grade
// 9Y, kangai school) through the sanctioned evidence path
// (lib/assessments/evidence.ts::recordAssessmentEvidence) so her Learner
// Blueprint has genuine academic evidence instead of the honest-empty
// "no evidence yet" state. She already exists as a real legacy student +
// bridged Core learner (from an earlier session) — this only adds an
// assessment, it does not create a new student.
//
// Run: npx tsx scripts/seed-tucyla-assessment.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const LEGACY_STUDENT_ID = '4f9dbb62-b9b3-44ae-b4e9-8a34ba6073eb' // TUCYLA NYAWIRA
const LEGACY_TEACHER_ID = '45699ad6-f89c-4376-985f-31730a341801' // Dennis Kariuki Njeru
const LEGACY_CLASS_ID = 'c2a5b2bc-1314-4ab9-b4d9-2767f151b857' // Grade 9Y
const TEACHER_USER_ID = '5cb45b89-0473-40f8-be70-0857424432a7'

// Mid-band (58-74%), covering the real Grade 9 subjects node_assessment_map
// has coverage for, plus the standard CBC Junior subject set.
const SCORES: Record<string, number> = {
  mathematics: 62,
  english: 68,
  kiswahili: 71,
  integrated_science: 58,
  social_studies: 74,
}

async function main() {
  const { repos } = await import('../lib/repositories')
  const { recordAssessmentEvidence } = await import('../lib/assessments/evidence')

  console.log('▸ Recording Term 2 CAT 1 2026…')
  const subjects = Object.keys(SCORES)
  const total = Object.values(SCORES).reduce((a, b) => a + b, 0)
  const mean = total / subjects.length

  const assessment = await repos.assessments.createAssessment(LEGACY_TEACHER_ID, LEGACY_CLASS_ID, {
    title: 'Term 2 CAT 1 2026',
    assessmentType: 'cat',
    term: '2',
    year: 2026,
    maxScore: 100,
    subjects,
    curriculumType: 'cbc',
  })

  await repos.assessments.insertMarks([{
    assessment_id: assessment.id,
    class_id: LEGACY_CLASS_ID,
    teacher_id: LEGACY_TEACHER_ID,
    student_name: 'TUCYLA NYAWIRA',
    admission_number: null,
    subject_scores: SCORES,
    total_marks: total,
    mean_score: mean,
    mean_grade: 'ME',
    student_id: LEGACY_STUDENT_ID,
  }])

  await recordAssessmentEvidence(assessment.id, LEGACY_TEACHER_ID, TEACHER_USER_ID)
  console.log(`  ✅ evidence recorded for ${assessment.id}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
