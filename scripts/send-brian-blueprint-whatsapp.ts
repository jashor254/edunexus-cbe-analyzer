// scripts/send-brian-blueprint-whatsapp.ts — ONE-OFF. Composes the real,
// canonical Blueprint (composeBlueprint) for the demo learner BRIAN MATTHIAS
// (Grade 9Y, Kangai school) and sends a WhatsApp summary to the owner number
// via lib/whatsapp/sender.ts::sendWhatsApp (edunexus_parent_update template).
//
// Run: npx tsx scripts/send-brian-blueprint-whatsapp.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const CORE_LEARNER_ID = '6eb84d41-e476-4d93-b42e-8298da985834' // BRIAN MATTHIAS (bridged row, students.id 7d3e4169-...)
const SCHOOL_ID       = 'df4e7130-ebbe-4ca8-9d13-acb8ecd29b8b' // Kangai school (via teacher 45699ad6)
const ACTOR_USER_ID   = '5cb45b89-0473-40f8-be70-0857424432a7' // Dennis's own teacher/auth id
const OWNER_PHONE      = process.env.OWNER_WHATSAPP_NUMBER ?? '254710798030'

async function main() {
  const { composeBlueprint } = await import('../lib/learnerBlueprint/composeBlueprint')
  const { sendWhatsApp } = await import('../lib/whatsapp/sender')

  const { blueprint } = await composeBlueprint({
    actorUserId:   ACTOR_USER_ID,
    coreLearnerId: CORE_LEARNER_ID,
    schoolId:      SCHOOL_ID,
  })

  const academic = blueprint.academicRecord.data
  const career    = blueprint.career.data
  const risk      = blueprint.risk.data
  const story     = blueprint.learningStory.data
  const nextStep  = blueprint.recommendedNextSteps.data?.actions[0]

  const lines: string[] = []
  lines.push(`*EduNexus Learner Blueprint* 📘`)
  lines.push(`BRIAN MATTHIAS — Grade 9`)
  lines.push('')
  if (academic) {
    lines.push(`📚 Academic: ${academic.bySubject.length} subjects tracked, all at CBC Level 3 (Meets Expectation). Focus: ${blueprint.learningCompass.data?.currentLearningFocus.subject ?? 'n/a'}.`)
  }
  if (career) {
    lines.push(`🎯 Career: ${career.strengthProfile} (confidence: ${career.confidence}).`)
  }
  if (risk) {
    lines.push(`⚠️ Risk: ${risk.overallRiskLevel === 'normal' ? 'Normal — no flags active.' : risk.flags.join(', ')}`)
  }
  if (story) {
    lines.push('')
    lines.push(`📝 ${story.evidence} ${story.opportunity}`)
  }
  if (nextStep) {
    lines.push('')
    lines.push(`✅ Next: ${nextStep.description}`)
  }

  const message = lines.join('\n')
  console.log('--- message ---')
  console.log(message)
  console.log(`(${message.length} chars)`)

  const result = await sendWhatsApp(OWNER_PHONE, message)
  console.log('--- send result ---')
  console.log(JSON.stringify(result, null, 2))
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
