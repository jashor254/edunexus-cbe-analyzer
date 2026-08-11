// lib/intelligence/correctionKey.integration.test.ts
//
// Phase E2 (foundation) + Phase E4 (authority cutover), against real
// (synthetic, cleaned-up) rows.
//
// E2 added the correction_key column, producers, immutability and namespace
// validation while remaining behaviourally inert. E4 then made it the
// AUTHORITATIVE automatic correction rule.
//
// The centrepiece is E4_AUTHORITY_CUTOVER at the bottom of this file — the
// test E2 wrote inverted, on purpose, so the cutover could not ship
// silently.
//
// ⚠️ Creates one real (throwaway) auth.users account plus legacy
// teacher/student rows and evidence, all deleted in `after()`.
//
// Run: npx tsx --env-file=.env.local --test lib/intelligence/correctionKey.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { persistEvidenceBatch } from './evidenceLifecycle'
import { EVIDENCE_SOURCE_TRUST_TIER, type LearnerEvidence, type CBCLevel } from './evidence'
import {
  assignmentMarkKey, quizAttemptKey, classAssessmentResultKey, reportCardResultKey,
  correctionKeyNamespace,
} from './correctionKey'

const SYNTHETIC_MARKER = 'SYNTHETIC_E2_CORRECTION_KEY_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let studentId: string
const runIds: string[] = []
const ASSIGNMENT_ID = '33333333-3333-3333-3333-333333333333'

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let i = 1; i <= attempts; i++) {
    try { return await fn() } catch (e) { lastError = e }
    await new Promise(r => setTimeout(r, 500 * i))
  }
  throw lastError
}

async function insert(overrides: Partial<LearnerEvidence> & { cbcLevel: CBCLevel; ref: string }) {
  const source = overrides.evidenceSource ?? 'teacher_upload'
  const { id: runId } = await repos.evidence.createIngestionRun({
    source, initiatedBy: authUserId, teacherId, institution: null,
  })
  runIds.push(runId)
  const e: LearnerEvidence = {
    learnerId: studentId, extractedName: '', extractedExternalId: null,
    subject: 'mathematics', rawSubject: 'mathematics',
    score: null, cbcLevel: overrides.cbcLevel,
    assessmentType: 'assignment', academicYear: 2026, term: 1,
    evidenceSource: source, trustTier: EVIDENCE_SOURCE_TRUST_TIER[source],
    evidenceConfidence: 100, extractionMethod: `${SYNTHETIC_MARKER}_v1`,
    reviewStatus: 'auto_confirmed',
    rawInputRef: `${SYNTHETIC_MARKER}:${overrides.ref}`,
    importedAt: new Date().toISOString(), issues: [],
    subStrandId: null,
    ...overrides,
  }
  const r = await persistEvidenceBatch([e], runId)
  return r.inserted[0]
}

const row = async (id: string) => {
  const { data } = await db.from('learner_evidence')
    .select('id, correction_key, supersedes, lifecycle_state').eq('id', id).single()
  return data!
}

before(async () => {
  const { data: u } = await retryAsync(async () => {
    const r = await db.auth.admin.createUser({
      email: `${SYNTHETIC_MARKER.toLowerCase()}-${Date.now()}@example.com`,
      password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true,
    })
    if (r.error) throw r.error
    return r
  })
  authUserId = u.user.id
  const { data: t } = await retryAsync(async () => {
    const r = await db.from('teachers').insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
    if (r.error) throw r.error
    return r
  })
  teacherId = t!.id
  const { data: s } = await retryAsync(async () => {
    const r = await db.from('students').insert({ name: 'E2 Key Test', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', teacher_id: teacherId }).select('id').single()
    if (r.error) throw r.error
    return r
  })
  studentId = s!.id
})

after(async () => {
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort */ } }
  if (studentId) {
    const { data } = await db.from('learner_evidence').select('id').eq('learner_id', studentId)
    const ids = (data ?? []).map(r => r.id)
    if (ids.length) {
      await safely(() => db.from('evidence_projection_events').delete().in('evidence_id', ids))
      await safely(() => db.from('evidence_audit_log').delete().in('evidence_id', ids))
      await safely(() => db.from('learner_evidence').update({ supersedes: null, superseded_by: null }).in('id', ids))
      await safely(() => db.from('learner_evidence').delete().in('id', ids))
    }
    await safely(() => db.from('learner_projections').delete().eq('learner_id', studentId))
    await safely(() => db.from('learner_profiles').delete().eq('student_id', studentId))
    await safely(() => db.from('students').delete().eq('id', studentId))
  }
  if (runIds.length) await safely(() => db.from('ingestion_runs').delete().in('id', runIds))
  if (teacherId) await safely(() => db.from('teachers').delete().eq('id', teacherId))
  if (authUserId) await safely(() => db.auth.admin.deleteUser(authUserId))
})

