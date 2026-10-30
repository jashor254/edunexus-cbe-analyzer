// scripts/security/route-auth-rules.test.ts
// Unit tests for the route-auth security gate rules (scripts/check-route-auth.mjs).
// Pure string fixtures — no filesystem, network, or credentials.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkRouteAuth, hasDirectGuard, callsAny, reexportTarget, SERVICE_CLIENT_FACTORY } from './route-auth-rules.mjs'

// Fixtures name the RLS-bypassing client factory through the rule's own
// config — these are text fixtures; nothing here ever constructs a client.
const SVC = SERVICE_CLIENT_FACTORY

type Route = { key: string; source: string }

const GUARDED = `export async function GET() { const user = await requireAuthentication(supabase); return ok(user) }`
const UNGUARDED = `export async function GET() { return ok(await listEverything()) }`

function run(routes: Route[], registry: Record<string, object> = {}, ownershipRegistry: Record<string, object> = {}) {
  return checkRouteAuth({ routes, registry, ownershipRegistry })
}
const rules = (r: ReturnType<typeof run>) => r.violations.map(v => v.rule)

// ── Guard detection ──────────────────────────────────────────────────────────

test('hasDirectGuard: recognises a known guard call', () => {
  assert.equal(hasDirectGuard(GUARDED), true)
  assert.equal(hasDirectGuard('const { data } = await supabase.auth.getUser()'), true)
})

test('callsAny: does not match a longer identifier that merely starts with the guard name', () => {
  assert.equal(callsAny('requireAuthentication(c)', ['requireAuth']), false)
  assert.equal(callsAny('myrequireAuth(c)', ['requireAuth']), false)
  assert.equal(callsAny('requireAuth(c)', ['requireAuth']), true)
})

test('reexportTarget: extracts the route key of a re-export', () => {
  assert.equal(reexportTarget(`export { GET, POST } from '@/app/api/webhooks/whatsapp/route'`), 'webhooks/whatsapp')
  assert.equal(reexportTarget(GUARDED), null)
})

// ── unguarded-route ──────────────────────────────────────────────────────────

test('a guarded route passes', () => {
  assert.deepEqual(rules(run([{ key: 'teacher/classes', source: GUARDED }])), [])
})

test('an unguarded, unregistered route fails', () => {
  assert.deepEqual(rules(run([{ key: 'teacher/classes', source: UNGUARDED }])), ['unguarded-route'])
})

test('a guard that only appears in a comment does not count', () => {
  const src = `// TODO: add requireAuthentication(supabase)\n${UNGUARDED}`
  assert.deepEqual(rules(run([{ key: 'teacher/classes', source: src }])), ['unguarded-route'])
})

// ── registry kinds ───────────────────────────────────────────────────────────

test('public: a registered public route passes', () => {
  const r = run([{ key: 'health', source: UNGUARDED }], { health: { kind: 'public', reason: 'uptime', reviewed: '2026-10-12' } })
  assert.deepEqual(rules(r), [])
})

test('registry entries need a reason and a reviewed date', () => {
  const r = run([{ key: 'health', source: UNGUARDED }], { health: { kind: 'public' } })
  assert.deepEqual(rules(r), ['registry-invalid'])
})

test('unknown registry kind fails', () => {
  const r = run([{ key: 'health', source: UNGUARDED }], { health: { kind: 'trusted', reason: 'x', reviewed: '2026-10-12' } })
  assert.deepEqual(rules(r), ['registry-invalid'])
})

test('delegated: passes while the route still calls the named lib guard', () => {
  const src = `export async function POST() { return ok(await approvePrintRun(supabase, id)) }`
  const r = run([{ key: 'print/approve', source: src }], {
    'print/approve': { kind: 'delegated', guard: 'approvePrintRun', reason: 'lib authenticates', reviewed: '2026-10-12' },
  })
  assert.deepEqual(rules(r), [])
})

test('delegated: fails once the route stops calling the named lib guard', () => {
  const r = run([{ key: 'print/approve', source: UNGUARDED }], {
    'print/approve': { kind: 'delegated', guard: 'approvePrintRun', reason: 'lib authenticates', reviewed: '2026-10-12' },
  })
  assert.deepEqual(rules(r), ['delegate-missing'])
})

test('shared-secret: passes while the named secret is compared with timingSafeEqual', () => {
  const src = `if (!timingSafeEqualString(h, \`Bearer \${ADMIN_CONFIG.adminSecret}\`)) return apiUnauthorized()`
  const r = run([{ key: 'admin/init', source: src }], {
    'admin/init': { kind: 'shared-secret', secret: 'ADMIN_CONFIG.adminSecret', reason: 'bootstrap', reviewed: '2026-10-12' },
  })
  assert.deepEqual(rules(r), [])
})

test('shared-secret: fails when the comparison is not constant-time', () => {
  const src = `if (h !== \`Bearer \${ADMIN_CONFIG.adminSecret}\`) return apiUnauthorized()`
  const r = run([{ key: 'admin/init', source: src }], {
    'admin/init': { kind: 'shared-secret', secret: 'ADMIN_CONFIG.adminSecret', reason: 'bootstrap', reviewed: '2026-10-12' },
  })
  assert.deepEqual(rules(r), ['shared-secret-missing'])
})

