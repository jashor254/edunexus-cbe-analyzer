// scripts/upload-reports-storage.ts
// Uploads the 4 generated clinic report PDFs to Supabase storage
// and prints public download URLs.
// Run: npx tsx scripts/upload-reports-storage.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const BUCKET = 'clinic-reports'

const REPORTS = [
  { filename: 'Academic_Clinic_ALEX_GICHOBI_Term1_2026.pdf',   student: 'Alex Gichobi',   pathway: 'Social Sciences', avg: '3.4/4' },
  { filename: 'Academic_Clinic_MARION_WAIRIMU_Term1_2026.pdf', student: 'Marion Wairimu', pathway: 'STEM',             avg: '3.8/4' },
  { filename: 'Academic_Clinic_OLIVE_WANINI_Term1_2026.pdf',   student: 'Olive Wanini',   pathway: 'Arts & Sports',   avg: '2.9/4' },
  { filename: 'Academic_Clinic_TUCYLA_NYAWIRA_Term1_2026.pdf', student: 'Tucyla Nyawira', pathway: 'Social Sciences', avg: '3.2/4' },
]

async function main() {
  const reportsDir = path.resolve(__dirname, '../generated-reports')
  const urls: { student: string; url: string }[] = []

  console.log(`\nUploading ${REPORTS.length} reports to Supabase storage…\n`)

  for (const r of REPORTS) {
    const filepath = path.join(reportsDir, r.filename)
    const fileBuffer = fs.readFileSync(filepath)

    // Upload (overwrite if already exists)
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(r.filename, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (error) {
      console.error(`  ✗ ${r.student}: ${error.message}`)
      continue
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(r.filename)

    const publicUrl = urlData.publicUrl
    urls.push({ student: r.student, url: publicUrl })
    console.log(`  ✅ ${r.student}`)
    console.log(`     Pathway: ${r.pathway} · Avg: ${r.avg}`)
    console.log(`     📎 ${publicUrl}\n`)
  }

  // Also update the student_clinic_reports table with the pdf_url
  if (urls.length > 0) {
    // Map student name → student_id (from the earlier script)
    const NAME_TO_ID: Record<string, string> = {
      'ALEX GICHOBI':   '38f2da17-e982-4399-bc21-e5fdf79ad9de',
      'MARION WAIRIMU': 'c6efbdd5-0e0b-4cee-b668-8b07c18759a5',
      'OLIVE WANINI':   '90e0d244-1cd5-439f-ab4a-6f75b3e7862e',
      'TUCYLA NYAWIRA': '4f9dbb62-b9b3-44ae-b4e9-8a34ba6073eb',
    }
    for (const { student, url } of urls) {
      const sid = NAME_TO_ID[student.toUpperCase()]
      if (!sid) continue
      await supabase
        .from('student_clinic_reports')
        .update({ pdf_url: url })
        .eq('student_id', sid)
      console.log(`  ✓ pdf_url saved in DB for ${student}`)
    }
  }

  console.log('\n════════════════════════════════════════════════════')
  console.log('Open any of the links above in your browser or phone')
  console.log('to download the PDF, then forward on WhatsApp.')
  console.log('════════════════════════════════════════════════════\n')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
