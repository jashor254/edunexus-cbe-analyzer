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
// (no mocked auth check) for a representative sample covering both auth
// patterns found in the codebase:
//   - secret-only routes (the majority: events/dispatch, jobs/process,
//     term-readiness, billing-renewals)
//   - the secret-OR-vercel-header routes (academy-nudge, cleanup-users,
//     snapshot-metrics) — these also accept `x-vercel-cron: 1` with NO
//     secret at all, trusting Vercel's platform guarantee that this header
//     is stripped from client-supplied requests and only ever set
//     internally by Vercel's own cron dispatcher. This is a real,
//     deliberate second trust path this test documents rather than
//     silently assumes — see the H4A closeout report's named finding.
//
// Run: npx tsx --env-file=.env.local --experimental-test-module-mocks --test app/api/cron/cronAuthBoundary.integration.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { GET as eventsDispatchGET } from './events/dispatch/route'
import { GET as jobsProcessGET } from './jobs/process/route'
import { GET as billingRenewalsGET } from './billing-renewals/route'
import { POST as academyNudgePOST } from './academy-nudge/route'

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

// ── Secret-OR-Vercel-header routes ───────────────────────────────────────────

test('OPS-CRON-001: academy-nudge rejects a request with neither a secret nor the Vercel cron header', async () => {
  const res = await academyNudgePOST(req('/api/cron/academy-nudge'))
  assert.equal(res.status, 401)
})

test('OPS-CRON-001: academy-nudge rejects a wrong secret with no Vercel header', async () => {
  const res = await academyNudgePOST(req('/api/cron/academy-nudge', { authorization: 'Bearer wrong-secret' }))
  assert.equal(res.status, 401)
})

test('OPS-CRON-001 FINDING: academy-nudge accepts x-vercel-cron: 1 with NO secret at all — documents the real, deliberate second trust path', async () => {
  const res = await academyNudgePOST(req('/api/cron/academy-nudge', { 'x-vercel-cron': '1' }))
  assert.notEqual(res.status, 401, 'this pins the actual current behavior: the Vercel-header path trusts the platform to strip this header from client requests, with no in-app secret check as a second layer — see the H4A closeout report')
})
