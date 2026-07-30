// scripts/render-print-routes-pdf.ts — ONE-OFF. Converts the already-
// generated printable-routes sample HTML into a PDF via local Playwright +
// system Chrome, purely for visual verification (same approach used
// earlier this session for the Learner Blueprint PDFs).
//
// Run: npx tsx scripts/render-print-routes-pdf.ts
import * as fs from 'fs'
import { chromium } from 'playwright-core'

async function main() {
  const htmlPath = '/home/the-dev/Desktop/printable-adaptive-routes-grade9-sample.html'
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })
  try {
    const page = await browser.newPage()
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' })
    await page.emulateMedia({ media: 'print' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' } })
    const outPath = '/home/the-dev/Desktop/printable-adaptive-routes-grade9-sample.pdf'
    fs.writeFileSync(outPath, pdf)
    console.log(`Wrote ${outPath} (${(pdf.byteLength / 1024).toFixed(0)} KB)`)
  } finally {
    await browser.close()
  }
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1) })
