// app/api/cron/auto-publish-holiday-plans/route.test.ts
//
// HLG-05 containment: automatic publication of holiday plans is disabled by
// default and only an exact documented value enables it. Isolated mocks only —
// no database, no network, no credentials, no live cron endpoint.
//
// mock.module is registered BEFORE ./route is imported, so the real
// @/lib/repositories singleton (which eagerly constructs database clients) and
// @/lib/holiday/planner (AI/provider imports) never load in this process. A
// single mutable `calls` object, because node:test's mock.module is unreliable
// across repeated mock/restore cycles (same constraint as
// app/api/webhooks/whatsapp/route.test.ts).
//
// Run: npm test -- app/api/cron/auto-publish-holiday-plans/route.test.ts

import { test, before, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'

const FLAG = 'HOLIDAY_AUTO_PUBLISH_ENABLED'
const SECRET = 'hlg05-test-cron-secret'

type StalePlan = { id: string; teacher_id: string | null; student_id: string; term: number; year: number }

const calls = {
  find: [] as string[],
  publish: [] as string[][],
  emit: [] as Array<{ trigger: string; studentIds: string[] }>,
}
let stale: StalePlan[] = []

mock.module('@/lib/repositories', {
  namedExports: {
    repos: {
      learnerIntelligence: {
        findDraftHolidayPlansOlderThan: async (cutoff: string) => { calls.find.push(cutoff); return stale },
        publishHolidayPlanIds: async (ids: string[]) => { calls.publish.push(ids) },
      },
    },
  },
})

mock.module('@/lib/holiday/planner', {
  namedExports: {
    emitHolidayPlanPublished: (input: { trigger: string; studentIds: string[] }) => {
      calls.emit.push({ trigger: input.trigger, studentIds: input.studentIds })
    },
  },
})

let GET: (req: Request) => Promise<Response>
let POST: (req: Request) => Promise<Response>

before(async () => {
  process.env.CRON_SECRET = SECRET
  const route = await import('./route')
  GET = route.GET
  POST = route.POST
})

const savedFlag = process.env[FLAG]
beforeEach(() => {
  process.env.CRON_SECRET = SECRET
  delete process.env[FLAG]
  calls.find.length = 0
  calls.publish.length = 0
  calls.emit.length = 0
  stale = [
    { id: 'plan-1', teacher_id: 't-1', student_id: 's-1', term: 2, year: 2026 },
    { id: 'plan-2', teacher_id: 't-1', student_id: 's-2', term: 2, year: 2026 },
  ]
})
afterEach(() => {
  if (savedFlag === undefined) delete process.env[FLAG]
  else process.env[FLAG] = savedFlag
})

const url = 'http://localhost/api/cron/auto-publish-holiday-plans'
const authedGet = () => GET(new NextRequest(url, { headers: { authorization: `Bearer ${SECRET}` } }))
const authedPost = () => POST(new NextRequest(url, { method: 'POST', headers: { 'x-cron-secret': SECRET } }))
type Body = { success: boolean; data: { published: number; disabled?: boolean } | null; error: string | null }
const body = async (res: Response): Promise<Body> => (await res.json()) as Body
const noRepoOrEmitCalls = () => {
  assert.equal(calls.find.length, 0, 'selection query must not run')
  assert.equal(calls.publish.length, 0, 'publication must not run')
  assert.equal(calls.emit.length, 0, 'no publication event may be emitted')
}

// ── Default and invalid flag values: DISABLED ──────────────────────────────

test('flag missing ⇒ disabled by default, for GET and POST; no repository call', async () => {
  assert.equal(process.env[FLAG], undefined)
  for (const call of [authedGet, authedPost]) {
    const res = await call()
    assert.equal(res.status, 200)
    const b = await body(res)
    assert.deepEqual(b.data, { published: 0, disabled: true })
  }
  noRepoOrEmitCalls()
})

test('invalid or near-miss flag values are disabled (only the exact string "true" enables)', async () => {
  for (const value of ['', 'TRUE', 'True', '1', 'yes', 'on', 'enabled', ' true', 'true ', 'true\n', 'false', '0', 'tru', 'truee']) {
    process.env[FLAG] = value
    for (const call of [authedGet, authedPost]) {
      const b = await body(await call())
      assert.deepEqual(b.data, { published: 0, disabled: true }, `value ${JSON.stringify(value)} must be disabled`)
    }
  }
  noRepoOrEmitCalls()
})

// ── Explicit enabling value: existing authorized pathway runs ──────────────

test('flag = "true" permits the existing authorized pathway (GET and POST behave identically)', async () => {
  process.env[FLAG] = 'true'

  const get = await authedGet()
  assert.equal(get.status, 200)
  assert.deepEqual((await body(get)).data, { published: 2 })
  assert.equal(calls.find.length, 1)
  assert.deepEqual(calls.publish, [['plan-1', 'plan-2']])
  assert.deepEqual(calls.emit.map(e => e.trigger), ['auto', 'auto'])

  calls.find.length = 0; calls.publish.length = 0; calls.emit.length = 0
  const post = await authedPost()
  assert.equal(post.status, 200)
  assert.deepEqual((await body(post)).data, { published: 2 })
  assert.equal(calls.find.length, 1)
  assert.deepEqual(calls.publish, [['plan-1', 'plan-2']])
})

test('enabled with no stale drafts publishes nothing and emits nothing', async () => {
  process.env[FLAG] = 'true'
  stale = []
  assert.deepEqual((await body(await authedGet())).data, { published: 0 })
  assert.equal(calls.publish.length, 0)
  assert.equal(calls.emit.length, 0)
})

test('the 3-day grace cutoff is unchanged when enabled', async () => {
  process.env[FLAG] = 'true'
  const before = Date.now()
  await authedGet()
  const cutoff = new Date(calls.find[0]).getTime()
  const threeDays = 3 * 24 * 60 * 60 * 1000
  assert.ok(Math.abs((before - cutoff) - threeDays) < 5_000)
})

// ── Authorization remains intact in every flag state ───────────────────────

test('unauthorized callers are blocked (401) with the flag off AND on, for GET and POST; zero repository calls', async () => {
  for (const flag of [undefined, 'true']) {
    if (flag === undefined) delete process.env[FLAG]; else process.env[FLAG] = flag

    const getCases = [
      new NextRequest(url),                                                         // no header
      new NextRequest(url, { headers: { authorization: 'Bearer wrong' } }),         // wrong secret
      new NextRequest(url, { headers: { authorization: SECRET } }),                 // missing Bearer
      new NextRequest(url, { headers: { 'x-cron-secret': SECRET } }),               // POST-style header on GET
      new NextRequest(url, { headers: { 'x-vercel-cron': '1' } }),                  // the retired header bypass
    ]
    for (const req of getCases) assert.equal((await GET(req)).status, 401, `GET flag=${flag}`)

    const postCases = [
      new NextRequest(url, { method: 'POST' }),
      new NextRequest(url, { method: 'POST', headers: { 'x-cron-secret': 'wrong' } }),
      new NextRequest(url, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } }), // GET-style header on POST
    ]
    for (const req of postCases) assert.equal((await POST(req)).status, 401, `POST flag=${flag}`)
  }
  noRepoOrEmitCalls()
})

