// lib/projection/eventConsumerDuplicateDelivery.integration.test.ts
//
// H4A / OPS-EVT-001 — duplicate delivery of a canonical event cannot
// produce duplicate canonical state.
//
// processProjectionEvents() (lib/projection/eventConsumer.ts) marks each
// evidence_projection_events row processed LAST, after recomputing. If a
// crash happens between recompute and mark — or an at-least-once outbox
// redelivers an already-recomputed event — the same event can be processed
// twice. This proves that's actually safe: recomputeLearnerProjection()
// does a full delete-then-upsert from confirmed evidence, not an
// incremental apply, so reprocessing the identical event produces the
// identical projection state, not a duplicate or corrupted one. Simulates
// the redelivery by resetting the real event's processed_at back to null
// after the first real processing run — not a reimplementation of the
// consumer's logic.
//
// Run: npx tsx --env-file=.env.local --experimental-test-module-mocks --test lib/projection/eventConsumerDuplicateDelivery.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { startIngestionRun } from '@/lib/intelligence/ingestionRun'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import { processProjectionEvents } from './eventConsumer'

const SYNTHETIC_MARKER = 'SYNTHETIC_OPS_EVT_001_TEST'
const db = createServiceClient()

let initiatedByUserId: string
let studentId: string
const createdIngestionRunIds: string[] = []

before(async () => {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${Date.now()}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
  if (error || !data.user) throw new Error(`initiator user creation failed: ${error?.message}`)
  initiatedByUserId = data.user.id

  const { data: student, error: studentError } = await db.from('students').insert({ name: `${SYNTHETIC_MARKER} student`, grade: 8 }).select('id').single()
  if (studentError || !student) throw new Error(`student creation failed: ${studentError?.message}`)
  studentId = student.id
})

after(async () => {
  if (studentId) {
    const { data: evidenceRows } = await db.from('learner_evidence').select('id').eq('learner_id', studentId)
    const evidenceIds = (evidenceRows ?? []).map(r => r.id)
    if (evidenceIds.length) {
      await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
      await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
      await db.from('learner_evidence').delete().in('id', evidenceIds)
    }
    await db.from('learner_projections').delete().eq('learner_id', studentId)
    await db.from('students').delete().eq('id', studentId)
  }
  if (createdIngestionRunIds.length) await db.from('ingestion_runs').delete().in('id', createdIngestionRunIds)
  if (initiatedByUserId) await db.auth.admin.deleteUser(initiatedByUserId)
})

test('OPS-EVT-001: reprocessing the same projection event twice produces identical projection state, not duplicated or corrupted', async () => {
  const run = await startIngestionRun({ source: 'teacher_upload', initiatedBy: initiatedByUserId, teacherId: null, institution: null })
  createdIngestionRunIds.push(run.id)
  await persistEvidenceBatch([{
    learnerId: studentId, extractedName: SYNTHETIC_MARKER, extractedExternalId: null,
    subject: 'mathematics', rawSubject: 'Mathematics', score: 68, cbcLevel: 3,
    assessmentType: 'cat', term: 1, academicYear: 2026, evidenceSource: 'teacher_upload',
    trustTier: 3, evidenceConfidence: 95, extractionMethod: 'h4a_ops_evt_001_v1',
    reviewStatus: 'auto_confirmed', rawInputRef: 'test', importedAt: '2026-01-01T00:00:00Z', issues: [],
  }], run.id)

  const { data: pendingEvents } = await db.from('evidence_projection_events').select('id').eq('learner_id', studentId).is('processed_at', null)
  assert.equal(pendingEvents?.length, 1, 'sanity check: exactly one unprocessed projection event exists for this learner')
  const eventId = pendingEvents![0].id

  // First delivery — the real, unmodified consumer.
  const result1 = await processProjectionEvents(100)
  assert.ok(result1.eventsProcessed >= 1)

  const { data: afterFirst } = await db.from('learner_projections').select('value, last_computed').eq('learner_id', studentId).eq('projector_type', 'academic').single()
  assert.ok(afterFirst, 'the first delivery must produce a real persisted projection')

  // Simulate redelivery: the same event, still real, reset to unprocessed —
  // exactly the state an at-least-once outbox or a crash-before-mark
  // scenario would produce. Not a second event, the SAME one.
  await db.from('evidence_projection_events').update({ processed_at: null }).eq('id', eventId)

  const result2 = await processProjectionEvents(100)
  assert.equal(result2.eventsProcessed, 1, 'the redelivered event is picked up and reprocessed')

  const { data: afterSecond } = await db.from('learner_projections').select('value, last_computed').eq('learner_id', studentId).eq('projector_type', 'academic').single()

  assert.deepEqual(afterSecond!.value, afterFirst!.value, 'reprocessing the identical event must produce the identical projection value — no duplication, no drift')

  // No duplicate learner_evidence, no duplicate learner_projections row —
  // exactly one row of each survives regardless of how many times the
  // event was processed.
  const { data: allEvidence } = await db.from('learner_evidence').select('id').eq('learner_id', studentId)
  assert.equal(allEvidence?.length, 1, 'reprocessing must never duplicate the underlying evidence row')

  const { data: allProjectionRows } = await db.from('learner_projections').select('id').eq('learner_id', studentId).eq('projector_type', 'academic')
  assert.equal(allProjectionRows?.length, 1, 'reprocessing must upsert in place, never create a second projection row for the same learner+projector')
})
