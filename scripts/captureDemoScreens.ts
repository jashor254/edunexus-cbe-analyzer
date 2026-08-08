// scripts/captureDemoScreens.ts
//
// Captures the product screenshots the /demo presentation shows, from the
// running application, against the Reference School (Mwatate Ridge Senior
// School) — a fully synthetic fixture, so no real learner, teacher or school
// ever appears in the deck.
//
// Why this exists: the screens must be real product UI (never mocked up), and
// they must be clean enough to fill a presentation slide. A photograph of a
// monitor satisfies neither — it carries glare, crop and whatever browser tabs
// happened to be open. Headless capture has no browser chrome at all, renders
// at 2x, and is repeatable when a screen changes.
//
// Authentication reuses the technique already established and documented in
// scripts/reference-school/07-seed-blueprint-demo.ts: Supabase Admin
// generateLink() + verifyOtp() to obtain a genuine session for a seeded
// account whose throwaway password was never stored. As there, it targets only
// an @mwatateridge.ac.ke.example account this repo's own seed suite created,
// never accepts a caller-supplied email, and every authorization check the
// session hits still runs for real.
//
// Writes nothing to the database. Reads pages only.
//
// Prerequisites: the app running locally (default http://localhost:3000) and
// the reference school seeded.
//
// Run: npx tsx --env-file=.env.local scripts/captureDemoScreens.ts

if (process.env.NODE_ENV === 'production') {
  throw new Error('[capture] refusing to run with NODE_ENV=production — reference-school fixture capture only.')
}

import { chromium, type Page } from 'playwright-core'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { createServiceClient } from '@/utils/supabase/service'
import { DEMO_ASSETS, DEMO_ASSET_DIR } from '@/lib/demo/presentation'

const BASE_URL = process.env.DEMO_CAPTURE_BASE_URL ?? 'http://localhost:3000'
const OUT_DIR = path.join(process.cwd(), 'public', DEMO_ASSET_DIR)
const FIXTURE_EMAIL_DOMAIN = '@mwatateridge.ac.ke.example'

// Reference-school entities, resolved at run time rather than hardcoded so
// this keeps working if the fixture is reseeded.
const REFERENCE_SCHOOL = 'Mwatate Ridge Senior School'

type Target = {
  file: string
  url: string
  /** Scroll this text into view before capturing, so the slide frames the right section. */
  anchorText?: string
  /** Extra settle time for pages that fetch after mount. */
  settleMs?: number
}

