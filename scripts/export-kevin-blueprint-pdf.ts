// scripts/export-kevin-blueprint-pdf.ts — ONE-OFF. Renders the real,
// redesigned four-page BlueprintView for Kevin Otieno's actual composed
// Blueprint to a print-quality PDF, using local Playwright + system Chrome
// against a self-contained HTML file (Tailwind Play CDN compiles the real
// utility classes in-browser) — no dev server or auth session required.
// Uses exportMode="pdf" so the same print chrome (page breaks, hidden nav,
// data-blueprint-ready marker) that the real /api/student/blueprint/pdf
// route relies on is exercised here too.
//
// Run: npx tsx scripts/export-kevin-blueprint-pdf.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium } from 'playwright-core'

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
    BlueprintView({ blueprint, validation, learnerId: LEARNER_ID, exportMode: 'pdf' }) as Parameters<typeof renderToStaticMarkup>[0],
  )

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Learner Blueprint — Kevin Otieno</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  /* Mirrors app/globals.css's real print rules for [data-blueprint-page-shell] —
     deliberately no break-inside/page-break-inside: avoid, so a page whose
     content exceeds one sheet flows onto a continuation sheet instead of
     being clipped. */
  @media print {
    [data-blueprint-print-break="before"] { break-before: page; page-break-before: always; }
  }
  body { margin: 0; }
</style>
</head><body>${body}</body></html>`

  const htmlPath = '/tmp/kevin-blueprint-for-pdf.html'
  fs.writeFileSync(htmlPath, html, 'utf-8')

  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })
  try {
    const page = await browser.newPage()
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' })
    // Tailwind CDN compiles classes async after load — give it a moment, then
    // confirm the same readiness marker the real PDF route waits on.
    await page.waitForSelector('[data-blueprint-ready="true"]', { state: 'visible', timeout: 15000 })
    await page.waitForTimeout(800)
    await page.emulateMedia({ media: 'print' })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
    })

    const outPath = '/home/the-dev/Desktop/Kevin-Otieno-Learner-Blueprint.pdf'
    fs.writeFileSync(outPath, pdf)
    console.log(`Wrote ${outPath} (${(pdf.byteLength / 1024).toFixed(0)} KB)`)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
