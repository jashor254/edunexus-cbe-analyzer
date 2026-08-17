// app/api/cron/quotaAlertsIdempotency.integration.test.ts
//
// H4A / OPS-CRON-002 — re-executing the same scheduled job must not
// duplicate learner/org-impacting notification effects.
//
// quota-alerts runs hourly and re-evaluates every still-over-threshold org
// on every run. Before this phase, its publishEvent() call carried no
// idempotency_key — an org that stayed over quota across multiple runs in
// the same day would get a fresh, unguarded org.quota.warning event every
// single run (confirmed ABSENT by direct code read). Fixed to key on
// (org, day), matching the pattern this file's sibling cron routes already
// use. This proves the fix against the real route and real DB, not a
// reimplementation.
//
// Run: npx tsx --env-file=.env.local --experimental-test-module-mocks --test app/api/cron/quotaAlertsIdempotency.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { GET as quotaAlertsGET } from './quota-alerts/route'

const SYNTHETIC_MARKER = 'SYNTHETIC_OPS_CRON_002_TEST'
const CRON_SECRET = process.env.CRON_SECRET ?? 'h4a-test-cron-secret-fixture'
process.env.CRON_SECRET = CRON_SECRET

const db = createServiceClient()
let orgId: string

before(async () => {
  const { data, error } = await db.from('organizations').insert({
    name: `${SYNTHETIC_MARKER} org`, slug: `${SYNTHETIC_MARKER.toLowerCase()}-${Date.now()}`,
    type: 'school', status: 'active', api_quota_daily: 10, api_quota_monthly: 100,
  }).select('id').single()
  if (error || !data) throw new Error(`org seed failed: ${error?.message}`)
  orgId = data.id

  // Over both the daily (80%) and monthly (85%) warn thresholds.
  await db.from('usage_events').insert({
    organization_id: orgId, event_type: 'api.request', quantity: 9, recorded_at: new Date().toISOString(),
  })
})

after(async () => {
  await db.from('platform_events').delete().eq('organization_id', orgId)
  await db.from('usage_events').delete().eq('organization_id', orgId)
  await db.from('organizations').delete().eq('id', orgId)
})

function req(): NextRequest {
  return new NextRequest(new URL('/api/cron/quota-alerts', 'http://localhost'), {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  })
}

test('OPS-CRON-002: two runs of quota-alerts for an org that remains over threshold publish exactly one org.quota.warning event, not two', async () => {
  const res1 = await quotaAlertsGET(req())
  assert.equal(res1.status, 200)

  const res2 = await quotaAlertsGET(req())
  assert.equal(res2.status, 200)

  const { data: events } = await db
    .from('platform_events')
    .select('id')
    .eq('organization_id', orgId)
    .eq('event_type', 'org.quota.warning')
  assert.equal(events?.length, 1, 'a second run within the same day must not publish a duplicate quota-warning event for the same org')
})