// ── Key format + namespace validation (pure) ───────────────────────────────

test('K1. keys are namespaced and contain no mutable educational values', () => {
  const k = assignmentMarkKey({ assignmentId: 'a1', studentId: 's1', source: 'teacher_upload' })
  assert.equal(k, 'assignment_mark:a1:s1')
  for (const forbidden of ['score', 'level', 'outcome', '12', '16', '/20']) {
    assert.ok(!k.includes(forbidden), `key must not embed "${forbidden}"`)
  }
})

test('K2. the same assignment UUID yields DIFFERENT keys for assignment vs quiz', () => {
  const a = assignmentMarkKey({ assignmentId: ASSIGNMENT_ID, studentId: 's1', source: 'teacher_upload' })
  const q = quizAttemptKey({ assignmentId: ASSIGNMENT_ID, studentId: 's1', source: 'quiz_auto_grade' })
  assert.notEqual(a, q, 'this is the ambiguity today\'s rawInputRef already has and must not inherit')
  assert.equal(correctionKeyNamespace(a), 'assignment_mark')
  assert.equal(correctionKeyNamespace(q), 'quiz_attempt')
})

test('K3. a producer cannot mint another producer\'s namespace', () => {
  assert.throws(
    () => assignmentMarkKey({ assignmentId: 'a1', studentId: 's1', source: 'parent_observation' }),
    /may not mint/,
    'a parent observation must never be able to claim a teacher assignment\'s artifact identity',
  )
  assert.throws(() => quizAttemptKey({ assignmentId: 'a1', studentId: 's1', source: 'teacher_upload' }), /may not mint/)
})

test('K4. report_card_result is legitimately shared by the teacher and parent paths', () => {
  const t = reportCardResultKey({ assessmentId: 'x', studentId: 's', canonicalSubject: 'mathematics', source: 'teacher_upload' })
  const p = reportCardResultKey({ assessmentId: 'x', studentId: 's', canonicalSubject: 'mathematics', source: 'parent_observation' })
  assert.equal(t, p, 'same artifact — trust/review differences live on evidence_source, not on the key')
})

test('K5. class/report-card keys identify one RESULT CELL, not the whole row', () => {
  const maths = classAssessmentResultKey({ assessmentId: 'x', studentId: 's', canonicalSubject: 'mathematics', source: 'teacher_upload' })
  const english = classAssessmentResultKey({ assessmentId: 'x', studentId: 's', canonicalSubject: 'english', source: 'teacher_upload' })
  assert.notEqual(maths, english, 'correcting Maths must not touch English')
})

test('K6. malformed segments are rejected rather than silently producing a broken key', () => {
  assert.throws(() => assignmentMarkKey({ assignmentId: '', studentId: 's', source: 'teacher_upload' }), /required/)
  assert.throws(() => assignmentMarkKey({ assignmentId: 'a:b', studentId: 's', source: 'teacher_upload' }), /must not contain/)
})

// ── Persistence ────────────────────────────────────────────────────────────

test('P1. a keyed row persists and returns its correction_key', async () => {
  const inserted = await insert({
    cbcLevel: 2, ref: 'p1',
    correctionKey: assignmentMarkKey({ assignmentId: ASSIGNMENT_ID, studentId, source: 'teacher_upload' }),
  })
  assert.equal(inserted.correction_key, `assignment_mark:${ASSIGNMENT_ID}:${studentId}`)
  assert.equal((await row(inserted.id)).correction_key, inserted.correction_key, 'round-trips through the repository')
})

