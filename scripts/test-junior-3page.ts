// scripts/test-junior-3page.ts
// Test the new 3-page junior clinic report with hardcoded data
// Run: npx tsx scripts/test-junior-3page.ts

import * as path from 'path'
import * as fs   from 'fs'
import { generateReport, calculateVitals, generateActionPlan, generateJuniorGuidance } from '@/lib/academicClinic/reportGenerator'
import { generateAcademicClinicPDF } from '@/lib/academicClinic/pdfGenerator'
import type { StudentProfile, SubjectProgress } from '@/lib/academicClinic/reportGenerator'

async function main() {
  console.log('─── Junior 3-Page Clinic Report Test ───\n')

  // High-performing student to exercise "Strongly Ready" path
  const subjects: SubjectProgress[] = [
    { subject: 'mathematics',         displayName: 'Mathematics',         level: 4, trend: 'improving', velocity: 1,    previousScores: [3, 4] },
    { subject: 'english',             displayName: 'English',             level: 4, trend: 'stable',    velocity: 0,    previousScores: [4, 4] },
    { subject: 'kiswahili',           displayName: 'Kiswahili',           level: 3, trend: 'improving', velocity: 0.5,  previousScores: [2, 3] },
    { subject: 'integrated_science',  displayName: 'Integrated Science',  level: 3, trend: 'stable',    velocity: 0,    previousScores: [3, 3] },
    { subject: 'social_studies',      displayName: 'Social Studies',      level: 3, trend: 'stable',    velocity: 0,    previousScores: [3, 3] },
    { subject: 'creative_arts_sports',displayName: 'Creative Arts & Sports', level: 2, trend: 'stable', velocity: 0,   previousScores: [2, 2] },
    { subject: 'pre_technical',       displayName: 'Pre-Technical Studies',  level: 3, trend: 'stable', velocity: 0,    previousScores: [3, 3] },
    { subject: 'geography',           displayName: 'Geography',              level: 2, trend: 'stable', velocity: 0,    previousScores: [2, 2] },
  ]

  const profile: StudentProfile = {
    id:      'test-junior-001',
    name:    'Amina Ochieng',
    grade:   8,
    level:   'Junior School',
    term:    2,
    year:    2026,
    school:  'Sunshine Academy, Kisumu',
    pathway: null,
  }

  const mockAssessments = [
    {
      created_at: '2025-09-01T00:00:00Z',
      dream_career: null,
      subject_scores: { mathematics: 2, english: 2, kiswahili: 2, integrated_science: 3, social_studies: 3, creative_arts_sports: 2, pre_technical: 2, agriculture_nutrition: 3 },
      term: 1, year: 2025,
    },
    {
      created_at: '2026-04-01T00:00:00Z',
      dream_career: null,
      subject_scores: { mathematics: 2, english: 3, kiswahili: 2, integrated_science: 2, social_studies: 3, creative_arts_sports: 3, pre_technical: 2, agriculture_nutrition: 3 },
      term: 2, year: 2026,
    },
  ]

  const vitals     = calculateVitals(subjects)
  const actionPlan = generateActionPlan(subjects)
  const guidance   = generateJuniorGuidance(subjects)

  console.log(`Vitals — avg: ${vitals.overallAverage}, strengths: ${vitals.strengths}, priority: ${vitals.urgent}`)

  const report = generateReport(profile, subjects, vitals, actionPlan, mockAssessments, guidance)

  console.log(`Report ID:      ${report.reportId}`)
  console.log(`Status label:   ${report.academicStatusLabel}`)
  console.log(`Overall level:  ${report.clinicalOverview.overallCompetencyLevel} — ${report.clinicalOverview.overallCompetencyLabel}`)
  console.log(`Trajectory:     ${report.clinicalOverview.trajectory}`)
  console.log(`Pathway cards:  ${report.pathwayReadinessCards?.length ?? 0} pathways`)
  if (report.pathwayReadinessCards) {
    for (const card of report.pathwayReadinessCards) {
      console.log(`  ${card.pathway}: ${card.score}% — ${card.statusLabel} (${card.gapRows.length} rows)`)
    }
  }
  console.log(`Roadmap:        ${report.pathwayRoadmap?.targetPathway} — ${report.pathwayRoadmap?.steps.length ?? 0} steps`)
  console.log(`Term plan:      week=${report.termActionPlan?.thisWeek.length}, month=${report.termActionPlan?.thisMonth.length}, g10=${report.termActionPlan?.beforeGrade10.length}`)
  console.log(`Future opps:    ${report.juniorFutureOpportunities?.length ?? 0} opportunities`)

  console.log('\nGenerating 3-page PDF…')
  const pdfBlob   = await generateAcademicClinicPDF(report)
  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

  const outDir  = path.resolve(__dirname, '../generated-reports')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const filename = `Junior_Clinic_AMINA_${new Date().toISOString().slice(0, 10)}.pdf`
  const filepath = path.join(outDir, filename)
  fs.writeFileSync(filepath, pdfBuffer)

  console.log(`\n✅  PDF saved → ${filepath}`)
  console.log(`    Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
