// scripts/security/route-auth-rules.test.ts
// Unit tests for the route-auth security gate rules (scripts/check-route-auth.mjs).
// Pure string fixtures — no filesystem, network, or credentials.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkRouteAuth, hasDirectGuard, callsAny, reexportTarget } from './route-auth-rules.mjs'

type Route = { key: string; source: string }

const GUARDED = `export async function GET() { const user = await requireAuthentication(supabase); return ok(user) }`
const UNGUARDED = `export async function GET() { return ok(await listEverything()) }`

function run(routes: Route[], registry: Record<string, object> = {}) {
  return checkRouteAuth({ routes, registry })
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