test('P2. an unkeyed producer persists NULL — not a placeholder string', async () => {
  const inserted = await insert({ cbcLevel: 3, ref: 'p2' })
  assert.equal(inserted.correction_key, null)
  for (const placeholder of ['none', 'null', 'observation', '']) {
    assert.notEqual(inserted.correction_key, placeholder, 'NULL is meaningful; a placeholder would destroy that')
  }
})

test('P3. a regrade of the SAME artifact carries the SAME key (score changes, identity does not)', async () => {
  const key = assignmentMarkKey({ assignmentId: ASSIGNMENT_ID, studentId, source: 'teacher_upload' })
  const first = await insert({ cbcLevel: 1, ref: 'p3-score-12', correctionKey: key, term: 2 })
  const regrade = await insert({ cbcLevel: 3, ref: 'p3-score-16', correctionKey: key, term: 2 })

  assert.equal(first.correction_key, regrade.correction_key, 'identity is stable across the regrade')
  assert.notEqual(first.raw_input_ref, regrade.raw_input_ref,
    'while rawInputRef differs — which is precisely why it could not serve as correction identity')
})

test('P4. two DIFFERENT assignments yield different keys even at identical curriculum/term', async () => {
  const a = await insert({
    cbcLevel: 2, ref: 'p4-a', term: 3,
    correctionKey: assignmentMarkKey({ assignmentId: ASSIGNMENT_ID, studentId, source: 'teacher_upload' }),
  })
  const b = await insert({
    cbcLevel: 4, ref: 'p4-b', term: 3,
    correctionKey: assignmentMarkKey({ assignmentId: '44444444-4444-4444-4444-444444444444', studentId, source: 'teacher_upload' }),
  })
  assert.notEqual(a.correction_key, b.correction_key,
    'the distinction E4 will act on: two observations, not a correction')
})

// ── Immutability ───────────────────────────────────────────────────────────

test('I1. correction_key is immutable after insert', async () => {
  const inserted = await insert({
    cbcLevel: 2, ref: 'i1',
    correctionKey: assignmentMarkKey({ assignmentId: '55555555-5555-5555-5555-555555555555', studentId, source: 'teacher_upload' }),
  })
  const { error } = await db.from('learner_evidence')
    .update({ correction_key: 'assignment_mark:tampered:x' }).eq('id', inserted.id)

  assert.ok(error, 'the existing immutability trigger must reject the change')
  assert.match(error!.message, /immutable/i)
  assert.equal((await row(inserted.id)).correction_key, inserted.correction_key, 'unchanged')
})

test('I2. a same-value write follows existing same-value semantics (no spurious rejection)', async () => {
  const inserted = await insert({
    cbcLevel: 2, ref: 'i2',
    correctionKey: assignmentMarkKey({ assignmentId: '66666666-6666-6666-6666-666666666666', studentId, source: 'teacher_upload' }),
  })
  // IS DISTINCT FROM means writing the same value is not a change.
  const { error } = await db.from('learner_evidence')
    .update({ correction_key: inserted.correction_key }).eq('id', inserted.id)
  assert.equal(error, null, 'unchanged trigger semantics — only real edits are rejected')
})

// ════════════════════════════════════════════════════════════════════════════
// E4_AUTHORITY_CUTOVER  (was E2_TRANSITION_GUARD)
//
// This test's expectation was INVERTED in Phase E4, deliberately and by
// design — E2 wrote it precisely so that the cutover could not happen
// silently.
//
// E2 asserted: two rows with DIFFERENT correction keys still supersede each
//              other, because the legacy six-field claim key was authority.
// E4 asserts:  they COEXIST, because artifact identity is now authority.
//
// That single flip is the whole of the E4 behaviour change. Everything else
// in this phase is plumbing to make it safe.
// ════════════════════════════════════════════════════════════════════════════

