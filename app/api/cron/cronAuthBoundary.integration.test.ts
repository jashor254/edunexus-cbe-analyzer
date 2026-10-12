// app/api/cron/cronAuthBoundary.integration.test.ts
//
// H4A / OPS-CRON-001 — a scheduled operational route cannot be invoked
// successfully without its intended authentication boundary.
//
// All 17 routes under app/api/cron/ check CRON_SECRET via
// timingSafeEqualString (lib/api/secretCompare.ts) against a
// `Bearer <secret>` header — a real, existing mechanism with ZERO test
// coverage anywhere before this file (no test referenced CRON_SECRET at
// all). This calls the real, unmodified exported route handlers directly
// (no mocked auth check) for a representative sample.
//
// 2026-10-12 (security early-warning pass): four routes (academy-nudge,
// cleanup-users, snapshot-metrics, ai-log-retention) used to ALSO accept
// `x-vercel-cron: 1` with no secret, on the assumption that Vercel strips
// that header from client requests. Vercel documents no such guarantee —
// its cron docs authenticate with CRON_SECRET, which Vercel Cron sends as
// `Authorization: Bearer` itself — and proxy.ts does not guard /api/cron/*.
// The H4A FINDING test that pinned the bypass is now inverted: the header
// alone must be rejected on every one of those routes.
//
// Run: npx tsx --env-file=.env.local --experimental-test-module-mocks --test app/api/cron/cronAuthBoundary.integration.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { GET as eventsDispatchGET } from './events/dispatch/route'
import { GET as jobsProcessGET } from './jobs/process/route'
import { GET as billingRenewalsGET } from './billing-renewals/route'
import { POST as academyNudgePOST } from './academy-nudge/route'
import { POST as cleanupUsersPOST } from './cleanup-users/route'
import { POST as snapshotMetricsPOST } from './snapshot-metrics/route'
import { GET as aiLogRetentionGET, POST as aiLogRetentionPOST } from './ai-log-retention/route'

const CRON_SECRET = process.env.CRON_SECRET ?? 'h4a-test-cron-secret-fixture'
process.env.CRON_SECRET = CRON_SECRET

function req(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), { headers })
}

// ── Secret-only routes ───────────────────────────────────────────────────────

test('OPS-CRON-001: events/dispatch rejects a missing Authorization header', async () => {
  const res = await eventsDispatchGET(req('/api/cron/events/dispatch'))
  assert.equal(res.status, 401)
})

test('OPS-CRON-001: events/dispatch rejects a wrong secret', async () => {
  const res = await eventsDispatchGET(req('/api/cron/events/dispatch', { authorization: 'Bearer wrong-secret' }))
  assert.equal(res.status, 401)
})

test('OPS-CRON-001: events/dispatch accepts the real CRON_SECRET', async () => {
  const res = await eventsDispatchGET(req('/api/cron/events/dispatch', { authorization: `Bearer ${CRON_SECRET}` }))
  assert.notEqual(res.status, 401, 'a correctly-authenticated cron caller must not be rejected')
})

test('OPS-CRON-001: jobs/process rejects a missing Authorization header', async () => {
  const res = await jobsProcessGET(req('/api/cron/jobs/process'))
  assert.equal(res.status, 401)
})

test('OPS-CRON-001: jobs/process rejects a wrong secret', async () => {
  const res = await jobsProcessGET(req('/api/cron/jobs/process', { authorization: 'Bearer wrong-secret' }))
  assert.equal(res.status, 401)
})

test('OPS-CRON-001: billing-renewals rejects a missing Authorization header', async () => {
  const res = await billingRenewalsGET(req('/api/cron/billing-renewals'))
  assert.equal(res.status, 401)
})

test('OPS-CRON-001: billing-renewals rejects a wrong secret', async () => {
  const res = await billingRenewalsGET(req('/api/cron/billing-renewals', { authorization: 'Bearer wrong-secret' }))
  assert.equal(res.status, 401)
})

// ── Formerly secret-OR-Vercel-header routes ──────────────────────────────────

test('OPS-CRON-001: academy-nudge rejects a request with no secret', async () => {
  const res = await academyNudgePOST(req('/api/cron/academy-nudge'))
  assert.equal(res.status, 401)
})

test('OPS-CRON-001: academy-nudge rejects a wrong secret', async () => {
  const res = await academyNudgePOST(req('/api/cron/academy-nudge', { authorization: 'Bearer wrong-secret' }))
  assert.equal(res.status, 401)
})

// A spoofed `x-vercel-cron: 1` (any client can send it) must not stand in for
// the secret — on every route that used to accept it.
const SPOOFED_VERCEL_HEADER = { 'x-vercel-cron': '1' }
const formerHeaderTrustRoutes: Array<[string, (r: NextRequest) => Promise<Response>]> = [
  ['academy-nudge POST', academyNudgePOST],
  ['cleanup-users POST', cleanupUsersPOST],
  ['snapshot-metrics POST', snapshotMetricsPOST],
  ['ai-log-retention GET', aiLogRetentionGET],
  ['ai-log-retention POST', aiLogRetentionPOST],
]

for (const [name, handler] of formerHeaderTrustRoutes) {
  test(`OPS-CRON-001: ${name} rejects a spoofed x-vercel-cron header with no secret`, async () => {
    const res = await handler(req('/api/cron/x', SPOOFED_VERCEL_HEADER))
    assert.equal(res.status, 401)
  })
}
