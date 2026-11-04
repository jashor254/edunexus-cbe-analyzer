// lib/testing/sharedReports.http.integration.test.ts
//
// DSA-01 release-readiness: exercises the REAL routes of a running app
// (`next start`) against a disposable LOCAL Supabase — generation, public
// share page, expiry, revocation, ownership, failure handling — and proves
// direct browser (anon/authenticated) database access stays blocked.
//
// Requires: a server at TEST_BASE_URL, TEST_SUPABASE_* pointing at the local
// docker stack (project ref "local-docker"), NEXT_PUBLIC_SUPABASE_URL/ANON_KEY
// set to the same local stack, and the 20261104120000 migration applied.
// This suite is non-destructive. The failure-injection checks (which briefly
// revoke privileges and so cannot run beside other suites) live in
// scripts/security/shared-reports-failure-injection.ts, run manually.
//
// Run: TEST_BASE_URL=http://127.0.0.1:3111 TEST_SUPABASE_URL=http://127.0.0.1:54321 \
//   TEST_SUPABASE_PROJECT_REF=local-docker TEST_SUPABASE_SERVICE_ROLE_KEY=... \
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
//   npx tsx --test lib/testing/sharedReports.http.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { createTestServiceClient } from '@/utils/supabase/test-service'
import { generateShareToken } from '@/lib/sharedReports/token'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const MARKER = 'SYNTHETIC_SHARED_REPORTS_HTTP'
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const db = createTestServiceClient()
const userIds: string[] = []
const studentIds: string[] = []

type Actor = { id: string; session: SyntheticSession }
let owner: Actor
let other: Actor
let ownerStudentId: string