test('reexport: passes when the file re-exports the registered target', () => {
  const routes = [
    { key: 'whatsapp/inbound', source: `export { GET, POST } from '@/app/api/webhooks/whatsapp/route'` },
    { key: 'webhooks/whatsapp', source: `const sig = createHmac('sha256', s); timingSafeEqual(a, b)` },
  ]
  const r = run(routes, { 'whatsapp/inbound': { kind: 'reexport', target: 'webhooks/whatsapp', reason: 'legacy URL', reviewed: '2026-10-12' } })
  assert.deepEqual(rules(r), [])
})

test('reexport: fails when the file no longer re-exports the target', () => {
  const r = run([{ key: 'whatsapp/inbound', source: UNGUARDED }], {
    'whatsapp/inbound': { kind: 'reexport', target: 'webhooks/whatsapp', reason: 'legacy URL', reviewed: '2026-10-12' },
  })
  assert.deepEqual(rules(r), ['reexport-broken'])
})

test('stale registry entry for a deleted route fails', () => {
  const r = run([{ key: 'teacher/classes', source: GUARDED }], { gone: { kind: 'public', reason: 'x', reviewed: '2026-10-12' } })
  assert.deepEqual(rules(r), ['stale-registry'])
})

test('a registered route that now has a direct guard only warns', () => {
  const r = run([{ key: 'health', source: GUARDED }], { health: { kind: 'public', reason: 'uptime', reviewed: '2026-10-12' } })
  assert.deepEqual(rules(r), [])
  assert.deepEqual(r.warnings.map(w => w.rule), ['redundant-registry'])
})

// ── cron-auth ────────────────────────────────────────────────────────────────

const CRON_OK = `if (!cronSecret || !timingSafeEqualString(h, \`Bearer \${process.env.CRON_SECRET}\`)) return unauthorized()`

test('cron: CRON_SECRET + timingSafeEqual passes', () => {
  assert.deepEqual(rules(run([{ key: 'cron/nudge', source: CRON_OK }])), [])
})

test('cron: a route without CRON_SECRET fails', () => {
  assert.deepEqual(rules(run([{ key: 'cron/nudge', source: UNGUARDED }])), ['cron-auth'])
})

test('cron: trusting the spoofable x-vercel-cron header fails (the 2026-10-12 bug)', () => {
  const src = `const isVercelCron = request.headers.get('x-vercel-cron') === '1'\nif (!isVercelCron && (${CRON_OK.slice(4)}`
  assert.deepEqual(rules(run([{ key: 'cron/cleanup-users', source: src }])), ['cron-auth'])
})

test('cron: x-vercel-cron mentioned only in a comment passes', () => {
  const src = `// x-vercel-cron is client-settable — CRON_SECRET only\n${CRON_OK}`
  assert.deepEqual(rules(run([{ key: 'cron/nudge', source: src }])), [])
})

// ── webhook-signature ────────────────────────────────────────────────────────

test('webhook: signature verification passes', () => {
  const src = `const expected = createHmac('sha512', secret).update(raw).digest('hex'); timingSafeEqual(a, b)`
  assert.deepEqual(rules(run([{ key: 'payments/callback', source: src }])), [])
})

test('webhook: a user-authenticated webhook without a signature check still fails', () => {
  assert.deepEqual(rules(run([{ key: 'webhooks/paystack', source: GUARDED }])), ['webhook-signature'])
})

// ── debug-route ──────────────────────────────────────────────────────────────

test('test-* and debug routes fail even when guarded', () => {
  assert.deepEqual(rules(run([{ key: 'test-email', source: GUARDED }])), ['debug-route'])
  assert.deepEqual(rules(run([{ key: 'admin/debug', source: GUARDED }])), ['debug-route'])
})

test('a route merely containing "test" in a longer segment is not a debug route', () => {
  assert.deepEqual(rules(run([{ key: 'assessments/testimonials', source: GUARDED }])), [])
})

// ── unguarded-handler (security audit 2026-10-30, F-11) ────────────────────────
// Guard detection is per HANDLER: a guarded POST no longer hides an unguarded
// GET in the same file (how GET /api/feedback's ADMIN_SECRET gate went unseen).

const MIXED = `
export async function POST() { const user = await requireAuthentication(supabase); return ok(user) }

export async function GET() { return ok(await listEverything()) }
`

test('a guarded handler does not protect an unguarded sibling handler', () => {
  const r = run([{ key: 'feedback', source: MIXED }])
  assert.deepEqual(rules(r), ['unguarded-handler'])
  assert.match(r.violations[0].message, /^GET handler/)
})

test('a handler that delegates to the guarded handler in the same file passes', () => {
  const src = `
export async function POST(req) { const auth = await requireAuth(); return verify(auth) }

export async function GET(req) { return POST(rebuild(req)) }
`
  assert.deepEqual(rules(run([{ key: 'payments/verify', source: src }])), [])
})

