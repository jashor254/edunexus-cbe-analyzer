// scripts/generate-tucyla-report.ts
// Generate Tucyla Nyawira's clinic report using the latest clinicPdfRenderer format.
// Run: npx tsx scripts/generate-tucyla-report.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const TUCYLA_STUDENT_ID = '4f9dbb62-b9b3-44ae-b4e9-8a34ba6073eb'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  console.log('─── Tucyla Nyawira — Latest Format Clinic Report ───\n')

  const { buildClinicReport }       = await import('../lib/career/clinicReportBuilder')
  const { generateClinicReportPDF } = await import('../lib/career/clinicPdfRenderer')

  console.log('Building clinic report data…')
  const report = await buildClinicReport(TUCYLA_STUDENT_ID, db)

  console.log(`  Student  : ${report.student_name}`)
  console.log(`  Grade    : ${report.grade}  (${report.section})`)
  console.log(`  Level    : ${report.overall_level} — ${report.overall_label}`)
  console.log(`  Pathway  : ${report.recommended_pathway ?? '—'}`)
  console.log(`  Top      : ${report.top_subjects.map(s => s.display_name).join(', ')}`)
  console.log(`  Weak     : ${report.weak_subjects.map(s => s.display_name).join(', ')}`)

  console.log('\nGenerating PDF…')
  const pdfBuffer = await generateClinicReportPDF(report)

  const outDir  = path.resolve(__dirname, '../generated-reports')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const filename = `Academic_Clinic_TUCYLA_NYAWIRA_Latest_${new Date().toISOString().slice(0, 10)}.pdf`
  const filepath = path.join(outDir, filename)
  fs.writeFileSync(filepath, pdfBuffer)

  console.log(`\n✅  PDF saved → ${filepath}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
