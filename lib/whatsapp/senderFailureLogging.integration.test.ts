// lib/whatsapp/senderFailureLogging.integration.test.ts
//
// H4A / OPS-WA-001 — a thrown transport-level failure (network error,
// timeout) must still be recorded in notification_log, not silently lost.
// sendWhatsAppTemplate() has no internal try/catch of its own (see
// lib/whatsapp/client.test.ts's FINDING test), so this was previously the
// caller's responsibility — and sendAssignmentMarkedWhatsApp's catch block
// returned {success:false} to its own caller but wrote no DB record at
// all, unlike a provider-reported 4xx/5xx failure. Fixed this phase; this
// test proves it against the real function and a real notification_log
// row, fetch-mocked transport only.
//
// Run: npx tsx --env-file=.env.local --experimental-test-module-mocks --test lib/whatsapp/senderFailureLogging.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'

const SYNTHETIC_MARKER = 'SYNTHETIC_OPS_WA_001_TEST'
const db = createServiceClient()
const submissionId = crypto.randomUUID() // notification_log.reference_id is a UUID column

let sendAssignmentMarkedWhatsApp: typeof import('./sender').sendAssignmentMarkedWhatsApp

before(async () => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'fixture-phone-id'
  process.env.WHATSAPP_ACCESS_TOKEN = 'fixture-access-token'
  ;({ sendAssignmentMarkedWhatsApp } = await import('./sender'))
})

const originalFetch = globalThis.fetch
after(async () => {
  globalThis.fetch = originalFetch
  await db.from('notification_log').delete().eq('reference_id', submissionId)
})

test('OPS-WA-001: a thrown network failure while sending an assignment-marked notification is recorded as a failed notification_log row, not silently lost', async () => {
  // Scoped to Meta's API only — repos.notifications' own DB calls go
  // through the real Supabase client, which also uses global fetch under
  // the hood, so an unconditional mock would break the DB writes this
  // test needs to observe, not just the WhatsApp send.
  globalThis.fetch = (async (url: string | URL | Request, ...rest) => {
    if (String(url).includes('graph.facebook.com')) throw new Error('fetch failed')
    return originalFetch(url as string, ...rest)
  }) as typeof fetch

  const result = await sendAssignmentMarkedWhatsApp({
    submissionId, parentPhone: '254712345678', parentName: SYNTHETIC_MARKER, studentName: SYNTHETIC_MARKER,
    subject: 'mathematics', score: 8, maxScore: 10, cbcLevel: 3, teacherFeedback: null,
    teacherName: SYNTHETIC_MARKER, assignmentId: 'test-assignment', userId: null,
  })

  assert.equal(result.success, false)

  const { data: logs } = await db.from('notification_log').select('success, error_message, channel, type').eq('reference_id', submissionId)
  assert.equal(logs?.length, 1, 'a thrown transport error must still produce exactly one notification_log row')
  assert.equal(logs![0].success, false)
  assert.equal(logs![0].channel, 'whatsapp')
  assert.match(logs![0].error_message ?? '', /fetch failed/)
})
