// scripts/generateBetaReports.ts
// Generate clinic report PDFs for all beta students
// Run: mkdir -p beta-reports && npx tsx scripts/generateBetaReports.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { writeFileSync, mkdirSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { buildClinicReport } from '@/lib/career/clinicReportBuilder'
import { generateCompassBridge } from '@/lib/career/autoReportGenerator'
import { generateClinicReportPDF } from '@/lib/career/clinicPdfRenderer'

const BETA_STUDENTS = [
  {
    id: 'c6efbdd5-0e0b-4cee-b668-8b07c18759a5',
    name: 'MARION WAIRIMU',
    filename: 'marion-wairimu-report.pdf',
  },
  {
    id: '38f2da17-e982-4399-bc21-e5fdf79ad9de',
    name: 'ALEX GICHOBI',
    filename: 'alex-gichobi-report.pdf',
  },
  {
    id: 'd6f86dc9-6430-4b7a-a265-3971e1fa8389',
    name: 'CHINEASE NDIRITU',
    filename: 'chinease-ndiritu-report.pdf',
  },
  {
    id: 'b676dadf-6d52-4652-8436-f8aa1bdce411',
    name: 'FRANKLINE BUNDI',
    filename: 'frankline-bundi-report.pdf',
  },
  {
    id: '4f9dbb62-b9b3-44ae-b4e9-8a34ba6073eb',
    name: 'TUCYLA NYAWIRA',
    filename: 'tucyla-nyawira-report.pdf',
  },
]

async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      realtime: { transport: ws as any },
    }
  )

  mkdirSync('./beta-reports', { recursive: true })

  let passed = 0
  let failed = 0

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Generating ${BETA_STUDENTS.length} beta reports...`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  for (const student of BETA_STUDENTS) {
    console.log(`Generating: ${student.name}...`)
    try {
      const report = await buildClinicReport(student.id, db)
      console.log(`  Grade ${report.grade} · ${report.section} · Level ${report.overall_level} · ${report.overall_label}`)

      const bridge = await generateCompassBridge(student.id, db)
      if (bridge) {
        await db
          .from('student_learning_context')
          .update({ compass_bridge: bridge, updated_at: new Date().toISOString() })
          .eq('student_id', student.id)
        console.log(`  Compass bridge saved (${bridge.firstSubject} → ${bridge.firstConcept})`)
      } else {
        console.log(`  ⚠ compass_bridge returned null — skipping DB save`)
      }

      const pdfBuffer = await generateClinicReportPDF(report)
      const outPath = `./beta-reports/${student.filename}`
      writeFileSync(outPath, pdfBuffer)

      console.log(`✓ ${student.name} done — ${(pdfBuffer.length / 1024).toFixed(1)} KB → ${outPath}`)
      passed++
    } catch (err) {
      console.error(`✗ ${student.name} failed:`, err instanceof Error ? err.message : err)
      failed++
    }
    console.log('')
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Done: ${passed} succeeded, ${failed} failed`)
  if (passed > 0) {
    console.log(`PDFs saved to ./beta-reports/`)
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