test('auth is checked before the gate: an unauthorized caller never learns the flag state', async () => {
  const off = await body(await GET(new NextRequest(url)))
  process.env[FLAG] = 'true'
  const on = await body(await GET(new NextRequest(url)))
  assert.equal(off.error, on.error)
  assert.equal(off.data, null)
  assert.equal(on.data, null)
})

// ── HLG-05B: authentication fails CLOSED when the secret is not usable ─────

type SecretState = { label: string; value: string | undefined }
const BAD_SECRET_STATES: SecretState[] = [
  { label: 'missing', value: undefined },
  { label: 'empty', value: '' },
  { label: 'spaces only', value: '   ' },
  { label: 'tab/newline only', value: '\t\n ' },
  { label: 'literal "undefined"', value: 'undefined' },
  { label: 'literal "null"', value: 'null' },
]
function setSecret(value: string | undefined) {
  if (value === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = value
}
const getWith = (authorization?: string) =>
  GET(new NextRequest(url, authorization === undefined ? {} : { headers: { authorization } }))
const postWith = (secret?: string) =>
  POST(new NextRequest(url, secret === undefined ? { method: 'POST' } : { method: 'POST', headers: { 'x-cron-secret': secret } }))

test('missing / empty / whitespace-only / literal "undefined" or "null" secret: NO request authenticates (GET and POST), flag off and on', async () => {
  const credentialsGet = [undefined, '', 'Bearer', 'Bearer ', 'Bearer   ', 'Bearer undefined', 'Bearer null', 'Bearer wrong', 'undefined', 'null']
  const credentialsPost = [undefined, '', ' ', 'undefined', 'null', 'wrong']
  for (const state of BAD_SECRET_STATES) {
    for (const flag of [undefined, 'true']) {
      setSecret(state.value)
      if (flag === undefined) delete process.env[FLAG]; else process.env[FLAG] = flag
      for (const c of credentialsGet) {
        assert.equal((await getWith(c)).status, 401, `GET secret=${state.label} flag=${flag} credential=${JSON.stringify(c)}`)
      }
      for (const c of credentialsPost) {
        assert.equal((await postWith(c)).status, 401, `POST secret=${state.label} flag=${flag} credential=${JSON.stringify(c)}`)
      }
      // A caller echoing the bad configured value back must not get in either.
      if (state.value !== undefined && state.value.trim() !== '') {
        assert.equal((await getWith(`Bearer ${state.value}`)).status, 401, `GET echo of ${state.label}`)
        assert.equal((await postWith(state.value)).status, 401, `POST echo of ${state.label}`)
      }
    }
  }
  noRepoOrEmitCalls()
})

test('literal "Bearer undefined" never authenticates, even when a real secret is configured', async () => {
  setSecret(SECRET)
  assert.equal((await getWith('Bearer undefined')).status, 401)
  assert.equal((await getWith('Bearer null')).status, 401)
  assert.equal((await postWith('undefined')).status, 401)
  noRepoOrEmitCalls()
})

test('incorrect secret fails; correct secret succeeds (disabled by default; executes when explicitly enabled)', async () => {
  setSecret(SECRET)
  assert.equal((await getWith('Bearer not-the-secret')).status, 401)
  assert.equal((await postWith('not-the-secret')).status, 401)
  assert.equal((await getWith(`bearer ${SECRET}`)).status, 401, 'scheme is case-sensitive, as before')
  noRepoOrEmitCalls()

  // correct secret, publication disabled ⇒ authenticated but inert
  assert.deepEqual((await body(await getWith(`Bearer ${SECRET}`))).data, { published: 0, disabled: true })
  assert.deepEqual((await body(await postWith(SECRET))).data, { published: 0, disabled: true })
  noRepoOrEmitCalls()

  // correct secret, publication explicitly enabled ⇒ existing behaviour preserved
  process.env[FLAG] = 'true'
  assert.deepEqual((await body(await getWith(`Bearer ${SECRET}`))).data, { published: 2 })
  assert.equal(calls.publish.length, 1)
})

test('GET and POST are consistent across the whole secret × flag × credential matrix; auth always precedes the gate', async () => {
  const secretStates: SecretState[] = [...BAD_SECRET_STATES, { label: 'valid', value: SECRET }]
  for (const state of secretStates) {
    for (const flag of [undefined, 'garbage', 'true']) {
      for (const cred of ['none', 'wrong', 'undefined', 'correct'] as const) {
        setSecret(state.value)
        if (flag === undefined) delete process.env[FLAG]; else process.env[FLAG] = flag
        calls.find.length = 0; calls.publish.length = 0; calls.emit.length = 0

        const getHeader = cred === 'none' ? undefined : cred === 'wrong' ? 'Bearer wrong' : cred === 'undefined' ? 'Bearer undefined' : `Bearer ${SECRET}`
        const postHeader = cred === 'none' ? undefined : cred === 'wrong' ? 'wrong' : cred === 'undefined' ? 'undefined' : SECRET

        const g = await getWith(getHeader)
        const gCalls = calls.find.length
        calls.find.length = 0; calls.publish.length = 0; calls.emit.length = 0
        const p = await postWith(postHeader)
        const pCalls = calls.find.length

        const label = `secret=${state.label} flag=${flag} cred=${cred}`
        const authorized = state.value === SECRET && cred === 'correct'
        assert.equal(g.status, authorized ? 200 : 401, `GET ${label}`)
        assert.equal(p.status, g.status, `GET/POST status parity ${label}`)
        const expectedRepoCalls = authorized && flag === 'true' ? 1 : 0
        assert.equal(gCalls, expectedRepoCalls, `GET repo calls ${label}`)
        assert.equal(pCalls, expectedRepoCalls, `POST repo calls ${label}`)
      }
    }
  }
})

test('responses never contain the secret value (401, disabled 200, enabled 200)', async () => {
  const secret = 'hlg05b-secret-that-must-not-appear-in-any-response'
  setSecret(secret)
  const bodies: string[] = []
  bodies.push(await (await getWith('Bearer wrong')).text())
  bodies.push(await (await postWith('wrong')).text())
  bodies.push(await (await getWith(`Bearer ${secret}`)).text())
  process.env[FLAG] = 'true'
  bodies.push(await (await getWith(`Bearer ${secret}`)).text())
  bodies.push(await (await postWith(secret)).text())
  for (const b of bodies) assert.equal(b.includes(secret), false)
})

// ── Scheduled invocation removed; other crons untouched ────────────────────

test('vercel.json no longer schedules the holiday auto-publish path; every other cron is unchanged', () => {
  const config = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as { crons: Array<{ path: string; schedule: string }> }
  const byPath = new Map(config.crons.map(c => [c.path, c.schedule]))

  assert.equal(byPath.has('/api/cron/auto-publish-holiday-plans'), false, 'holiday auto-publish must not be scheduled')
  assert.equal(config.crons.some(c => c.path.includes('holiday')), false)

  // Pinned exactly as they were before this change.
  assert.equal(byPath.get('/api/cron/friday-generation'), '0 15 * * 5')
  assert.equal(byPath.get('/api/cron/generate-record-of-work'), '0 3 * * 1')
  assert.equal(byPath.get('/api/cron/ai-log-retention'), '0 4 * * *')
})
