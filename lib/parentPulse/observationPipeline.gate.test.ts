// lib/parentPulse/observationPipeline.gate.test.ts
//
// Proves the WHATSAPP_PARENT_REPLY_EFFECTS gate: with effects disabled (the
// default, and every malformed value) an inbound parent reply produces NO
// educational side effect — no learner-profile update, no parent evidence, no
// teacher alert, no projection event, no phone→learner resolution — and keeps
// only operational metadata without the parent's message text. With the exact
// enabled value the pre-existing behaviour is unchanged.
//
// Single mutable `calls` object, mocks registered once before the module under
// test is imported (node:test mock.module is unreliable across repeated
// mock/restore cycles — same constraint as app/api/webhooks/whatsapp/route.test.ts).
//
// Run: npm test -- lib/parentPulse/observationPipeline.gate.test.ts

import { test, before, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'

type InboundLogRow = {
  phone: string
  raw_body: string
  received_at: string
  meta_message_id: string | null
  parsed_reply: string
  student_id: string | null
  parent_id: string | null
  processed: boolean
  error_message: string | null
}

const calls = {
  inboundLogs: [] as InboundLogRow[],
  duplicateChecks: 0,
  optInLookups: 0,
  profileReads: 0,
  profileUpdates: 0,
  evidenceWrites: 0,
  studentAlerts: 0,
  classEnrollmentLookups: 0,
  events: 0,
  logInsertShouldThrow: false,
}

function resetCalls(): void {
  calls.inboundLogs = []
  calls.duplicateChecks = 0
  calls.optInLookups = 0
  calls.profileReads = 0
  calls.profileUpdates = 0
  calls.evidenceWrites = 0
  calls.studentAlerts = 0
  calls.classEnrollmentLookups = 0
  calls.events = 0
  calls.logInsertShouldThrow = false
}

mock.module('@/lib/repositories', {
  namedExports: {
    repos: {
      notifications: {
        isInboundDuplicate: async () => { calls.duplicateChecks++; return false },
        getOptInByPhone: async () => {
          calls.optInLookups++
          return { student_id: 'student-1', students: { parent_user_id: 'parent-1' } }
        },
        insertWhatsAppInboundLog: async (row: InboundLogRow) => {
          if (calls.logInsertShouldThrow) throw new Error('column "meta_message_id" does not exist')
          calls.inboundLogs.push(row)
        },
        insertStudentAlert: async () => { calls.studentAlerts++ },
      },
      learnerModel: {
        getLearnerProfile: async () => { calls.profileReads++; return { parent_observations: [], confirmed_gaps: ['mathematics:fractions'] } },
        findClassEnrollment: async () => { calls.classEnrollmentLookups++; return { teacher_classes: { teacher_id: 'teacher-1' } } },
      },
    },
  },
})

mock.module('@/lib/learnerModel/updater', {
  namedExports: { updateFromParentObservation: async () => { calls.profileUpdates++ } },
})

mock.module('@/lib/parentPulse/observationEvidence', {
  namedExports: { recordParentObservationEvidence: async () => { calls.evidenceWrites++ } },
})

mock.module('@/lib/events', {
  namedExports: { publishEvent: async () => { calls.events++ } },
})

let processInboundReply: typeof import('./observationPipeline').processInboundReply
let isParentReplyEffectsEnabled: typeof import('@/lib/config/whatsappReplyEffects').isParentReplyEffectsEnabled

const ENV_KEY = 'WHATSAPP_PARENT_REPLY_EFFECTS'
let savedEnv: string | undefined

before(async () => {
  ;({ processInboundReply } = await import('./observationPipeline'))
  ;({ isParentReplyEffectsEnabled } = await import('@/lib/config/whatsappReplyEffects'))
})

beforeEach(() => {
  savedEnv = process.env[ENV_KEY]
  delete process.env[ENV_KEY]
  resetCalls()
})

afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV_KEY]
  else process.env[ENV_KEY] = savedEnv
})

const STRUGGLE_REPLY = {
  fromPhone: '254700000001',
  rawBody: '2',
  receivedAt: '2026-11-05T08:00:00.000Z',
  metaMessageId: 'wamid.TEST1',
}

function assertNoEducationalEffects(): void {
  assert.equal(calls.profileUpdates, 0, 'learner profile must not be updated')
  assert.equal(calls.evidenceWrites, 0, 'parent evidence must not be written')
  assert.equal(calls.studentAlerts, 0, 'teacher alert must not be created')
  assert.equal(calls.classEnrollmentLookups, 0, 'teacher must not be resolved')
  assert.equal(calls.events, 0, 'projection event must not be published')
  assert.equal(calls.optInLookups, 0, 'phone must not be resolved to a learner')
  assert.equal(calls.profileReads, 0, 'learner profile must not be read')
  assert.equal(calls.duplicateChecks, 0, 'no educational idempotency lookup')
}

