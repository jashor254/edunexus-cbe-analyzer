// scripts/qa-verify-trevor-explorer.ts — TEMPORARY browser verification for Trevor's real account. Delete after use.
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const TREVOR_EMAIL = 'kariukidennis092@gmail.com'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  console.log('Generating magic link for Trevor account…')
  const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email: TREVOR_EMAIL,
    options: { redirectTo: `${BASE}/career` },
  })
  if (linkErr) throw linkErr
  const actionLink = linkData.properties.action_link
  console.log('Got action link.')

  const browser = await chromium.launch({
    executablePath: '/home/the-dev/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',
    args: ['--no-sandbox'],
  })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const p = await ctx.newPage()

  const consoleErrors: string[] = []
  p.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
  p.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`))

  console.log('1. Following magic link to establish session...')
  await p.goto(actionLink, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  console.log('   Current URL:', p.url())
  await p.screenshot({ path: '/tmp/trevor-1-after-login.png' })

  console.log('2. Navigating to /career...')
  await p.goto(`${BASE}/career`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  await p.screenshot({ path: '/tmp/trevor-2-career-explorer.png', fullPage: true })
  const cardCountAll = await p.locator('a[href^="/career/"]').count()
  console.log(`   Career cards visible (All Pathways): ${cardCountAll}`)

  const tabs = await p.locator('button').allTextContents()
  console.log('   Tabs/buttons on page:', JSON.stringify(tabs.filter(t => t.trim()).slice(0, 20)))

  console.log('3. Clicking first career card...')
  const firstCard = p.locator('a[href^="/career/"]').first()
  const href = await firstCard.getAttribute('href')
  await firstCard.click()
  await p.waitForLoadState('networkidle')
  await p.waitForTimeout(1500)
  console.log('   Navigated to:', p.url(), '(href was', href, ')')
  await p.screenshot({ path: '/tmp/trevor-3-career-detail.png', fullPage: true })

  const title = await p.locator('h1').first().textContent()
  const bodyText = await p.locator('body').innerText()
  console.log('   Page <h1>:', title)
  console.log('   "Career not found" shown:', bodyText.includes('Career not found'))

  console.log('4. Navigating to academic clinic / report area (if linked from career page)...')
  const clinicLink = p.locator('a[href*="clinic"], a[href*="academic"]').first()
  if (await clinicLink.count() > 0) {
    const clinicHref = await clinicLink.getAttribute('href')
    console.log('   Found clinic link:', clinicHref)
  } else {
    console.log('   No clinic link found on this page.')
  }

  console.log('\nConsole/page errors captured:', consoleErrors.length ? JSON.stringify(consoleErrors, null, 2) : 'none')

  await browser.close()
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