test('E4_AUTHORITY_CUTOVER: different artifacts COEXIST even when the legacy claim key collides', async () => {
  const shared = { term: 1 as number, subStrandId: null }

  const first = await insert({
    ...shared, cbcLevel: 1, ref: 'guard-a', subject: 'kiswahili', rawSubject: 'kiswahili',
    correctionKey: assignmentMarkKey({ assignmentId: '77777777-7777-7777-7777-777777777777', studentId, source: 'teacher_upload' }),
  })
  const second = await insert({
    ...shared, cbcLevel: 4, ref: 'guard-b', subject: 'kiswahili', rawSubject: 'kiswahili',
    correctionKey: assignmentMarkKey({ assignmentId: '88888888-8888-8888-8888-888888888888', studentId, source: 'teacher_upload' }),
  })

  // Every field the LEGACY rule keyed on is identical...
  assert.equal(first.subject, second.subject)
  assert.equal(first.assessment_type, second.assessment_type)
  assert.equal(first.academic_year, second.academic_year)
  assert.equal(first.term, second.term)
  assert.equal(first.sub_strand_id, second.sub_strand_id)
  assert.notEqual(first.correction_key, second.correction_key, '...but they are different artifacts')

  // ...and they now coexist. Before E4 this asserted the opposite.
  assert.equal(second.supersedes, null,
    'a second assignment is a NEW OBSERVATION, not a correction of the first')
  assert.equal((await row(first.id)).lifecycle_state, 'auto_confirmed',
    'the first observation survives — this is the defect that removed ~32 real observations from production records')
})

test('E4: an unkeyed row supersedes nothing, with NO legacy fallback', async () => {
  // The most important negative case. If a null key silently fell back to
  // the six-field claim rule, the original defect would survive untouched
  // for exactly the observation-only producers it hurt most.
  const first = await insert({ cbcLevel: 2, ref: 'nullkey-a', subject: 'history', rawSubject: 'history', term: 2 })
  const second = await insert({ cbcLevel: 4, ref: 'nullkey-b', subject: 'history', rawSubject: 'history', term: 2 })

  assert.equal(first.correction_key, null)
  assert.equal(second.correction_key, null)
  assert.equal(second.supersedes, null, 'no artifact identity means no correction target')
  assert.equal((await row(first.id)).lifecycle_state, 'auto_confirmed', 'both observations stand')
})

test('E4: a genuine correction still supersedes — the capability was narrowed, not removed', async () => {
  const key = assignmentMarkKey({ assignmentId: '99999999-9999-9999-9999-999999999999', studentId, source: 'teacher_upload' })
  const original = await insert({ cbcLevel: 1, ref: 'e4-original', subject: 'cre', rawSubject: 'cre', term: 3, correctionKey: key })
  const corrected = await insert({ cbcLevel: 3, ref: 'e4-corrected', subject: 'cre', rawSubject: 'cre', term: 3, correctionKey: key })

  assert.equal(corrected.supersedes, original.id, 'same artifact, so this IS a correction')
  assert.equal((await row(original.id)).lifecycle_state, 'superseded')
})

test('E4: a different SOURCE bearing the same key cannot supersede — the trust boundary holds', async () => {
  const key = reportCardResultKey({
    assessmentId: 'aaaa1111-0000-4000-8000-000000000001', studentId,
    canonicalSubject: 'biology', source: 'teacher_upload',
  })
  const teacherRow = await insert({
    cbcLevel: 4, ref: 'trust-teacher', subject: 'biology', rawSubject: 'biology', term: 1,
    assessmentType: 'term_exam', correctionKey: key, evidenceSource: 'teacher_upload',
  })
  const parentRow = await insert({
    cbcLevel: 1, ref: 'trust-parent', subject: 'biology', rawSubject: 'biology', term: 1,
    assessmentType: 'term_exam', correctionKey: key, evidenceSource: 'parent_observation',
  })

  assert.equal(parentRow.supersedes, null,
    'evidence_source is part of the correction lookup, so a tier-1 parent claim can never supersede a tier-3 teacher mark')
  assert.equal((await row(teacherRow.id)).lifecycle_state, 'auto_confirmed', 'the teacher mark still stands')
})
