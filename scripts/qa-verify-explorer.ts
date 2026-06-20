// scripts/qa-verify-explorer.ts — TEMPORARY browser verification. Delete after use.
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const EMAIL = 'qa-verify-explorer@edunexus.test'
const PASSWORD = process.env.QA_PASSWORD ?? (() => { throw new Error('Set QA_PASSWORD in .env.local') })()

async function main() {
  const browser = await chromium.launch({
    executablePath: '/home/the-dev/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',
    args: ['--no-sandbox'],
  })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const p = await ctx.newPage()

  const consoleErrors: string[] = []
  p.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
  p.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`))

  console.log('1. Navigating to login...')
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await p.screenshot({ path: '/tmp/qa-1-login.png' })

  const emailInput = p.locator('input[type="email"], input[name="email"]').first()
  const passInput = p.locator('input[type="password"], input[name="password"]').first()
  await emailInput.fill(EMAIL)
  await passInput.fill(PASSWORD)
  await Promise.all([
    p.waitForLoadState('networkidle'),
    p.locator('button[type="submit"]').first().click(),
  ])
  await p.waitForTimeout(1500)
  console.log('   Current URL after login:', p.url())
  await p.screenshot({ path: '/tmp/qa-2-after-login.png' })

  console.log('2. Navigating to /career...')
  await p.goto(`${BASE}/career`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  await p.screenshot({ path: '/tmp/qa-3-career-explorer.png', fullPage: true })
  const cardCountAll = await p.locator('a[href^="/career/"]').count()
  console.log(`   Career cards visible (All Pathways): ${cardCountAll}`)

  console.log('3. Clicking STEM pathway tab...')
  await p.getByRole('button', { name: 'STEM', exact: true }).click()
  await p.waitForTimeout(1200)
  const cardCountStem = await p.locator('a[href^="/career/"]').count()
  console.log(`   Career cards visible (STEM): ${cardCountStem}`)
  await p.screenshot({ path: '/tmp/qa-4-career-stem-filter.png', fullPage: true })

  console.log('4. Clicking Social Sciences pathway tab...')
  await p.getByRole('button', { name: 'Social Sciences', exact: true }).click()
  await p.waitForTimeout(1200)
  const cardCountSocial = await p.locator('a[href^="/career/"]').count()
  console.log(`   Career cards visible (Social Sciences): ${cardCountSocial}`)
  await p.screenshot({ path: '/tmp/qa-5-career-social-filter.png', fullPage: true })

  console.log('5. Navigating directly to /career/teacher-education-technologist...')
  await p.goto(`${BASE}/career/teacher-education-technologist`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  await p.screenshot({ path: '/tmp/qa-6-teacher-detail.png', fullPage: true })

  const title = await p.locator('h1').first().textContent()
  const doorHeadings = await p.locator('h3').allTextContents()
  const bodyText = await p.locator('body').innerText()
  const hasNotFound = bodyText.includes('Career not found')

  console.log('   Page <h1>:', title)
  console.log('   Door headings found:', JSON.stringify(doorHeadings))
  console.log('   "Career not found" shown:', hasNotFound)
  console.log('   Mentions "AI Lets You Do":', bodyText.includes('What AI Lets You Do in This Field'))
  console.log('   Mentions sovereignty example text presence (non-empty AI superpowers section):', bodyText.includes('Real example'))

  console.log('\nConsole/page errors captured:', consoleErrors.length ? JSON.stringify(consoleErrors, null, 2) : 'none')

  await browser.close()
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
