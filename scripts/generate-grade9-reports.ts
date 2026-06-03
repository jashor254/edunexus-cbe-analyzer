// scripts/generate-grade9-reports.ts
// Generates full Academic Clinic PDF reports for 4 Grade 9 students.
// Run: npx tsx scripts/generate-grade9-reports.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const TARGETS = [
  { studentId: '38f2da17-e982-4399-bc21-e5fdf79ad9de', assessmentId: 'f57b53fb-651f-49fd-8b9d-e7aaa0e8252e', classId: '9390d1d6-ce5d-4298-a4ab-d2ec511c6f40', label: 'ALEX GICHOBI' },
  { studentId: 'c6efbdd5-0e0b-4cee-b668-8b07c18759a5', assessmentId: '867737dc-7f66-4a5c-9fbc-a9944f11dbf6', classId: '9390d1d6-ce5d-4298-a4ab-d2ec511c6f40', label: 'MARION WAIRIMU' },
  { studentId: '90e0d244-1cd5-439f-ab4a-6f75b3e7862e', assessmentId: '5c1a4271-4b90-4524-964b-0577465af79c', classId: 'c2a5b2bc-1314-4ab9-b4d9-2767f151b857', label: 'OLIVE WANINI' },
  { studentId: '4f9dbb62-b9b3-44ae-b4e9-8a34ba6073eb', assessmentId: '45cf56a2-eef4-4291-bae3-feb13e323f9a', classId: 'c2a5b2bc-1314-4ab9-b4d9-2767f151b857', label: 'TUCYLA NYAWIRA' },
]

const TEACHER_ID      = '45699ad6-f89c-4376-985f-31730a341801'
const TEACHER_USER_ID = '5cb45b89-0473-40f8-be70-0857424432a7'

async function main() {
  const { analyzePerformance }             = await import('../lib/adaptiveLearning')
  const { calculateJuniorPathwayAffinity } = await import('../lib/pathwayCalculator')
  const {
    generateReport, calculateVitals, generateActionPlan,
    generateJuniorGuidance, generateSeniorGuidance, generateLearningCompassRec, formatSubjectName,
  } = await import('../lib/academicClinic/reportGenerator')
  const { generateAcademicClinicPDF } = await import('../lib/academicClinic/pdfGenerator')

  const outDir = path.resolve(__dirname, '../generated-reports')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  for (const t of TARGETS) {
    console.log(`\n─── ${t.label} ───`)

    const { data: student } = await db
      .from('students')
      .select('id, name, grade, curriculum_type, school')
      .eq('id', t.studentId)
      .single()
    if (!student) { console.error('  ✗ Student not found'); continue }

    const { data: assessment } = await db
      .from('assessments')
      .select('id, term, year, subject_scores')
      .eq('id', t.assessmentId)
      .eq('student_id', t.studentId)
      .single()
    if (!assessment) { console.error('  ✗ Assessment not found'); continue }

    const scores = assessment.subject_scores as Record<string, number>

    const subjects = Object.entries(scores).map(([key, score]) => ({
      subject:        key,
      displayName:    formatSubjectName(key),
      level:          Math.max(1, Math.min(4, Math.round(score))) as 1 | 2 | 3 | 4,
      trend:          'stable' as const,
      velocity:       0,
      previousScores: [] as number[],
    }))

    // Adaptive analysis + learning context
    const adaptiveAnalysis = analyzePerformance(scores)
    const subjectTiers:       Record<string, string>   = {}
    const subjectActionSteps: Record<string, string[]> = {}
    adaptiveAnalysis.recommendations.forEach((rec: { subject: string; tier: string; actionSteps: string[] }) => {
      subjectTiers[rec.subject]       = rec.tier
      subjectActionSteps[rec.subject] = rec.actionSteps
    })

    const isJunior = student.grade >= 7 && student.grade <= 9
    let recommendedPathway: string | null = null
    let pathwayConfidence:  string | null = null
    let pathwayScores: Record<string, number> = {}

    if (isJunior) {
      const rec      = calculateJuniorPathwayAffinity(scores)
      recommendedPathway = rec.top_pathway            ?? null
      pathwayConfidence  = rec.confidence             ?? null
      pathwayScores = {
        STEM:              rec.stem_score,
        'Social Sciences': rec.social_sciences_score,
        'Arts & Sports':   rec.arts_sports_score,
      }
    }

    const compassRec = generateLearningCompassRec(subjects)

    await db.from('student_learning_context').upsert({
      student_id:           student.id,
      user_id:              TEACHER_USER_ID,
      overall_tier:         adaptiveAnalysis.overallTier,
      subject_tiers:        subjectTiers,
      subject_action_steps: subjectActionSteps,
      recommended_pathway:  recommendedPathway,
      pathway_confidence:   pathwayConfidence,
      pathway_scores:       pathwayScores,
      first_subject:        compassRec.firstSessionSubject,
      session_goal:         compassRec.sessionGoal,
      guided_topics:        compassRec.topicsToAsk,
      compass_bridge:       null,
      overall_level:        Math.round(subjects.reduce((s, sub) => s + sub.level, 0) / subjects.length),
      curriculum_type:      student.curriculum_type ?? 'cbc',
      grade:                student.grade,
      last_assessment_id:   assessment.id,
    }, { onConflict: 'student_id' })
    console.log('  ✓ learning context saved')

    // Build + generate PDF
    const vitals     = calculateVitals(subjects)
    const actionPlan = generateActionPlan(subjects)
    const firstName  = student.name.split(' ')[0]
    const jGuidance  = isJunior  ? generateJuniorGuidance(subjects)            : undefined
    const sGuidance  = !isJunior ? generateSeniorGuidance(subjects, firstName, student.grade) : undefined
    const report     = generateReport(
      { id: student.id, name: student.name, grade: student.grade, level: isJunior ? 'Junior School' : 'Senior School', term: assessment.term, year: assessment.year, school: student.school ?? undefined },
      subjects, vitals, actionPlan, [], jGuidance, sGuidance
    )

    console.log(`  Pathway: ${recommendedPathway} (${pathwayConfidence}) · Avg: ${vitals.overallAverage}/4`)
    console.log('  Generating PDF…')

    const pdfBlob   = await generateAcademicClinicPDF(report)
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())
    const filename  = `Academic_Clinic_${student.name.replace(/\s+/g, '_')}_Term${assessment.term}_${assessment.year}.pdf`
    const filepath  = path.join(outDir, filename)
    fs.writeFileSync(filepath, pdfBuffer)
    console.log(`  ✓ PDF → ${filepath}`)

    // Save DB record
    await db.from('student_clinic_reports').upsert({
      student_id:    student.id,
      teacher_id:    TEACHER_ID,
      class_id:      t.classId,
      assessment_id: assessment.id,
      term:          assessment.term,
      year:          assessment.year,
      pdf_url:       null,
    }, { onConflict: 'student_id,assessment_id' })
    console.log('  ✓ clinic report record saved')

    console.log(`  ✅ DONE`)
  }

  console.log(`\n✅  All 4 reports saved to: ${outDir}\n`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
