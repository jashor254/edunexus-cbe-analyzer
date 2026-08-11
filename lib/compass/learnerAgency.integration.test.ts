// lib/compass/learnerAgency.integration.test.ts
//
// Phase 2.5 / Part D — the two learner-agency properties Phase 2 asserted
// only by argument, now proven.
//
//   A. A learner cannot alter a teacher's objective or its provenance.
//   B. A teacher's direction is guidance, not a permanent subject lock.
//
// These are the architectural expression of "teacher-guided learning plus
// real learner agency". Neither is a percentage and neither is enforced by
// a quota — A is enforced by where the write paths are, B by the fact that
// direction is consumed rather than latched.
//
// ⚠️ Creates one real (throwaway) auth.users account plus legacy
// teacher/student rows, all deleted in `after()`.
//
// Run: npx tsx --env-file=.env.local --test lib/compass/learnerAgency.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import { EVIDENCE_SOURCE_TRUST_TIER, type LearnerEvidence } from '@/lib/intelligence/evidence'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { setTeacherSuggestedTopic } from './objective'
import { getNextSubject, getOrCreateSession, endSession } from './session'
import { readCompassAcademicProjection, resolveCompassSubjectRanking } from './learnerContext'

const SYNTHETIC_MARKER = 'SYNTHETIC_P25_LEARNER_AGENCY_TEST'
const db = createServiceClient()
const APP_ROOT = join(__dirname, '..', '..')

let authUserId: string
let teacherId: string
let studentId: string
const runIds: string[] = []

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let i = 1; i <= attempts; i++) {
    try { return await fn() } catch (e) { lastError = e }
    await new Promise(r => setTimeout(r, 500 * i))
  }
  throw lastError
}

async function addEvidence(subject: string, cbcLevel: 1 | 2 | 3 | 4) {
  const { id: runId } = await repos.evidence.createIngestionRun({
    source: 'teacher_upload', initiatedBy: authUserId, teacherId, institution: null,
  })
  runIds.push(runId)
  const e: LearnerEvidence = {
    learnerId: studentId, extractedName: '', extractedExternalId: null,
    subject, rawSubject: subject, score: null, cbcLevel,
    assessmentType: 'term_exam', academicYear: 2026, term: 1,
    evidenceSource: 'teacher_upload', trustTier: EVIDENCE_SOURCE_TRUST_TIER.teacher_upload,
    evidenceConfidence: 100, extractionMethod: `${SYNTHETIC_MARKER}_v1`,
    reviewStatus: 'auto_confirmed', rawInputRef: `${SYNTHETIC_MARKER}:${subject}`,
    importedAt: new Date().toISOString(), issues: [], subStrandId: null,
  }
  await persistEvidenceBatch([e], runId)
  await recomputeLearnerProjection(studentId)
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
    const r = await db.from('students').insert({
      name: 'Agency Test', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER,
      added_by: 'teacher', teacher_id: teacherId, user_id: authUserId,
    }).select('id').single()
    if (r.error) throw r.error
    return r
  })
  studentId = s!.id

  // Three subjects so "choose another permitted subject" is a real choice.
  await addEvidence('mathematics', 1)
  await addEvidence('english', 3)
  await addEvidence('kiswahili', 2)
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
    await safely(() => db.from('compass_sessions').delete().eq('learner_id', studentId))
    await safely(() => db.from('learner_projections').delete().eq('learner_id', studentId))
    await safely(() => db.from('student_learning_context').delete().eq('student_id', studentId))
    await safely(() => db.from('learner_profiles').delete().eq('student_id', studentId))
    await safely(() => db.from('students').delete().eq('id', studentId))
  }
  if (runIds.length) await safely(() => db.from('ingestion_runs').delete().in('id', runIds))
  if (teacherId) await safely(() => db.from('teachers').delete().eq('id', teacherId))
  if (authUserId) await safely(() => db.auth.admin.deleteUser(authUserId))
})

// ── A. The learner cannot alter the teacher's objective or its provenance ──

test('A1. the objective and its provenance are written only by teacher-authorized server paths', () => {
  // `setTeacherSuggestedTopic` is the single writer of the objective fields.
  // Its only two callers are a teacher route and the Blueprint delivery
  // adapter, both of which gate on teacher-tier authorization. The
  // learner-facing routes must not call it at all — that is what makes the
  // provenance unforgeable from the learner side, and it is a structural
  // property worth locking down rather than re-deriving by reading code.
  const learnerFacing = [
    'app/api/learn/route.ts',
    'app/api/learn/student/route.ts',
    'app/api/learn/end/route.ts',
  ].map(p => readFileSync(join(APP_ROOT, p), 'utf8'))

  for (const src of learnerFacing) {
    assert.ok(!src.includes('setTeacherSuggestedTopic'),
      'a learner-facing route must never invoke the teacher objective setter')
    assert.ok(!src.includes('mergeTeacherSuggestedTopic'),
      'nor the repository writer beneath it')
    assert.ok(!src.includes('blueprint_compass_deliveries'),
      'nor touch the delivery provenance ledger')
  }
})

