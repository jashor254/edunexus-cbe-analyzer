// scripts/render-tucyla-blueprint.ts — ONE-OFF. Composes and inspects
// TUCYLA NYAWIRA's Blueprint after bridge-tucyla-blueprint.ts, to check
// section-by-section for unavailable/not_implemented status and obviously
// wrong data before reporting on rendering quality.
//
// Run: npx tsx scripts/render-tucyla-blueprint.ts

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const SCHOOL_ID = 'df4e7130-ebbe-4ca8-9d13-acb8ecd29b8b'
const LEARNER_ID = '9224b6a3-4e22-4b1b-bdec-d19a92370dcc'
const ACTOR_USER_ID = '5cb45b89-0473-40f8-be70-0857424432a7' // Dennis Kariuki Njeru

async function main() {
  const { composeBlueprint } = await import('../lib/learnerBlueprint/composeBlueprint')
  const result = await composeBlueprint({
    actorUserId: ACTOR_USER_ID,
    coreLearnerId: LEARNER_ID,
    schoolId: SCHOOL_ID,
  })

  console.log('=== validation ===')
  console.log(JSON.stringify(result.validation, null, 2))

  console.log('\n=== coherence ===')
  console.log(JSON.stringify(result.coherence, null, 2))

  console.log('\n=== section status summary ===')
  for (const [key, section] of Object.entries(result.blueprint)) {
    if (key === 'metadata') continue
    const s = section as { status?: string; unavailableReason?: string; owner?: string }
    console.log(`${key.padEnd(22)} ${String(s.status).padEnd(16)} owner=${s.owner ?? '-'}${s.unavailableReason ? ' reason=' + s.unavailableReason : ''}`)
  }

  console.log('\n=== metadata ===')
  console.log(JSON.stringify(result.blueprint.metadata, null, 2))

  console.log('\n=== identity ===')
  console.log(JSON.stringify(result.blueprint.identity, null, 2))

  console.log('\n=== academicRecord ===')
  console.log(JSON.stringify(result.blueprint.academicRecord, null, 2))

  console.log('\n=== risk ===')
  console.log(JSON.stringify(result.blueprint.risk, null, 2))
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
