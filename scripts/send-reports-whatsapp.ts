// scripts/send-reports-whatsapp.ts
// Uploads each generated clinic report PDF to Meta's media API,
// then sends it as a WhatsApp document message to the admin number.
// Run: npx tsx scripts/send-reports-whatsapp.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const BASE_URL       = 'https://graph.facebook.com/v25.0'
const PHONE_ID       = process.env.WHATSAPP_PHONE_NUMBER_ID!
const ACCESS_TOKEN   = process.env.WHATSAPP_ACCESS_TOKEN!
const ADMIN_PHONE    = '254710798030'

if (!PHONE_ID || !ACCESS_TOKEN) {
  console.error('Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in .env.local')
  process.exit(1)
}

const REPORTS = [
  { filename: 'Academic_Clinic_ALEX_GICHOBI_Term1_2026.pdf',    student: 'Alex Gichobi',    grade: 9, pathway: 'Social Sciences', avg: '3.4/4' },
  { filename: 'Academic_Clinic_MARION_WAIRIMU_Term1_2026.pdf',  student: 'Marion Wairimu',  grade: 9, pathway: 'STEM',             avg: '3.8/4' },
  { filename: 'Academic_Clinic_OLIVE_WANINI_Term1_2026.pdf',    student: 'Olive Wanini',    grade: 9, pathway: 'Arts & Sports',    avg: '2.9/4' },
  { filename: 'Academic_Clinic_TUCYLA_NYAWIRA_Term1_2026.pdf',  student: 'Tucyla Nyawira',  grade: 9, pathway: 'Social Sciences', avg: '3.2/4' },
]

// ─── Upload PDF to Meta media API (native FormData) ───────────────────────────

async function uploadMedia(filepath: string, filename: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filepath)
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', 'application/pdf')
  form.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), filename)

  const res = await fetch(`${BASE_URL}/${PHONE_ID}/media`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    body:    form,
  })

  const data = await res.json() as { id?: string; error?: { message: string; code: number } }

  if (!res.ok || data.error) {
    throw new Error(`Media upload failed: ${data.error?.message ?? `HTTP ${res.status}`}`)
  }

  return data.id!
}

// ─── Send document message ────────────────────────────────────────────────────

async function sendDocument(mediaId: string, caption: string, filename: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/${PHONE_ID}/messages`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to:   ADMIN_PHONE,
      type: 'document',
      document: {
        id:       mediaId,
        filename: filename,
        caption:  caption,
      },
    }),
  })

  const data = await res.json() as {
    messages?: Array<{ id: string }>
    error?: { message: string; code: number; error_subcode?: number }
  }

  if (!res.ok || data.error) {
    const code = data.error?.code
    const sub  = data.error?.error_subcode
    if (code === 131047 || sub === 131047) {
      throw new Error(
        `Outside 24-hour messaging window. Send a message to the EduNexus WhatsApp business number first, then re-run this script.`
      )
    }
    throw new Error(`Send failed: ${data.error?.message ?? `HTTP ${res.status}`}`)
  }

  console.log(`  ✓ Sent  (message id: ${data.messages?.[0]?.id})`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const reportsDir = path.resolve(__dirname, '../generated-reports')

  console.log(`\nSending ${REPORTS.length} reports to WhatsApp: +${ADMIN_PHONE}\n`)

  for (const r of REPORTS) {
    console.log(`─── ${r.student} ───`)
    const filepath = path.join(reportsDir, r.filename)

    if (!fs.existsSync(filepath)) {
      console.error(`  ✗ PDF not found: ${filepath}`)
      continue
    }

    try {
      console.log('  Uploading PDF to Meta media API…')
      const mediaId = await uploadMedia(filepath, r.filename)
      console.log(`  ✓ Uploaded (media id: ${mediaId})`)

      const caption =
        `📋 *EduNexus Academic Clinic Report*\n` +
        `Student: *${r.student}* · Grade ${r.grade}\n` +
        `Term 1, 2026\n` +
        `Pathway: ${r.pathway} · Avg: ${r.avg}`

      await sendDocument(mediaId, caption, r.filename)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ ${msg}`)
    }
  }

  console.log('\n✅  Done\n')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