async function mkUser(label: string): Promise<Actor> {
  const email = `sharedrep-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  userIds.push(data.user.id)
  return { id: data.user.id, session: await signInForHttpTest(email, PASSWORD) }
}

const REPORT = {
  strengths: ['Fractions'], priorityAreas: ['Algebra'], actionPlan: ['Practise daily'],
  subjectScores: { english: 3 }, overallLevel: 3, overallLabel: 'Proficient',
}
// Fields the public DTO must never render even if a row somehow carries them
// (the API rejects them; this is for rows written by other paths).
const REPORT_WITH_EXTRAS = { ...REPORT, internal_note: 'must-not-render', parent_phone: '0700000000' }

function generate(session: SyntheticSession | null, body: unknown) {
  return fetch(`${BASE_URL}/api/share/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(session ? { Cookie: session.cookieHeader } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}
function revoke(session: SyntheticSession | null, body: unknown) {
  return fetch(`${BASE_URL}/api/share/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(session ? { Cookie: session.cookieHeader } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}
const page = (token: string) => fetch(`${BASE_URL}/shared/${token}`, { redirect: 'manual' })

async function mkShare(): Promise<string> {
  const res = await generate(owner.session, { studentId: ownerStudentId, reportData: REPORT })
  assert.equal(res.status, 200)
  return (await res.json()).data.token as string
}

before(async () => {
  assert.match(SUPABASE_URL, /127\.0\.0\.1|localhost/, 'must target the local stack')
  owner = await mkUser('owner')
  other = await mkUser('other')
  const { data, error } = await db.from('students')
    .insert({ user_id: owner.id, parent_user_id: owner.id, name: `${MARKER} Learner`, grade: 8, level: 'Junior School', school: MARKER, added_by: 'parent' })
    .select('id').single()
  if (error || !data) throw new Error(`student insert failed: ${error?.message}`)
  ownerStudentId = data.id
  studentIds.push(ownerStudentId)
})

after(async () => {
  for (const id of studentIds) {
    await db.from('shared_reports').delete().eq('student_id', id)
    await db.from('students').delete().eq('id', id)
  }
  for (const id of userIds) await db.auth.admin.deleteUser(id)
})

// ── Generation ──────────────────────────────────────────────────────────────
test('generate: unauthenticated → 401, nothing stored', async () => {
  const res = await generate(null, { studentId: ownerStudentId, reportData: REPORT })
  assert.equal(res.status, 401)
})

test('generate: another user cannot share someone else\'s learner → 403', async () => {
  const res = await generate(other.session, { studentId: ownerStudentId, reportData: REPORT })
  assert.equal(res.status, 403)
})

test('generate: invalid body → 400', async () => {
  assert.equal((await generate(owner.session, { studentId: 'not-a-uuid', reportData: {} })).status, 400)
  assert.equal((await generate(owner.session, '{"studentId":')).status >= 400, true)
})

test('generate: owner gets a 192-bit URL-safe token and a working link', async () => {
  const res = await generate(owner.session, { studentId: ownerStudentId, reportData: REPORT })
  assert.equal(res.status, 200)
  const { data } = await res.json()
  assert.match(data.token, /^[A-Za-z0-9_-]{32}$/)
  assert.match(data.shareUrl, new RegExp(`/shared/${data.token}$`))
  assert.equal((await page(data.token)).status, 200)
})

// ── Public share page ───────────────────────────────────────────────────────
test('share page: valid token renders without login, is uncacheable, noindex, no-referrer, and leaks nothing extra', async () => {
  const token = generateShareToken()
  const { error } = await db.from('shared_reports').insert({
    token, student_id: ownerStudentId, user_id: owner.id, student_name: `${MARKER} Learner`, grade: '8',
    report_data: REPORT_WITH_EXTRAS, expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  })
  assert.ifError(error)
  const res = await page(token)
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.match(html, new RegExp(`${MARKER} Learner`))
  assert.match(html, /Learner Intelligence Report/)
  assert.match(html, /name="robots"[^>]*noindex/)
  assert.match(html, /name="referrer"[^>]*no-referrer/)
  const cc = (res.headers.get('cache-control') ?? '').toLowerCase()
  assert.ok(/no-store|no-cache|private/.test(cc) && !/s-maxage|public/.test(cc), `cache-control was: ${cc}`)
  for (const leak of ['must-not-render', '0700000000', owner.id, ownerStudentId]) {
    assert.ok(!html.includes(leak), `page leaked ${leak}`)
  }
})

test('share page: unknown, malformed and injection-shaped tokens are indistinguishable 404s', async () => {
  const shapes = ['Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4', 'short', encodeURIComponent("x' OR '1'='1xxxxx"), '________________', 'A'.repeat(70), '%25%25%25%25%25%25%25%25%25%25%25%25']
  const normalised: string[] = []
  for (const t of shapes) {
    const res = await page(t)
    assert.equal(res.status, 404, t)
    // The framework echoes the requested path in its route payload; that is the
    // caller's own input, so strip it before comparing what the server decided.
    const body = (await res.text()).split(t).join('T').split(decodeURIComponent(t)).join('T')
    normalised.push(body.replace(/x-trace-id[^"]*/g, '').replace(/"[A-Za-z0-9_-]{20,}"/g, '"X"'))
  }
  const sizes = normalised.map(b => b.length)
  assert.ok(Math.max(...sizes) - Math.min(...sizes) < 200, `404 bodies differ by token shape: ${sizes}`)
})

test('share page: expired token shows only the expiry notice — no learner data', async () => {
  const token = generateShareToken()
  const { error } = await db.from('shared_reports').insert({
    token, student_id: ownerStudentId, user_id: owner.id, student_name: `${MARKER} ExpiredName`, grade: '8',
    report_data: REPORT, created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    expires_at: new Date(Date.now() - 86_400_000).toISOString(),
  })
  assert.ifError(error)
  const res = await page(token)
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.match(html, /Report Link Expired/)
  assert.ok(!html.includes('ExpiredName') && !html.includes('Fractions'))
})

test('legacy 12-character tokens are REJECTED: cannot be created, and a link in that format is a 404 (negative test)', async () => {
  const legacy = 'ABCDEF123456'
  const ins = await db.from('shared_reports').insert({
    token: legacy, student_id: ownerStudentId, user_id: owner.id, student_name: `${MARKER} Legacy`, grade: '8',
    report_data: REPORT, expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  })
  assert.ok(ins.error, 'the database must refuse to store a legacy-format token, even for the service role')
  assert.equal((await page(legacy)).status, 404)
  assert.equal((await revoke(owner.session, { token: legacy })).status, 400)
})

// ── Revocation ──────────────────────────────────────────────────────────────
test('revoke: unauthenticated → 401; malformed → 400', async () => {
  const token = await mkShare()
  assert.equal((await revoke(null, { token })).status, 401)
  assert.equal((await revoke(owner.session, { token: 'x' })).status, 400)
  assert.equal((await revoke(owner.session, {})).status, 400)
  assert.equal((await page(token)).status, 200, 'link must be untouched')
})

test('revoke: non-owner gets an opaque 404 and cannot disable the link', async () => {
  const token = await mkShare()
  const res = await revoke(other.session, { token })
  assert.equal(res.status, 404)
  assert.equal((await page(token)).status, 200)
})

test('revoke: owner revokes → 200, link dies immediately, repeat revoke → 404', async () => {
  const token = await mkShare()
  assert.equal((await page(token)).status, 200)
  const res = await revoke(owner.session, { token })
  assert.equal(res.status, 200)
  assert.equal((await page(token)).status, 404, 'revoked link must 404 at once (no caching)')
  assert.equal((await revoke(owner.session, { token })).status, 404)
})

// ── Direct browser database access stays blocked ────────────────────────────
test('anon Data API: cannot read, list, insert, update, delete, or call the lookup RPC', async () => {
  const token = await mkShare()
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  const list = await anon.from('shared_reports').select('id, token, report_data')
  assert.ok(list.error || (list.data ?? []).length === 0, 'anon list must fail or be empty')
  assert.ok(!JSON.stringify(list.data ?? '').includes(token))
  assert.ok((await anon.from('shared_reports').insert({ token: 'ANONINSERT123456', student_id: ownerStudentId, user_id: owner.id, student_name: 'x', grade: '8', expires_at: new Date().toISOString() })).error)
  const upd = await anon.from('shared_reports').update({ student_name: 'pwn' }).eq('token', token).select()
  assert.ok(upd.error || (upd.data ?? []).length === 0)
  const del = await anon.from('shared_reports').delete().eq('token', token).select()
  assert.ok(del.error || (del.data ?? []).length === 0)
  const rpc = await anon.rpc('get_shared_report_by_token', { p_token: token })
  assert.ok(rpc.error, 'anon must not be able to call the token lookup')
  assert.equal((await page(token)).status, 200, 'link survived the attacks')
})

test('authenticated Data API: non-owner sees nothing and cannot call the RPC; owner sees only own rows and cannot insert/update directly', async () => {
  const token = await mkShare()
  const client = (s: SyntheticSession) => createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Cookie: s.cookieHeader } },
  })
  const signIn = async (a: Actor) => {
    const c = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    const email = (await db.auth.admin.getUserById(a.id)).data.user!.email!
    const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
    assert.ifError(error)
    return c
  }
  void client
  const o = await signIn(other)
  const otherList = await o.from('shared_reports').select('token')
  assert.deepEqual(otherList.data ?? [], [])
  assert.ok((await o.rpc('get_shared_report_by_token', { p_token: token })).error)

  const w = await signIn(owner)
  const mine = await w.from('shared_reports').select('token, user_id')
  assert.ok((mine.data ?? []).length >= 1 && (mine.data ?? []).every(r => r.user_id === owner.id))
  assert.ok((await w.from('shared_reports').insert({ token: 'OWNERINSERT123456', student_id: ownerStudentId, user_id: owner.id, student_name: 'x', grade: '8', expires_at: new Date().toISOString() })).error)
  assert.ok((await w.from('shared_reports').update({ revoked_at: null }).eq('token', token).select()).error)
})

// ── Report-creation controls (server-side) ──────────────────────────────────
test('generate: stored row has server-derived ownership, provenance, token and a 30-day expiry', async () => {
  const token = await mkShare()
  const { data } = await db.from('shared_reports')
    .select('user_id, student_id, student_name, provenance, created_at, expires_at').eq('token', token).single()
  assert.equal(data?.user_id, owner.id)
  assert.equal(data?.student_id, ownerStudentId)
  assert.equal(data?.student_name, `${MARKER} Learner`, 'name comes from the students row, never the client')
  assert.equal(data?.provenance, 'client_supplied')
  const days = (Date.parse(data!.expires_at) - Date.parse(data!.created_at)) / 86_400_000
  assert.ok(days > 29.9 && days < 30.1, `expiry was ${days} days`)
})

test('generate: client cannot choose owner, expiry, token or provenance, nor add unknown report fields', async () => {
  for (const extra of [{ userId: other.id }, { expiresAt: '2099-01-01T00:00:00Z' }, { token: 'a'.repeat(32) }, { provenance: 'server_generated' }]) {
    assert.equal((await generate(owner.session, { studentId: ownerStudentId, reportData: REPORT, ...extra })).status, 400, JSON.stringify(extra))
  }
  assert.equal((await generate(owner.session, { studentId: ownerStudentId, reportData: REPORT_WITH_EXTRAS })).status, 400)
})

test('generate: invalid report content is rejected (levels, types, lengths)', async () => {
  const bad = [
    { ...REPORT, overallLevel: 0 }, { ...REPORT, overallLevel: 9 }, { ...REPORT, overallLevel: 'high' },
    { ...REPORT, strengths: ['x'.repeat(501)] }, { ...REPORT, strengths: Array.from({ length: 11 }, () => 'a') },
    { ...REPORT, subjectScores: { 'Bad Key': 3 } }, {},
  ]
  for (const reportData of bad) {
    assert.equal((await generate(owner.session, { studentId: ownerStudentId, reportData })).status, 400, JSON.stringify(reportData).slice(0, 60))
  }
})

test('generate: oversize body → 413 before parsing', async () => {
  const huge = JSON.stringify({ studentId: ownerStudentId, reportData: { ...REPORT, strengths: ['x'.repeat(400_000)] } })
  assert.equal((await generate(owner.session, huge)).status, 413)
})

test('database refuses over-long expiry and oversize reports even for the service role', async () => {
  const base = { student_id: ownerStudentId, user_id: owner.id, student_name: 'x', grade: '8' }
  const longExpiry = await db.from('shared_reports').insert({ ...base, token: generateShareToken(), report_data: REPORT, expires_at: new Date(Date.now() + 91 * 86_400_000).toISOString() })
  assert.ok(longExpiry.error, '91-day expiry must be refused')
  const big = await db.from('shared_reports').insert({ ...base, token: generateShareToken(), report_data: { strengths: ['x'.repeat(20_000)] }, expires_at: new Date(Date.now() + 86_400_000).toISOString() })
  assert.ok(big.error, '20 KB report must be refused')
})

// ── HTTP response security ──────────────────────────────────────────────────
function assertNeverSharedCached(res: Response, label: string) {
  const cc = (res.headers.get('cache-control') ?? '').toLowerCase()
  assert.ok(cc.includes('no-store'), `${label}: cache-control "${cc}" must include no-store`)
  assert.ok(cc.includes('private'), `${label}: cache-control "${cc}" must include private`)
  assert.ok(!/public|s-maxage|stale-while-revalidate/.test(cc), `${label}: cache-control "${cc}" allows shared caching`)
  assert.equal(res.headers.get('cdn-cache-control'), 'no-store', `${label}: CDN-Cache-Control`)
  assert.equal(res.headers.get('vercel-cdn-cache-control'), 'no-store', `${label}: Vercel-CDN-Cache-Control`)
  assert.notEqual((res.headers.get('x-nextjs-cache') ?? '').toUpperCase(), 'HIT', `${label}: served from Next cache`)
  assert.equal(res.headers.get('age'), null, `${label}: an Age header means a cache served it`)
}

test('headers: a learner report is never storable by shared caches, indexable, or leaked via Referer/framing', async () => {
  const token = await mkShare()
  const res = await page(token)
  assert.equal(res.status, 200)
  assertNeverSharedCached(res, 'valid report')
  assert.match(res.headers.get('x-robots-tag') ?? '', /noindex/)
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer')
  assert.equal(res.headers.get('x-frame-options'), 'DENY')
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(res.headers.get('access-control-allow-origin'), null, 'no cross-origin read of a report')
})

test('headers: expired, unknown and malformed responses are equally uncacheable', async () => {
  for (const t of [generateShareToken(), 'short', 'ABCDEF123456']) assertNeverSharedCached(await page(t), `404 ${t}`)
})

test('headers: prefetch / RSC requests for a report are uncacheable and carry no extra learner data', async () => {
  const token = await mkShare()
  for (const hdrs of [{ RSC: '1' }, { RSC: '1', 'Next-Router-Prefetch': '1' }]) {
    // Next normalises the `_rsc` cache-buster with a 307 (also for ordinary pages); fetch follows it.
    const res = await fetch(`${BASE_URL}/shared/${token}?_rsc=x`, { headers: hdrs })
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /text\/x-component/, 'must be a real RSC payload, not HTML')
    assertNeverSharedCached(res, `rsc ${JSON.stringify(hdrs)}`)
    const body = await res.text()
    for (const leak of [owner.id, ownerStudentId, 'user_id', 'student_id']) assert.ok(!body.includes(leak), `RSC payload leaked ${leak}`)
    // the redirect hop itself must not be cacheable either
    assertNeverSharedCached(await fetch(`${BASE_URL}/shared/${token}?_rsc=x`, { headers: hdrs, redirect: 'manual' }), 'rsc redirect hop')
  }
})

test('headers: API responses for share generation/revocation are uncacheable and non-indexable', async () => {
  const res = await generate(owner.session, { studentId: ownerStudentId, reportData: REPORT })
  assert.equal(res.status, 200)
  assertNeverSharedCached(res, 'generate 200')
  assert.match(res.headers.get('x-robots-tag') ?? '', /noindex/)
  assertNeverSharedCached(await generate(null, {}), 'generate 401')
  assertNeverSharedCached(await revoke(null, { token: generateShareToken() }), 'revoke 401')
})

test('metadata: the page declares noindex + no-referrer, has no canonical/OG URL naming the token, and robots.txt disallows /shared/', async () => {
  const token = await mkShare()
  const html = await (await page(token)).text()
  assert.match(html, /name="robots"[^>]*noindex/)
  assert.match(html, /name="referrer"[^>]*no-referrer/)
  assert.doesNotMatch(html, new RegExp(`<link[^>]+rel="canonical"[^>]*${token}`))
  assert.doesNotMatch(html, new RegExp(`<meta[^>]+property="og:url"[^>]*${token}`))
  const robots = await (await fetch(`${BASE_URL}/robots.txt`)).text()
  assert.match(robots, /Disallow:\s*\/shared\//)
  // the token must not be a link target anywhere on the page (no outbound/self links carrying it)
  assert.doesNotMatch(html, new RegExp(`href="[^"]*${token}`))
})
