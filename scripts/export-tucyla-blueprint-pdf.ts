// scripts/export-tucyla-blueprint-pdf.ts — ONE-OFF. Renders the real,
// redesigned four-page BlueprintView for TUCYLA NYAWIRA's actual composed
// Blueprint to a print-quality PDF (same approach as
// export-kevin-blueprint-pdf.ts — local Playwright + system Chrome against
// a self-contained HTML file, no dev server or auth session required).
//
// Run: npx tsx scripts/export-tucyla-blueprint-pdf.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium } from 'playwright-core'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const LEARNER_ID = '9224b6a3-4e22-4b1b-bdec-d19a92370dcc' // Tucyla Nyawira
const SCHOOL_ID = 'df4e7130-ebbe-4ca8-9d13-acb8ecd29b8b' // kangai school
const ACTOR_USER_ID = '5cb45b89-0473-40f8-be70-0857424432a7' // Dennis Kariuki Njeru

async function main() {
  const { composeBlueprint } = await import('../lib/learnerBlueprint/composeBlueprint')
  const { default: BlueprintView } = await import('../components/blueprint/BlueprintView')

  const { blueprint, validation } = await composeBlueprint({
    actorUserId: ACTOR_USER_ID,
    coreLearnerId: LEARNER_ID,
    schoolId: SCHOOL_ID,
  })

  console.log('validation.valid =', validation.valid)
  console.log('section statuses:', Object.fromEntries(
    Object.entries(blueprint).filter(([k]) => k !== 'metadata').map(([k, v]) => [k, (v as { status: string }).status]),
  ))

  const body = renderToStaticMarkup(
    BlueprintView({ blueprint, validation, learnerId: LEARNER_ID, exportMode: 'pdf' }) as Parameters<typeof renderToStaticMarkup>[0],
  )

  // Inline the project's own compiled Tailwind output instead of the
  // external Play CDN — that CDN proved unreliable to reach from Playwright's
  // browser process in this sandbox (reproducible timeout, not flakiness),
  // even though plain curl reached it fine. This compiled chunk already
  // contains every class BlueprintView.tsx uses (Tailwind v4 scans the
  // whole source tree, not just visited routes).
  const compiledCssPath = path.resolve(__dirname, '../.next/dev/static/chunks/app_globals_0yg4wg8.css')
  const compiledCss = fs.readFileSync(compiledCssPath, 'utf-8')

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Learner Blueprint — Tucyla Nyawira</title>
<style>
${compiledCss}
@media print {
  [data-blueprint-print-break="before"] { break-before: page; page-break-before: always; }
}
body { margin: 0; }
</style>
</head><body>${body}</body></html>`

  const htmlPath = '/tmp/tucyla-blueprint-for-pdf.html'
  fs.writeFileSync(htmlPath, html, 'utf-8')

  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })
  try {
    const page = await browser.newPage()
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-blueprint-ready="true"]', { state: 'visible', timeout: 15000 })
    // Styles are inlined synchronously now (no external CDN), but still
    // verify the navy header actually painted before printing, rather than
    // silently shipping an unstyled fallback PDF.
    await page.waitForFunction(() => {
      const header = document.querySelector('[data-blueprint-report-header="true"]')
      if (!header) return false
      const bg = getComputedStyle(header).backgroundColor
      return bg !== 'rgba(0, 0, 0, 0)' && bg !== ''
    }, { timeout: 10000 })
    await page.emulateMedia({ media: 'print' })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
    })

    const outPath = '/home/the-dev/Desktop/Tucyla-Nyawira-Learner-Blueprint.pdf'
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