async function resolveFixture() {
  const db = createServiceClient()

  const { data: school } = await db
    .from('schools').select('id').eq('school_name', REFERENCE_SCHOOL).maybeSingle()
  if (!school) throw new Error(`[capture] ${REFERENCE_SCHOOL} not found — run the reference-school seed first.`)

  // Capture as the teacher who actually has content: the reference-school
  // class seeded by 09-seed-demo-content.ts. Blueprint and Career Intelligence
  // only produce output where evidence exists, and the teacher-facing routes
  // authorize on this same teacher/learner relationship — picking either
  // arbitrarily yields an empty state or a 403, not a screenshot.
  const { data: scheme } = await db
    .from('schemes_of_work')
    .select('teacher_id')
    .eq('school', REFERENCE_SCHOOL)
    .limit(1)
    .maybeSingle()
  if (!scheme) throw new Error('[capture] no reference-school scheme of work — run 09-seed-demo-content.ts first.')

  const { data: teacher } = await db
    .from('teachers').select('id, user_id, full_name').eq('id', scheme.teacher_id as string).maybeSingle()
  if (!teacher?.user_id) throw new Error('[capture] scheme teacher has no auth user.')

  // A learner of that teacher who actually carries confirmed evidence.
  const { data: roster } = await db
    .from('students').select('id, name').eq('teacher_id', teacher.id).limit(60)
  const rosterIds = (roster ?? []).map(s => s.id as string)

  const { data: evidence } = await db
    .from('learner_evidence')
    .select('learner_id')
    .in('learner_id', rosterIds)
    .eq('lifecycle_state', 'auto_confirmed')
  const counts = new Map<string, number>()
  for (const e of evidence ?? []) {
    const id = e.learner_id as string
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (ranked.length === 0) throw new Error('[capture] no reference-school learner has confirmed evidence — run 09-seed-demo-content.ts first.')

  return {
    candidates: ranked.slice(0, 12).map(([id, n]) => ({
      id,
      name: (roster ?? []).find(s => s.id === id)!.name as string,
      evidenceCount: n,
    })),
    teacherUserId: teacher.user_id as string,
    teacherName: teacher.full_name as string,
  }
}

/** Session cookies for a seeded fixture account, without knowing its password. */
async function fixtureSessionCookies(userId: string) {
  const admin = createServiceClient()
  const { data: authUser, error } = await admin.auth.admin.getUserById(userId)
  if (error || !authUser?.user?.email) throw new Error(`[capture] no email for auth user ${userId}`)

  const email = authUser.user.email
  if (!email.endsWith(FIXTURE_EMAIL_DOMAIN)) {
    // Hard stop: this technique is only ever acceptable against the synthetic
    // fixture accounts this repo seeds. It must never touch a real account.
    throw new Error(`[capture] refusing to impersonate ${email} — only ${FIXTURE_EMAIL_DOMAIN} fixture accounts are permitted.`)
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const hashedToken = link?.properties?.hashed_token
  if (linkErr || !hashedToken) throw new Error(`[capture] generateLink failed for ${email}: ${linkErr?.message}`)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const client = createSupabaseJsClient(url, anonKey)
  const { data: verified, error: verifyErr } = await client.auth.verifyOtp({ token_hash: hashedToken, type: 'magiclink' })
  if (verifyErr || !verified.session) throw new Error(`[capture] verifyOtp failed: ${verifyErr?.message}`)

  // Encode the session exactly as @supabase/ssr would set it in a browser,
  // using the library itself rather than hand-rolling the cookie format —
  // same approach as lib/testing/httpAuthTestHelper.ts.
  const jar: Array<{ name: string; value: string }> = []
  const server = createServerClient(url, anonKey, {
    cookies: { getAll: () => [], setAll: cookies => { for (const c of cookies) jar.push({ name: c.name, value: c.value }) } },
  })
  await server.auth.setSession({
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
  })

  const { hostname } = new URL(BASE_URL)
  return jar.map(c => ({ name: c.name, value: c.value, domain: hostname, path: '/' }))
}

async function capture(page: Page, target: Target, outDir: string): Promise<'ok' | 'failed'> {
  const dest = path.join(outDir, target.file)
  try {
    await page.goto(`${BASE_URL}${target.url}`, { waitUntil: 'networkidle', timeout: 90_000 })
  } catch {
    // networkidle can time out on a dev server that keeps a socket open; the
    // page is usually rendered by then, so fall through and check content.
  }

  await page.waitForTimeout(target.settleMs ?? 2_500)

  // Dismiss the first-run tour. This is a real control a real user clicks —
  // not retouching. Leaving it up would cover the screen the slide is about.
  for (const label of ['Explore myself', 'Explore Myself']) {
    const dismiss = page.getByRole('button', { name: label })
    if (await dismiss.count() > 0) {
      try { await dismiss.first().click({ timeout: 3_000 }); await page.waitForTimeout(600) } catch { /* already gone */ }
      break
    }
  }

  if (target.anchorText) {
    const anchor = page.getByText(target.anchorText, { exact: false }).first()
    try {
      await anchor.waitFor({ state: 'visible', timeout: 20_000 })
      // Bring the section to the TOP of the viewport, not merely into view —
      // a slide wants the section framed, not whatever sits above it.
      await anchor.evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior }))
      await page.waitForTimeout(900)
    } catch {
      console.warn(`  ! "${target.anchorText}" not found on ${target.url} — capturing the page as loaded`)
    }
  }

  // Refuse to save a screenshot of a login redirect or an error page: a broken
  // capture that looks plausible is worse than a missing one.
  const url = page.url()
  if (url.includes('/login')) {
    console.error(`  ✗ ${target.file}: redirected to login — session not accepted`)
    return 'failed'
  }
  const bodyText = (await page.textContent('body')) ?? ''
  if (/Application error|500|Internal server error/i.test(bodyText) && bodyText.length < 2_000) {
    console.error(`  ✗ ${target.file}: page rendered an error`)
    return 'failed'
  }

  await page.screenshot({ path: dest, type: 'png' })
  console.log(`  ✓ ${target.file}`)
  return 'ok'
}

