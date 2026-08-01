// scripts/send-test-whatsapp.ts
// One-off manual test: sends a single approved WhatsApp template message
// through the production Cloud API number to a manually supplied recipient.
// Reuses lib/whatsapp/client.ts — no new send path, no DB writes, no UI.
//
// Run:
//   npx tsx scripts/send-test-whatsapp.ts 0712345678
//   npx tsx scripts/send-test-whatsapp.ts 0712345678 edunexus_parent_update
//   TEST_WHATSAPP_TO=254712345678 npx tsx scripts/send-test-whatsapp.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
import { sendWhatsAppTemplate } from '../lib/whatsapp/client'
import { normalizeKenyanPhone } from '../lib/growth/messaging/links'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const DEFAULT_TEMPLATE = 'edunexus_parent_update'

async function main(): Promise<void> {
  const rawTo = process.argv[2] ?? process.env.TEST_WHATSAPP_TO
  const templateName = process.argv[3] ?? process.env.TEST_WHATSAPP_TEMPLATE ?? DEFAULT_TEMPLATE

  if (!rawTo) {
    console.error('Usage: npx tsx scripts/send-test-whatsapp.ts <recipient> [templateName]')
    console.error('   or: TEST_WHATSAPP_TO=<recipient> npx tsx scripts/send-test-whatsapp.ts')
    process.exit(1)
  }

  if (!process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN) {
    console.error('Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in .env.local')
    process.exit(1)
  }

  const to = normalizeKenyanPhone(rawTo)

  const result = await sendWhatsAppTemplate({
    to,
    templateName,
    components: [
      { type: 'body', parameters: [{ type: 'text', text: 'This is a one-time EduNexus Cloud API test message.' }] },
    ],
  })

  if (result.success) {
    console.log(`status=sent messageId=${result.messageId}`)
  } else {
    console.error(`status=failed error=${result.error}`)
    process.exit(1)
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`status=fatal error=${message}`)
  process.exit(1)
})
