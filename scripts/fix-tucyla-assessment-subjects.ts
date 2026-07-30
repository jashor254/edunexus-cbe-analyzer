// scripts/fix-tucyla-assessment-subjects.ts
// One-off correction: the Term 2 CAT 1 2026 assessment seeded earlier for
// TUCYLA NYAWIRA only covered 5 subjects — Grade 9Y at kangai school has a
// real prior assessment record (class_assessments.id
// 4946747c-43c9-4619-8ad1-f8faf751a69c, "Mid-Term Assessment Term 1 2026")
// showing the actual 9-subject CBC Junior School list this class uses:
// mathematics, english, kiswahili, integrated_science, pre_technical_studies,
// creative_arts_sports, social_studies, cre, agriculture_nutrition. This
// script retracts the incomplete evidence (domain-sanctioned correction
// path, never a raw delete/edit) and reseeds the same assessment title with
// the full, correct 9-subject set.
//
// Run: npx tsx scripts/fix-tucyla-assessment-subjects.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const LEGACY_STUDENT_ID = '4f9dbb62-b9b3-44ae-b4e9-8a34ba6073eb' // TUCYLA NYAWIRA
const LEGACY_TEACHER_ID = '45699ad6-f89c-4376-985f-31730a341801' // Dennis Kariuki Njeru
const LEGACY_CLASS_ID = 'c2a5b2bc-1314-4ab9-b4d9-2767f151b857' // Grade 9Y
const TEACHER_USER_ID = '5cb45b89-0473-40f8-be70-0857424432a7'
const INCORRECT_ASSESSMENT_ID = '6d64982a-fd20-4d4e-b8aa-f8d465e72668'

// The real, full 9-subject CBC Junior School list this class actually uses
// (matches class_assessments.id 4946747c-... "Mid-Term Assessment Term 1
// 2026", a real prior record for this exact class).
const SCORES: Record<string, number> = {
  mathematics: 62,
  english: 68,
  kiswahili: 71,
  integrated_science: 58,
  social_studies: 74,
  pre_technical_studies: 65,
  creative_arts_sports: 78,
  cre: 70,
  agriculture_nutrition: 60,
}

async function main() {
  const { repos } = await import('../lib/repositories')
  const { recordAssessmentEvidence } = await import('../lib/assessments/evidence')
  const { retractEvidence } = await import('../lib/intelligence/evidenceLifecycle')
  const { createServiceClient } = await import('../utils/supabase/service')
  const db = createServiceClient()

  console.log('▸ Retracting incomplete (5-subject) evidence…')
  const { data: badEvidence, error: findErr } = await db
    .from('learner_evidence')
    .select('id')
    .like('raw_input_ref', `class_assessments:${INCORRECT_ASSESSMENT_ID}:%`)
  if (findErr) throw findErr
  for (const row of badEvidence ?? []) {
    await retractEvidence(row.id as string, TEACHER_USER_ID, 'Incomplete subject coverage — only 5 of the real 9 CBC Junior subjects were recorded for this class.')
  }
  console.log(`  ✅ retracted ${badEvidence?.length ?? 0} evidence rows`)

  console.log('▸ Recording corrected Term 2 CAT 1 2026 (9 subjects)…')
  const subjects = Object.keys(SCORES)
  const total = Object.values(SCORES).reduce((a, b) => a + b, 0)
  const mean = total / subjects.length

  const assessment = await repos.assessments.createAssessment(LEGACY_TEACHER_ID, LEGACY_CLASS_ID, {
    title: 'Term 2 CAT 1 2026 (corrected)',
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
  console.log(`  ✅ evidence recorded for ${assessment.id} across ${subjects.length} subjects`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
