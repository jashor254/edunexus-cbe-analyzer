// lib/testing/sowGenerateContract.http.integration.test.ts
//
// /api/sow/generate request contract — the route must refuse incomplete
// generation context BEFORE a background job exists.
//
// The gap this pins: the route validated `learningArea` and `grade` (which
// generation never reads) but not `learningAreaName` and `gradeName` (which it
// reads unguarded). Omitting either returned 200 + a jobId, then died inside
// the background job as a raw TypeError the caller never saw:
//
//   missing learningAreaName -> "Cannot read properties of undefined (reading 'toLowerCase')"
//   missing gradeName        -> "Cannot read properties of undefined (reading 'replace')"
//
// Route-level, because checkFeatureAccess reads the session through
// next/headers cookies(), which only resolves inside a real Next.js request.
// Run with:
//   npm run dev          (in another shell)
//   npx tsx --env-file=.env.local --test lib/testing/sowGenerateContract.http.integration.test.ts
//
// Assertions are on REJECTION and ZERO JOB CREATION, never on a stack trace.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest } from '@/lib/testing/httpAuthTestHelper'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const MARKER = 'SYNTHETIC_SOWCONTRACT'
const db = createServiceClient()
const ENDPOINT = `${BASE}/api/sow/generate`
const JOB_TYPE = 'ai.sow.generate'

const REFERENCE_SCHOOL_NAME = 'Mwatate Ridge Senior School'

const createdUsers: string[] = []
let teacher: { id: string; cookie: string }

/** A minimal, otherwise-valid request. Individual cases break exactly one field. */
const validBody = () => ({
  context: {
    school:           `${MARKER} School`,
    learningArea:     'Mathematics',
    learningAreaName: 'Mathematics',
    grade:            'Grade 10',
    gradeName:        'Grade 10',
    term:             1,
    year:             2026,
    curriculumMode:   'cbc_senior',
  },
  lessonStructure: { lessonsPerWeek: 2, firstWeek: 1, firstLesson: 1, lastWeek: 1, lastLesson: 2 },
  selectedSubstrands: [{
    strandId: 'num-1', strandTitle: 'Numbers',
    substrandId: 'num-1-1', substrandTitle: 'Real Numbers',
    lessonsRequired: 2, orderIndex: 1,
  }],
  breaks: [],
})

async function call(cookie: string | undefined, body: unknown) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  })
  const raw = await res.text()
  let json: { success?: boolean; data?: Record<string, unknown>; error?: string } = {}
  try { json = JSON.parse(raw) } catch { /* non-JSON */ }
  return { status: res.status, raw, json }
}

const jobCount = async (userId: string) => {
  const { count } = await db.from('jobs')
    .select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('type', JOB_TYPE)
  return count ?? 0
}

