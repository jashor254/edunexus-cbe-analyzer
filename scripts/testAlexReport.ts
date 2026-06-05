// scripts/testAlexReport.ts
// Local test: generate full clinic report + PDF for ALEX GICHOBI (Grade 9 CBC)
// Run: npx tsx scripts/testAlexReport.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { writeFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { buildClinicReport } from '@/lib/career/clinicReportBuilder'
import { generateClinicReportPDF } from '@/lib/career/clinicPdfRenderer'

const ALEX_ID = '38f2da17-e982-4399-bc21-e5fdf79ad9de'

async function testAlex() {
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

  const report = await buildClinicReport(ALEX_ID, db)

  console.log('Student:      ', report.student_name)
  console.log('Grade:        ', report.grade)
  console.log('Section:      ', report.section)
  console.log('Overall Level:', report.overall_level, '—', report.overall_label)
  console.log('Score:        ', report.overall_score.toFixed(2))
  console.log('Pathway:      ', report.recommended_pathway)
  console.log('KJSEA composite:', report.kjsea_composite ?? 'n/a')
  console.log('Top subjects: ', report.top_subjects.map(s => `${s.display_name}(${s.score})`).join(', '))
  console.log('Weak subjects:', report.weak_subjects.map(s => `${s.display_name}(${s.score})`).join(', '))
  console.log('Summary:      ', report.summary_sentence)
  console.log('')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Step 2 — Generating PDF...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const pdfBuffer = await generateClinicReportPDF(report)
  const outPath = './alex-clinic-report-test.pdf'
  writeFileSync(outPath, pdfBuffer)

  console.log(`✓ PDF saved: ${outPath}`)
  console.log(`  Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`)
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('CHECKLIST:')
  console.log(`  Student name correct:    ${report.student_name.includes('ALEX') ? '✓' : '✗ ' + report.student_name}`)
  console.log(`  Grade correct (9):       ${report.grade === 9 ? '✓' : '✗ ' + report.grade}`)
  console.log(`  Section junior:          ${report.section === 'junior' ? '✓' : '✗ ' + report.section}`)
  console.log(`  Has pathway:             ${report.recommended_pathway ? '✓ ' + report.recommended_pathway : '✗ none'}`)
  console.log(`  KJSEA composite:         ${report.kjsea_composite !== undefined ? '✓ ' + report.kjsea_composite + '/72' : '✗ missing'}`)
  console.log(`  Top subjects filled:     ${report.top_subjects.length > 0 ? '✓ ' + report.top_subjects.length : '✗ empty'}`)
  console.log(`  Parent actions (3):      ${report.parent_actions.length >= 3 ? '✓' : '✗ ' + report.parent_actions.length}`)
  console.log(`  PDF not empty:           ${pdfBuffer.length > 5000 ? '✓' : '✗ too small'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

testAlex().catch(err => {
  console.error('FAILED:', err)
  process.exit(1)
})
