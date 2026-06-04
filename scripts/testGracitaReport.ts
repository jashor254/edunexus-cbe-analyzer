// scripts/testGracitaReport.ts
// Local test: generate full clinic report + PDF for GRACITA VILITA (Grade 11 CBC Senior)
// Run: npx tsx scripts/testGracitaReport.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { writeFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { buildClinicReport } from '@/lib/career/clinicReportBuilder'
import { generateCompassBridge } from '@/lib/career/autoReportGenerator'
import { generateClinicReportPDF } from '@/lib/career/clinicPdfRenderer'

const STUDENT_ID = 'b6c05ebe-2a02-4ca1-bbdc-be10b5b1ff64'

async function testGracita() {
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

  const report = await buildClinicReport(STUDENT_ID, db)

  console.log('Student:        ', report.student_name)
  console.log('Grade:          ', report.grade)
  console.log('Section:        ', report.section)
  console.log('Overall Level:  ', report.overall_level, '—', report.overall_label)
  console.log('Score:          ', report.overall_score.toFixed(2))
  console.log('Top career:     ', report.top_career?.career.title ?? '(none)')
  console.log('Top subjects:   ', report.top_subjects.map(s => `${s.display_name}(${s.score})`).join(', '))
  console.log('Weak subjects:  ', report.weak_subjects.map(s => `${s.display_name}(${s.score})`).join(', '))
  console.log('Summary:        ', report.summary_sentence)
  console.log('Parent actions: ', report.parent_actions.length)
  console.log('')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Step 2 — Generating compass bridge...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const bridge = await generateCompassBridge(STUDENT_ID, db)

  if (bridge) {
    console.log('Session goal:      ', bridge.sessionGoal)
    console.log('First subject:     ', bridge.firstSubject)
    console.log('First concept:     ', bridge.firstConcept)
    console.log('Start difficulty:  ', bridge.startDifficulty)
    console.log('Week 1 goal:       ', bridge.weeklyMilestones?.[0]?.goal)
    console.log('Parent WhatsApp:   ', bridge.parentWhatsAppMessage)

    await db
      .from('student_learning_context')
      .update({ compass_bridge: bridge, updated_at: new Date().toISOString() })
      .eq('student_id', STUDENT_ID)
    console.log('✓ compass_bridge saved to DB')
  } else {
    console.log('⚠ compass_bridge generation returned null')
  }
  console.log('')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Step 3 — Generating PDF...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const pdfBuffer = await generateClinicReportPDF(report)
  const outPath = './gracita-clinic-report-test.pdf'
  writeFileSync(outPath, pdfBuffer)

  console.log(`✓ PDF saved: ${outPath}`)
  console.log(`  Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`)
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('CHECKLIST:')
  console.log(`  Section senior:           ${report.section === 'senior' ? '✓' : '✗ got: ' + report.section}`)
  console.log(`  Grade correct (11):       ${report.grade === 11 ? '✓' : '✗ got: ' + report.grade}`)
  console.log(`  Overall level (2):        ${report.overall_level === 2 ? '✓' : '✗ got: ' + report.overall_level}`)
  console.log(`  Career section present:   ${report.top_career ? '✓ ' + report.top_career.career.title : '✗ no career match'}`)
  console.log(`  Top subjects filled:      ${report.top_subjects.length > 0 ? '✓ ' + report.top_subjects.length : '✗ empty'}`)
  console.log(`  Parent actions (3):       ${report.parent_actions.length >= 3 ? '✓' : '✗ got: ' + report.parent_actions.length}`)
  console.log(`  Compass concept specific: ${bridge?.firstConcept ? '✓ ' + bridge.firstConcept : '✗ null'}`)
  console.log(`  Start difficulty (1):     ${bridge?.startDifficulty === 1 ? '✓' : '✗ got: ' + bridge?.startDifficulty}`)
  console.log(`  PDF not empty:            ${pdfBuffer.length > 5000 ? '✓' : '✗ too small'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

testGracita().catch(err => {
  console.error('FAILED:', err)
  process.exit(1)
})