before(async () => {
  const email = `sowcontract-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 12)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`createUser: ${error?.message}`)
  createdUsers.push(data.user.id)

  // The route requires a `teachers` row, and profiles.role drives the teacher
  // tier in checkFeatureAccess. With zero prior schemes this user is on the
  // first-SOW-free path, so access PASSES and validation is what rejects —
  // which is the point: rejection must not depend on being unauthorized.
  await db.from('profiles').upsert({ id: data.user.id, role: 'teacher', full_name: `${MARKER} Teacher` })
  await db.from('teachers').insert({ user_id: data.user.id, full_name: `${MARKER} Teacher`, school: `${MARKER} School` })

  const session = await signInForHttpTest(email, password)
  teacher = { id: data.user.id, cookie: session.cookieHeader }
})

after(async () => {
  for (const id of createdUsers) {
    await db.from('jobs').delete().eq('user_id', id)
    await db.from('schemes_of_work').delete().eq('teacher_id', id)
    await db.from('teachers').delete().eq('user_id', id)
    await db.auth.admin.deleteUser(id)
  }
})

// ── The contract gap ─────────────────────────────────────────────────────────

const INVALID_CASES: Array<{ name: string; mutate: (b: ReturnType<typeof validBody>) => void }> = [
  { name: 'missing learningAreaName', mutate: b => { delete (b.context as Record<string, unknown>).learningAreaName } },
  { name: 'blank learningAreaName',   mutate: b => { b.context.learningAreaName = '' } },
  { name: 'whitespace learningAreaName', mutate: b => { b.context.learningAreaName = '   ' } },
  { name: 'missing gradeName',        mutate: b => { delete (b.context as Record<string, unknown>).gradeName } },
  { name: 'blank gradeName',          mutate: b => { b.context.gradeName = '' } },
  { name: 'whitespace gradeName',     mutate: b => { b.context.gradeName = '\t \n' } },
]

test('1. incomplete generation context is rejected, and creates no job', async () => {
  for (const { name, mutate } of INVALID_CASES) {
    const before = await jobCount(teacher.id)

    const body = validBody()
    mutate(body)
    const res = await call(teacher.cookie, body)

    assert.equal(res.status, 400, `"${name}" was not rejected: ${res.raw}`)
    assert.equal(res.json.success, false, `"${name}" reported success`)
    assert.ok(!res.json.data, `"${name}" returned a data payload`)
    assert.ok(!/jobId/.test(res.raw), `"${name}" handed back a jobId`)

    // Settle any (incorrectly) queued background work before counting.
    await new Promise(r => setTimeout(r, 750))
    assert.equal(await jobCount(teacher.id), before,
      `"${name}" created a background job for an invalid request`)
  }
})

test('2. the rejection names the missing field without leaking internals', async () => {
  const body = validBody()
  delete (body.context as Record<string, unknown>).learningAreaName
  const res = await call(teacher.cookie, body)

  assert.match(res.raw, /learningAreaName/, 'the error did not say which field was missing')
  assert.ok(!/toLowerCase|replace|TypeError|at Object|\.ts:\d+/.test(res.raw),
    `internal detail leaked into the response: ${res.raw}`)
})

test('3. a raw TypeError can no longer be produced by omitting these fields', async () => {
  // The two historical background failures, asserted as request-time
  // rejections rather than by matching their old messages.
  for (const field of ['learningAreaName', 'gradeName']) {
    const before = await jobCount(teacher.id)
    const body = validBody()
    delete (body.context as Record<string, unknown>)[field]

    const res = await call(teacher.cookie, body)
    assert.equal(res.status, 400, `omitting ${field} still reached the pipeline`)

    await new Promise(r => setTimeout(r, 750))
    const failed = await db.from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', teacher.id).eq('type', JOB_TYPE).eq('status', 'failed')
    assert.equal(failed.count ?? 0, 0, `omitting ${field} produced a failed background job`)
    assert.equal(await jobCount(teacher.id), before)
  }
})

test('4. the other required context fields are still enforced', async () => {
  for (const field of ['learningArea', 'grade', 'curriculumMode']) {
    const body = validBody()
    delete (body.context as Record<string, unknown>)[field]
    const res = await call(teacher.cookie, body)
    assert.equal(res.status, 400, `omitting ${field} was accepted`)
  }
})

test('5. a complete context is accepted and a job IS created', async () => {
  const before = await jobCount(teacher.id)
  const res = await call(teacher.cookie, validBody())

  assert.equal(res.status, 200, res.raw)
  const data = res.json.data as { jobId: string; total: number }
  assert.ok(data.jobId, 'a valid request did not start a job')
  assert.equal(data.total, 2)
  assert.equal(await jobCount(teacher.id), before + 1)
})

// ── The covered-teacher path, end to end ─────────────────────────────────────

test('6. a school-covered teacher generates lessons and is charged nothing', async () => {
  const { data: ref } = await db.from('schools')
    .select('id').eq('school_name', REFERENCE_SCHOOL_NAME).maybeSingle()
  if (!ref) {
    console.log('      [skip] Reference School not seeded in this environment')
    return
  }

  // An active teacher membership at the entitled school — coverage is
  // inherited from the school, never granted here.
  const { data: membership } = await db.from('school_users')
    .select('user_id').eq('school_id', ref.id).eq('role', 'teacher').eq('is_active', true).limit(1).single()
  const { data: authUser } = await db.auth.admin.getUserById(membership!.user_id)
  const email = authUser.user!.email!

  // Session without touching the account's password.
  const { data: link } = await db.auth.admin.generateLink({ type: 'magiclink', email })
  const { createClient } = await import('@supabase/supabase-js')
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { data: verified } = await anon.auth.verifyOtp({ token_hash: link.properties!.hashed_token!, type: 'magiclink' })

  const { createServerClient } = await import('@supabase/ssr')
  const jar: Array<{ name: string; value: string }> = []
  const server = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => [], setAll: cs => { for (const c of cs) jar.push({ name: c.name, value: c.value }) } },
  })
  await server.auth.setSession({
    access_token: verified.session!.access_token,
    refresh_token: verified.session!.refresh_token,
  })
  const cookie = jar.map(c => `${c.name}=${c.value}`).join('; ')

  // Pricing first: covered, free, nothing to deduct.
  const priceRes = await fetch(`${BASE}/api/tokens/check`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ feature: 'sow_generate' }),
  })
  const price = await priceRes.json()
  assert.equal(price.tier, 'teacher', 'the covered teacher was not on the school tier')
  assert.equal(price.deductTokens, false)
  assert.equal(price.cost, 0)

  const { data: balBefore } = await db.from('token_balances').select('balance').eq('user_id', membership!.user_id)

  const res = await call(cookie, validBody())
  assert.equal(res.status, 200, res.raw)
  const jobId = (res.json.data as { jobId: string }).jobId

  // Generation runs in the background — poll to completion.
  let job: { status: string; result: unknown } | null = null
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const { data } = await db.from('jobs').select('status, result').eq('id', jobId).single()
    job = data
    if (data?.status === 'completed' || data?.status === 'failed') break
  }
  assert.equal(job?.status, 'completed', `generation did not complete: ${JSON.stringify(job?.result)}`)
  const result = job!.result as { result: { status: string; lessons: unknown[] } }
  assert.equal(result.result.status, 'complete')
  assert.ok(result.result.lessons.length > 0, 'a completed job produced no lessons')

  const { data: balAfter } = await db.from('token_balances').select('balance').eq('user_id', membership!.user_id)
  assert.deepEqual(balAfter, balBefore, 'a school-covered teacher was charged for a scheme of work')

  await db.from('jobs').delete().eq('id', jobId)
})