test('a handler that calls a guarded same-file helper passes', () => {
  const src = `
async function loadForCaller() { return requireAuthentication(supabase) }

export async function GET() { const u = await loadForCaller(); return ok(u) }
`
  assert.deepEqual(rules(run([{ key: 'teacher/things', source: src }])), [])
})

test('a guarded helper the handler never calls does not count', () => {
  const src = `
export async function GET() { return ok(await listEverything()) }

async function unusedGuard() { return requireAuthentication(supabase) }
`
  assert.deepEqual(rules(run([{ key: 'teacher/things', source: src }])), ['unguarded-handler'])
})

test('delegated entries vouch per handler through their guards list', () => {
  const src = `
export async function GET() { await requireClassTeacher(supabase, id); return ok() }

export async function PATCH() { return ok(await editRouteContent(supabase, id)) }
`
  const entry = { kind: 'delegated', guards: ['editRouteContent'], reason: 'r', reviewed: '2026-10-30' }
  assert.deepEqual(rules(run([{ key: 'print-runs', source: src }], { 'print-runs': entry })), [])
  // …and a delegated entry whose listed guard is no longer called fails.
  const missing = { ...entry, guards: ['editRouteContent', 'overrideLearnerRoute'] }
  assert.ok(rules(run([{ key: 'print-runs', source: src }], { 'print-runs': missing })).includes('delegate-missing'))
})

// ── unregistered-shared-secret (F-08) ──────────────────────────────────────────

test('an admin shared-secret gate fails unless registered as one', () => {
  const src = `export async function GET(req) {
    if (!timingSafeEqualString(req.headers.get('x-admin-secret'), process.env.ADMIN_SECRET)) return unauthorized()
    const user = await requireAuthentication(supabase); return ok(user) }`
  assert.ok(rules(run([{ key: 'feedback', source: src }])).includes('unregistered-shared-secret'))
})

// ── learner-ownership-unreviewed (F-11: authentication is not authorization) ──

// The pre-fix F-05 route (POST /api/teacher/alerts), reduced to its shape: it
// authenticated, resolved a teacher, took ANY studentId, and wrote with the
// service client. An unrelated teacher_id filter elsewhere in the file (the
// GET listing) is exactly what a naive "looks owner-scoped" heuristic would
// have mistaken for authorization — the gate must not.
const F05_PRE_FIX = `
const Schema = z.object({ studentId: z.string().uuid(), message: z.string() })
export async function GET() {
  const userId = (await requireAuthentication(supabase)).id
  const teacher = await resolveTeacher(userId)
  const db = ${SVC}()
  return ok(await db.from('student_alerts').select('id').eq('teacher_id', teacher.id))
}
export async function POST(req) {
  const userId = (await requireAuthentication(supabase)).id
  const teacher = await resolveTeacher(userId)
  const db = ${SVC}()
  const { studentId, message } = Schema.parse(await req.json())
  await db.from('student_alerts').insert({ student_id: studentId, teacher_id: teacher.id, message })
  return ok()
}
`

test('detects the F-05 class: an authenticated learner-id route with no ownership check fails', () => {
  assert.deepEqual(rules(run([{ key: 'teacher/alerts', source: F05_PRE_FIX }])), ['learner-ownership-unreviewed'])
})

test('the same route passes once it calls a recognised ownership check', () => {
  const fixed = F05_PRE_FIX.replace(
    "await db.from('student_alerts').insert({ student_id: studentId, teacher_id: teacher.id, message })",
    'await createTeacherAlert({ userId, teacherId: teacher.id, studentId, message })',
  )
  assert.deepEqual(rules(run([{ key: 'teacher/alerts', source: fixed }])), [])
})

test('a reviewed ownership entry accepts the route; a stale or incomplete one fails', () => {
  const route = [{ key: 'teacher/alerts', source: F05_PRE_FIX }]
  assert.deepEqual(rules(run(route, {}, { 'teacher/alerts': { via: 'inline', reason: 'r', reviewed: '2026-10-30' } })), [])
  assert.deepEqual(rules(run(route, {}, { 'teacher/alerts': { via: 'checkThing', reason: 'r', reviewed: '2026-10-30' } })), ['ownership-registry-stale'])
  assert.deepEqual(rules(run(route, {}, { 'teacher/alerts': { via: 'inline' } })), ['ownership-registry-invalid'])
})

test('an ownership entry for a route that no longer needs one is flagged as redundant', () => {
  const r = run([{ key: 'teacher/classes', source: GUARDED }], {}, { 'teacher/classes': { via: 'inline', reason: 'r', reviewed: '2026-10-30' } })
  assert.deepEqual(rules(r), [])
  assert.deepEqual(r.warnings.map(w => w.rule), ['redundant-ownership-registry'])
})

test('routes without a learner id, or without the service client, are not ownership-checked', () => {
  const noLearner = `export async function GET() { await requireAuthentication(s); const db = ${SVC}(); return ok() }`
  const userScoped = `export async function GET() { await requireAuthentication(s); return ok(await s.from('x').select('id').eq('student_id', studentId)) }`
  assert.deepEqual(rules(run([{ key: 'a', source: noLearner }, { key: 'b', source: userScoped }])), [])
})