async function main() {
  const fixture = await resolveFixture()
  console.log(`Reference school fixture:`)
  console.log(`  teacher: ${fixture.teacherName}   ${fixture.candidates.length} evidenced learners`)
  console.log(`  capturing from ${BASE_URL}\n`)

  await mkdir(OUT_DIR, { recursive: true })

  const cookies = await fixtureSessionCookies(fixture.teacherUserId)

  // Prefer a system Chrome over playwright-core's bundled build: the cached
  // browser revision does not always match the installed playwright-core, and
  // downloading one is not worth it for a screenshot job.
  const systemChrome = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
    .find(p => existsSync(p))
  const browser = await chromium.launch(systemChrome ? { executablePath: systemChrome } : {})
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  })
  await context.addCookies(cookies)
  const page = await context.newPage()

  // Find a learner whose Blueprint actually renders. The Coherence Engine
  // withholds a Blueprint when it finds a contradiction between a
  // recommendation and the learner's own evidence — correct behaviour, but it
  // means not every learner is a usable subject. Rather than guess, try each
  // candidate and take the first that renders.
  let blueprintLearner: { id: string; name: string } | null = null
  for (const candidate of fixture.candidates) {
    await page.goto(`${BASE_URL}/teacher/reports/blueprint/${candidate.id}`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(3_500)
    const text = (await page.textContent('body')) ?? ''
    if (text.includes('Where We Stand Today')) {
      blueprintLearner = candidate
      console.log(`  blueprint subject: ${candidate.name} (${candidate.evidenceCount} evidence rows)`)
      break
    }
  }
  if (!blueprintLearner) {
    console.warn(`  ! no candidate learner has a renderable Blueprint (all withheld by the Coherence Engine)`)
  }

  const targets: Target[] = [
    ...(blueprintLearner ? [
      {
        file: DEMO_ASSETS.blueprintToday,
        url: `/teacher/reports/blueprint/${blueprintLearner.id}`,
        anchorText: 'Where We Stand Today',
        settleMs: 5_000,
      },
      {
        file: DEMO_ASSETS.blueprintNext,
        url: `/teacher/reports/blueprint/${blueprintLearner.id}`,
        anchorText: 'How We Help Next',
        settleMs: 5_000,
      },
      {
        // Slide 7 ("Beyond today's marks") is served by the Blueprint's own
        // career section. The dedicated teacher career route is not used: it
        // authorizes against Core learner enrolments while being handed a
        // legacy student id, so it 403s for any teacher — a product-side
        // identity mismatch this presentation task must not reach into.
        file: DEMO_ASSETS.careerIntelligence,
        url: `/teacher/reports/blueprint/${blueprintLearner.id}`,
        anchorText: 'What May Be Emerging',
        settleMs: 5_000,
      },
    ] : []),
    { file: DEMO_ASSETS.teacherDocuments, url: '/teacher/documents', settleMs: 5_000 },
    { file: DEMO_ASSETS.teacherDashboard, url: '/teacher/dashboard', settleMs: 5_000 },
  ]

  const results: Record<string, string> = {}
  for (const target of targets) {
    results[target.file] = await capture(page, target, OUT_DIR)
  }

  await browser.close()

  const ok = Object.values(results).filter(r => r === 'ok').length
  console.log(`\n${ok} of ${targets.length} captured into public/${DEMO_ASSET_DIR}/`)

  // A short provenance note beside the images, so it is always clear what the
  // deck is showing and that the qualifier on the slide is true.
  await writeFile(
    path.join(OUT_DIR, 'PROVENANCE.txt'),
    [
      'Captured by scripts/captureDemoScreens.ts from the running application.',
      `School:  ${REFERENCE_SCHOOL} (synthetic reference-school fixture)`,
      `Teacher: ${fixture.teacherName} (synthetic)`,
      `Captured: ${new Date().toISOString()}`,
      '',
      'No real learner, teacher, school or guardian appears in these images.',
      'Re-run the script to refresh them after a UI change.',
      '',
    ].join('\n'),
    'utf8',
  )
}

main().catch(err => { console.error(err); process.exitCode = 1 })
