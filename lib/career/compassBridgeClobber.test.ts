// lib/career/compassBridgeClobber.test.ts
//
// Regression proof for a live defect: generating a legacy career/class
// report used to WHOLESALE REPLACE `student_learning_context.compass_bridge`,
// silently destroying a teacher-approved Blueprint -> Compass intervention.
//
// What was lost, and why each mattered:
//   teacherSuggested  the intervention lost top priority in getNextSubject()
//   subStrandId       the session's mastery claim came back unanchored, so
//                     "did the weakness we targeted change?" became
//                     unanswerable
//   deliveryId        blueprint_compass_deliveries was orphaned — delivery
//                     binding is explicit-only by design, so the row could
//                     never be claimed or completed
//
// Pure unit tests over the merge policy. The end-to-end proof that a real
// delivery survives report generation and can still be completed lives in
// lib/compass/deliveryBinding.integration.test.ts.
//
// Run: npx tsx --env-file=.env.local --test lib/career/compassBridgeClobber.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeBridgePreservingTeacherIntent } from './autoReportGenerator'

/** A bridge exactly as setTeacherSuggestedTopic() writes it for a Blueprint delivery. */
function teacherQueuedBridge(): Record<string, unknown> {
  return {
    teacherSuggested: true,
    teacherSuggestedAt: '2026-08-10T09:00:00.000Z',
    subStrandId: 'SUBSTRAND-A',
    deliveryId: 'DELIVERY-A',
    strandName: 'Numbers',
    firstSubject: 'mathematics',
    firstConcept: 'proportional_reasoning',
  }
}

/** What generateCompassBridge() produces — report-owned context only. */
function generatedReportBridge(): Record<string, unknown> {
  return {
    sessionGoal: 'Close the gap in essay structure — it is blocking the humanities pathway',
    firstSubject: 'english',
    firstConcept: 'essay_writing',
    startDifficulty: 2,
    subjectPriorities: [{ subject: 'english', gap: 2 }],
    weeklyMilestones: [{ week: 1, goal: 'Draft one essay', subject: 'english', checkConcept: 'essay_writing' }],
    parentWhatsAppMessage: 'Ask about essay practice this week.',
  }
}

// ── The defect, reproduced ──────────────────────────────────────────────────

test('the OLD wholesale write is what destroyed the intervention (regression baseline)', () => {
  // Exactly what this module used to do: `compass_bridge: bridge`.
  const wholesale = { ...generatedReportBridge() }

  assert.equal('deliveryId' in wholesale, false, 'the delivery reference was erased — row orphaned forever')
  assert.equal('subStrandId' in wholesale, false, 'the curriculum anchor was erased — mastery came back unanchored')
  assert.equal('teacherSuggested' in wholesale, false, 'teacher priority was erased')

  // The fix must differ from that, on the same inputs.
  const fixed = mergeBridgePreservingTeacherIntent(teacherQueuedBridge(), generatedReportBridge())
  assert.notDeepEqual(fixed, wholesale, 'the fix must not reduce to the old behaviour')
})

test('a teacher-queued intervention survives report generation intact', () => {
  const merged = mergeBridgePreservingTeacherIntent(teacherQueuedBridge(), generatedReportBridge())

  assert.equal(merged.teacherSuggested, true, 'teacher authority must survive')
  assert.equal(merged.subStrandId, 'SUBSTRAND-A', 'the curriculum anchor must survive')
  assert.equal(merged.deliveryId, 'DELIVERY-A', 'the delivery reference must survive — otherwise the row is orphaned')
  assert.equal(merged.strandName, 'Numbers')
  assert.equal(merged.teacherSuggestedAt, '2026-08-10T09:00:00.000Z')
})

test('report-owned context still updates normally alongside a live intervention', () => {
  const merged = mergeBridgePreservingTeacherIntent(teacherQueuedBridge(), generatedReportBridge())

  assert.match(String(merged.sessionGoal), /essay structure/)
  assert.equal(merged.startDifficulty, 2)
  assert.deepEqual(merged.parentWhatsAppMessage, 'Ask about essay practice this week.')
  assert.equal((merged.weeklyMilestones as unknown[]).length, 1)
})