// ── flag semantics ───────────────────────────────────────────────────────────

test('gate: default (unset) is OFF', () => {
  assert.equal(isParentReplyEffectsEnabled({}), false)
})

test('gate: only the exact value "enabled" turns effects on', () => {
  assert.equal(isParentReplyEffectsEnabled({ WHATSAPP_PARENT_REPLY_EFFECTS: 'enabled' }), true)
  for (const bad of ['', 'true', '1', 'on', 'yes', 'ENABLED', 'Enabled', ' enabled', 'enabled ', 'enable', 'disabled', 'false', '0', 'enabled\n']) {
    assert.equal(isParentReplyEffectsEnabled({ WHATSAPP_PARENT_REPLY_EFFECTS: bad }), false, `"${bad}" must be OFF`)
  }
})

// ── disabled = no educational side effects ───────────────────────────────────

test('OFF (unset): a struggled reply produces no educational side effect', async () => {
  const result = await processInboundReply(STRUGGLE_REPLY)
  assert.equal(result.processed, false)
  assert.equal(result.skipped, 'effects_disabled')
  assert.equal(result.outcome, undefined, 'no outcome => the webhook sends no acknowledgement')
  assert.equal(result.teacherNotified, undefined)
  assertNoEducationalEffects()
})

test('OFF: every outcome class (demonstrated, struggled, not_attempted, free text) is inert', async () => {
  for (const rawBody of ['1', '2', '3', 'we did not understand it', 'he understood well']) {
    resetCalls()
    const result = await processInboundReply({ ...STRUGGLE_REPLY, rawBody })
    assert.equal(result.skipped, 'effects_disabled', rawBody)
    assert.equal(result.outcome, undefined, rawBody)
    assertNoEducationalEffects()
  }
})

test('OFF: malformed configuration values are treated as OFF end to end', async () => {
  for (const bad of ['', 'true', '1', 'ENABLED', ' enabled']) {
    resetCalls()
    process.env[ENV_KEY] = bad
    const result = await processInboundReply(STRUGGLE_REPLY)
    assert.equal(result.skipped, 'effects_disabled', `"${bad}"`)
    assertNoEducationalEffects()
  }
})

test('OFF: only operational metadata is kept, never the parent message text', async () => {
  await processInboundReply({ ...STRUGGLE_REPLY, rawBody: 'my child is being bullied, please call me' })
  assert.equal(calls.inboundLogs.length, 1)
  const row = calls.inboundLogs[0]
  assert.equal(row.phone, STRUGGLE_REPLY.fromPhone)
  assert.equal(row.meta_message_id, 'wamid.TEST1')
  assert.equal(row.received_at, STRUGGLE_REPLY.receivedAt)
  assert.equal(row.processed, false)
  assert.equal(row.error_message, 'parent_reply_effects_disabled')
  assert.equal(row.parsed_reply, 'free_form', 'must satisfy the parsed_reply CHECK constraint without classifying')
  assert.equal(row.student_id, null, 'no learner attribution is recorded')
  assert.equal(row.parent_id, null)
  assert.ok(!row.raw_body.includes('bullied'), 'message text must not be retained')
  assert.ok(!JSON.stringify(row).includes('call me'))
})

test('OFF: a failing metadata write (e.g. column not yet migrated) is non-fatal and still inert', async () => {
  calls.logInsertShouldThrow = true
  const result = await processInboundReply(STRUGGLE_REPLY)
  assert.equal(result.skipped, 'effects_disabled')
  assert.equal(result.error, undefined)
  assert.equal(calls.inboundLogs.length, 0)
  assertNoEducationalEffects()
})

test('OFF: a reply without a Meta message id is also inert', async () => {
  const { metaMessageId: _omit, ...noId } = STRUGGLE_REPLY
  void _omit
  const result = await processInboundReply(noId)
  assert.equal(result.skipped, 'effects_disabled')
  assertNoEducationalEffects()
})

// ── enabled = unchanged behaviour (regression) ───────────────────────────────

test('ON (exact "enabled"): the existing pipeline still runs', async () => {
  process.env[ENV_KEY] = 'enabled'
  const result = await processInboundReply(STRUGGLE_REPLY)
  assert.equal(result.processed, true)
  assert.equal(result.outcome, 'struggled')
  assert.equal(result.skipped, undefined)
  assert.equal(calls.profileUpdates, 1)
  assert.equal(calls.studentAlerts, 1)
  assert.equal(calls.events, 1)
  assert.equal(calls.inboundLogs.length, 1)
  assert.equal(calls.inboundLogs[0].raw_body, '2')
})
