// scripts/export-kevin-blueprint-view.tsx — ONE-OFF. Renders the real,
// redesigned four-page BlueprintView for Kevin Otieno's actual composed
// Blueprint (seeded this session) to a standalone HTML file, using the
// Tailwind Play CDN so the real utility classes render in-browser without
// needing the Next.js build pipeline or a reachable dev server. This is
// the true BlueprintView component — not a raw JSON dump.
//
// Run: npx tsx scripts/export-kevin-blueprint-view.tsx

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { renderToStaticMarkup } from 'react-dom/server'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const LEARNER_ID = 'a1ad092a-26d5-4964-b624-957e6b0d6bc4' // Kevin Otieno
const SCHOOL_ID = '10fa6eab-7209-485b-880a-bafaf3038277'
const ACTOR_USER_ID = '3d806cf1-f63e-40f9-bd62-ed50fbcdd601'

async function main() {
  const { composeBlueprint } = await import('../lib/learnerBlueprint/composeBlueprint')
  const { default: BlueprintView } = await import('../components/blueprint/BlueprintView')

  const { blueprint, validation } = await composeBlueprint({
    actorUserId: ACTOR_USER_ID,
    coreLearnerId: LEARNER_ID,
    schoolId: SCHOOL_ID,
  })

  const body = renderToStaticMarkup(
    BlueprintView({ blueprint, validation, learnerId: LEARNER_ID, exportMode: 'screen' }) as Parameters<typeof renderToStaticMarkup>[0],
  )

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Learner Blueprint — Kevin Otieno</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>body{background:#f1f5f9;}</style>
</head><body>${body}</body></html>`

  const outPath = '/home/the-dev/Desktop/kevin-otieno-blueprint-v2.html'
  fs.writeFileSync(outPath, html, 'utf-8')
  console.log(`Wrote ${outPath}`)
  console.log(`validation.valid=${validation.valid}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