test('a live intervention is not RETARGETED by report generation', () => {
  // Freezing teacherSuggested alone would be insufficient: the report would
  // keep the teacher's authority flag while pointing the session at its own
  // subject, and strand the teacher's mathematics subStrandId against an
  // English session.
  const merged = mergeBridgePreservingTeacherIntent(teacherQueuedBridge(), generatedReportBridge())

  assert.equal(merged.firstSubject, 'mathematics', 'the intervention keeps its own subject')
  assert.equal(merged.firstConcept, 'proportional_reasoning')
})

// ── No authority escalation ─────────────────────────────────────────────────

test('report generation cannot invent teacher authority', () => {
  // A hostile/degenerate generated object that tries to claim teacher intent.
  const escalating = {
    ...generatedReportBridge(),
    teacherSuggested: true,
    subStrandId: 'SUBSTRAND-FORGED',
    deliveryId: 'DELIVERY-FORGED',
    strandName: 'Forged',
  }

  const merged = mergeBridgePreservingTeacherIntent({}, escalating)

  assert.equal('teacherSuggested' in merged, false, 'must not appear when no teacher set it')
  assert.equal('subStrandId' in merged, false)
  assert.equal('deliveryId' in merged, false)
  assert.equal('strandName' in merged, false)
})

test('report generation cannot clear teacher authority either', () => {
  const merged = mergeBridgePreservingTeacherIntent(
    teacherQueuedBridge(),
    { ...generatedReportBridge(), teacherSuggested: false, subStrandId: null, deliveryId: null },
  )

  assert.equal(merged.teacherSuggested, true)
  assert.equal(merged.subStrandId, 'SUBSTRAND-A')
  assert.equal(merged.deliveryId, 'DELIVERY-A')
})

// ── Unchanged behaviour when no intervention exists ─────────────────────────

test('with no teacher intervention, every generated field is written as before', () => {
  const merged = mergeBridgePreservingTeacherIntent({}, generatedReportBridge())

  assert.deepEqual(merged, generatedReportBridge(), 'identical to the pre-fix behaviour')
})

test('an empty bridge and a consumed intervention both behave as no intervention', () => {
  // Compass clears `teacherSuggested` after the first message (learn/route.ts),
  // which is exactly how an intervention is marked consumed. Once consumed,
  // the report may retarget the session again.
  const consumed = { ...teacherQueuedBridge(), teacherSuggested: false }
  const merged = mergeBridgePreservingTeacherIntent(consumed, generatedReportBridge())

  assert.equal(merged.firstSubject, 'english', 'a consumed intervention no longer freezes targeting')
  assert.equal(merged.firstConcept, 'essay_writing')
  // ...but the durable provenance keys still are not this path's to erase.
  assert.equal(merged.subStrandId, 'SUBSTRAND-A')
  assert.equal(merged.deliveryId, 'DELIVERY-A')
  assert.equal(merged.teacherSuggested, false, 'and the consumed flag is not resurrected')
})

test('report generation never introduces teacher keys that were absent', () => {
  const merged = mergeBridgePreservingTeacherIntent(
    { sessionGoal: 'old goal' },
    generatedReportBridge(),
  )
  for (const key of ['teacherSuggested', 'teacherSuggestedAt', 'subStrandId', 'deliveryId', 'strandName']) {
    assert.equal(key in merged, false, `${key} must not be conjured from nothing`)
  }
})

test('unknown legacy keys already in the bridge are preserved, not silently dropped', () => {
  const merged = mergeBridgePreservingTeacherIntent(
    { someLegacyKey: 'keep me', sessionGoal: 'old' },
    generatedReportBridge(),
  )
  assert.equal(merged.someLegacyKey, 'keep me')
  assert.match(String(merged.sessionGoal), /essay structure/, 'but report-owned keys still update')
})
