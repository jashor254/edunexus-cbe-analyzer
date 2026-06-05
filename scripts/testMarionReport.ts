// scripts/testMarionReport.ts
// Local test: generate full clinic report + PDF for MARION WAIRIMU (Grade 9 CBC)
// Run: npx tsx scripts/testMarionReport.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { writeFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { buildClinicReport } from '@/lib/career/clinicReportBuilder'
import { generateCompassBridge } from '@/lib/career/autoReportGenerator'
import { generateClinicReportPDF } from '@/lib/career/clinicPdfRenderer'

const MARION_ID = 'c6efbdd5-0e0b-4cee-b668-8b07c18759a5'

async function testMarion() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      realtime: { transport: ws as any },
    }
  )

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Step 1 — Building clinic report...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const report = await buildClinicReport(MARION_ID, db)

  console.log('Student:      ', report.student_name)
  console.log('Grade:        ', report.grade)
  console.log('Section:      ', report.section)
  console.log('Overall Level:', report.overall_level, '—', report.overall_label)
  console.log('Score:        ', report.overall_score.toFixed(2))
  console.log('Pathway:      ', report.recommended_pathway)
  console.log('Top subjects: ', report.top_subjects.map(s => `${s.display_name}(${s.score})`).join(', '))
  console.log('Weak subjects:', report.weak_subjects.map(s => `${s.display_name}(${s.score})`).join(', '))
  console.log('Summary:      ', report.summary_sentence)
  console.log('Parent actions:', report.parent_actions.length)
  console.log('')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Step 2 — Generating compass bridge...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const bridge = await generateCompassBridge(MARION_ID, db)

  if (bridge) {
    console.log('Session goal:    ', bridge.sessionGoal)
    console.log('First subject:   ', bridge.firstSubject)
    console.log('First concept:   ', bridge.firstConcept)
    console.log('Start difficulty:', bridge.startDifficulty)
    console.log('Week 1 goal:     ', bridge.weeklyMilestones?.[0]?.goal)

    // Save bridge to DB
    await db
      .from('student_learning_context')
      .update({ compass_bridge: bridge, updated_at: new Date().toISOString() })
      .eq('student_id', MARION_ID)
    console.log('✓ compass_bridge saved to DB')
  } else {
    console.log('⚠ compass_bridge generation returned null')
  }
  console.log('')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Step 3 — Generating PDF...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const pdfBuffer = await generateClinicReportPDF(report)
  const outPath = './marion-clinic-report-test.pdf'
  writeFileSync(outPath, pdfBuffer)

  console.log(`✓ PDF saved: ${outPath}`)
  console.log(`  Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`)
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('CHECKLIST:')
  console.log(`  Student name correct:    ${report.student_name === 'MARION WAIRIMU' ? '✓' : '✗ ' + report.student_name}`)
  console.log(`  Grade correct (9):       ${report.grade === 9 ? '✓' : '✗ ' + report.grade}`)
  console.log(`  Section junior:          ${report.section === 'junior' ? '✓' : '✗ ' + report.section}`)
  console.log(`  Overall level (4):       ${report.overall_level === 4 ? '✓' : '✗ ' + report.overall_level}`)
  console.log(`  Has pathway:             ${report.recommended_pathway ? '✓ ' + report.recommended_pathway : '✗ none'}`)
  console.log(`  Top subjects filled:     ${report.top_subjects.length > 0 ? '✓ ' + report.top_subjects.length : '✗ empty'}`)
  console.log(`  Parent actions (3):      ${report.parent_actions.length >= 3 ? '✓' : '✗ ' + report.parent_actions.length}`)
  console.log(`  compass_bridge concept:  ${bridge?.firstConcept ?? '✗ null'}`)
  console.log(`  PDF not empty:           ${pdfBuffer.length > 5000 ? '✓' : '✗ too small'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

testMarion().catch(err => {
  console.error('FAILED:', err)
  process.exit(1)
})
