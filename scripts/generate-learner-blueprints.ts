// scripts/generate-learner-blueprints.ts
// Generates Learner Blueprint PDFs for one or more students.
// Output: ~/Desktop/learner blueprints/
//
// Run with explicit student IDs:
//   npx tsx scripts/generate-learner-blueprints.ts <studentId> [studentId...]
//
// Run with no arguments to regenerate the two standing demo profiles
// (Tucyla — Junior, Trevor — Senior):
//   npx tsx scripts/generate-learner-blueprints.ts

import * as dotenv from 'dotenv'
import * as path   from 'path'
import * as fs     from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const DEFAULT_STUDENT_IDS = [
  '4f9dbb62-b9b3-44ae-b4e9-8a34ba6073eb', // Tucyla — Junior School demo
  '494c21c4-18ff-46c1-b364-5c19e6c7509f', // Trevor — Senior School demo
]

const OUT_DIR = path.resolve('/home/the-dev/Desktop/learner blueprints')

function safeFileTag(name: string): string {
  return name.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '').toUpperCase()
}

async function buildBlueprintPDF(studentId: string): Promise<{ name: string; buffer: Buffer }> {
  const { buildLearnerBlueprint }       = await import('../lib/learnerIntelligence/blueprint')
  const { generateLearnerBlueprintPDF } = await import('../lib/learnerIntelligence/pdfGenerator')

  const blueprint = await buildLearnerBlueprint(studentId)
  const pdfBlob   = await generateLearnerBlueprintPDF(blueprint)
  const buffer    = Buffer.from(await pdfBlob.arrayBuffer())

  return { name: blueprint.studentName, buffer }
}

async function main() {
  const studentIds = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_STUDENT_IDS

  console.log('━━━ EduNexus Learner Blueprint Generator ━━━\n')

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true })
    console.log(`Created folder: ${OUT_DIR}\n`)
  }

  for (const studentId of studentIds) {
    console.log(`▸ Generating blueprint for ${studentId}…`)
    const { name, buffer } = await buildBlueprintPDF(studentId)
    const outPath = path.join(OUT_DIR, `Learner_Blueprint_${safeFileTag(name)}_${new Date().toISOString().slice(0, 10)}.pdf`)
    fs.writeFileSync(outPath, buffer)
    console.log(`  ✅  ${name} → ${outPath}`)
  }

  console.log(`\n━━━ ${studentIds.length} Learner Blueprint(s) saved to Desktop ━━━`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