test('A2. the learner-facing request body cannot carry an objective, a target or a provenance id', () => {
  const src = readFileSync(join(APP_ROOT, 'app/api/learn/route.ts'), 'utf8')
  const destructured = src.slice(src.indexOf('} = await req.json()') - 600, src.indexOf('} = await req.json()'))

  for (const forbidden of ['firstConcept', 'strandName', 'subStrandId', 'teacherSuggested', 'deliveryId', 'objective']) {
    assert.ok(!destructured.includes(forbidden),
      `the learner request must not accept "${forbidden}" — teacher intent is server state, not client input`)
  }
})

test('A3. a learner cannot relabel their own session as teacher-directed', async () => {
  // The learner's own session write path is `writeSession`, whose entire
  // surface is CompassSession (lock/level/mastered concepts). There is no
  // field on it that can set teacherSuggested, an objective, or an anchor.
  const before = await repos.compass.getStudentLearningContext(studentId)
  assert.equal(before, null, 'no teacher has queued anything for this learner')

  const next = await getNextSubject(studentId)
  assert.notEqual(next.reason, 'teacher_recommendation',
    'with no server-side teacher intent, no session can present itself as teacher-directed')
  assert.equal(next.subtopic, null, 'and no objective can appear from the learner side')
})

test('A4. once a teacher sets an objective, the learner-facing flow reads it but never rewrites it', async () => {
  await setTeacherSuggestedTopic({
    studentId, subject: 'mathematics',
    concept: 'Work through equivalent fractions',
    strandName: 'Numbers — Fractions',
    subStrandId: '00000000-0000-0000-0000-000000000000',
  })

  const ctx = await repos.compass.getStudentLearningContext(studentId)
  const bridge = (ctx?.compass_bridge ?? {}) as Record<string, unknown>
  assert.equal(bridge.firstConcept, 'Work through equivalent fractions')
  assert.equal(bridge.subStrandId, '00000000-0000-0000-0000-000000000000')
  assert.equal(bridge.teacherSuggested, true)

  // The learner consuming it (starting the targeted session) leaves the
  // teacher's content untouched.
  const next = await getNextSubject(studentId)
  assert.equal(next.reason, 'teacher_recommendation')
  assert.equal(next.subtopic, 'Work through equivalent fractions', 'read verbatim, not rewritten')

  const after = await repos.compass.getStudentLearningContext(studentId)
  const bridgeAfter = (after?.compass_bridge ?? {}) as Record<string, unknown>
  assert.equal(bridgeAfter.firstConcept, 'Work through equivalent fractions')
  assert.equal(bridgeAfter.subStrandId, '00000000-0000-0000-0000-000000000000',
    'the curriculum anchor a teacher chose is not learner-editable')
})

// ── B. Direction is guidance, not a permanent lock ─────────────────────────

test('B1. the learner may open a subject the teacher did NOT direct them to', async () => {
  const ctx = await repos.compass.getStudentLearningContext(studentId)
  const bridge = (ctx?.compass_bridge ?? {}) as Record<string, unknown>
  assert.equal(bridge.teacherSuggested, true, 'a teacher direction is currently active')
  assert.equal(bridge.firstSubject, 'mathematics')

  // The learner picks english instead. Nothing rejects it: `getOrCreateSession`
  // takes the subject the learner chose, not the one that was suggested.
  const session = await getOrCreateSession(studentId, 'english', 'school')
  assert.ok(session.sessionId, 'a session in a non-directed subject is created normally')

  const { data: row } = await db.from('compass_sessions')
    .select('subject').eq('id', session.sessionId).single()
  assert.equal(row!.subject, 'english', 'the learner\'s choice, not the teacher\'s suggestion')

  await endSession(session.sessionId, studentId, 'completed', 60, 'english')
})

test('B2. after the direction is consumed, rotation returns to the learner\'s own weakest-first order', async () => {
  // Consuming the suggestion is what /api/learn does after the first message.
  await repos.compass.mergeTeacherSuggestedTopic(studentId, { teacherSuggested: false })

  const next = await getNextSubject(studentId)
  assert.notEqual(next.reason, 'teacher_recommendation',
    'a completed direction does not latch — the learner is not permanently steered')

  const { academic } = await readCompassAcademicProjection(studentId)
  const ranking = resolveCompassSubjectRanking({ academic, subjectTiers: {} })
  assert.ok(ranking.length >= 3, 'the learner has a real choice of subjects')
  assert.ok(ranking.some(r => r.sourceKey === next.subject),
    'and the next suggestion comes from their own evidence, not from the spent direction')
})

test('B3. recommendation is not coercion — every evidence-backed subject stays selectable', async () => {
  const { academic } = await readCompassAcademicProjection(studentId)
  const ranking = resolveCompassSubjectRanking({ academic, subjectTiers: {} })

  // Weakest-first is an ordering, not a restriction: the strongest subject is
  // still present and still openable.
  const strongest = ranking[ranking.length - 1]
  assert.equal(strongest.subject, 'english', 'english (Level 3) sorts last')

  const session = await getOrCreateSession(studentId, strongest.sourceKey, 'holiday')
  assert.ok(session.sessionId, 'the learner may open even their strongest subject')
  await endSession(session.sessionId, studentId, 'completed', 60, strongest.sourceKey)
})
