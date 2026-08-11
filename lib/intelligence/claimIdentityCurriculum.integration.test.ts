// lib/intelligence/claimIdentityCurriculum.integration.test.ts
//
// Phase 2 / GATE A + GATE B — claim identity at curriculum grain, and
// double-confirm semantics. Real (synthetic, cleaned-up) rows.
//
// GATE A: `subStrandId` joined the claim key, so two different curriculum
// claims in the same subject/term stop being treated as two versions of one
// claim. Before this, an assignment on proportional reasoning and an
// assignment on algebra in the same Maths term shared the key
// `learner:mathematics:assignment:2026:1` and the second superseded the
// first — live behaviour for the two producers that already anchor evidence.
//
// GATE B: re-confirming an already-confirmed row is an idempotent,
// metadata-preserving no-op rather than a silent rewrite of the original
// reviewer.
//
// ⚠️ Creates one real (throwaway) auth.users account plus legacy
// teacher/student rows and evidence, all deleted in `after()`.
//
// Run: npx tsx --env-file=.env.local --test lib/intelligence/claimIdentityCurriculum.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { persistEvidenceBatch, confirmReview, rejectReview } from './evidenceLifecycle'
import { EVIDENCE_SOURCE_TRUST_TIER, type LearnerEvidence, type CBCLevel } from './evidence'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'

const SYNTHETIC_MARKER = 'SYNTHETIC_P2_CLAIM_IDENTITY_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let studentId: string
let subStrandA: string
let subStrandB: string
const runIds: string[] = []

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let i = 1; i <= attempts; i++) {
    try { return await fn() } catch (e) { lastError = e }
    await new Promise(r => setTimeout(r, 500 * i))
  }
  throw lastError
}

async function addEvidence(opts: {
  cbcLevel: CBCLevel
  subStrandId: string | null
  term?: number
  ref?: string
  assessmentType?: 'term_exam' | 'cat' | 'assignment'
  /** Phase E4 — the artifact identity that now drives supersession. */
  correctionKey?: string | null
}) {
  const { id: runId } = await repos.evidence.createIngestionRun({
    source: 'teacher_upload', initiatedBy: authUserId, teacherId, institution: null,
  })
  runIds.push(runId)
  const e: LearnerEvidence = {
    learnerId: studentId,
    extractedName: '', extractedExternalId: null,
    subject: 'mathematics', rawSubject: 'mathematics',
    score: null, cbcLevel: opts.cbcLevel,
    assessmentType: opts.assessmentType ?? 'assignment',
    academicYear: 2026, term: opts.term ?? 1,
    evidenceSource: 'teacher_upload',
    trustTier: EVIDENCE_SOURCE_TRUST_TIER.teacher_upload,
    evidenceConfidence: 100,
    extractionMethod: `${SYNTHETIC_MARKER}_v1`,
    reviewStatus: 'auto_confirmed',
    rawInputRef: `${SYNTHETIC_MARKER}:${opts.ref ?? Math.random().toString(36).slice(2)}`,
    importedAt: new Date().toISOString(),
    issues: [],
    subStrandId: opts.subStrandId,
    correctionKey: opts.correctionKey ?? null,
  }
  const r = await persistEvidenceBatch([e], runId)
  return r.inserted[0]
}

const rowById = async (id: string) => {
  const { data } = await db.from('learner_evidence')
    .select('id, lifecycle_state, supersedes, superseded_by, sub_strand_id, reviewed_by, reviewed_at, review_reason')
    .eq('id', id).maybeSingle()
  return data!
}

before(async () => {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${Date.now()}@example.com`
  const { data: u } = await retryAsync(async () => {
    const r = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
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
    const r = await db.from('students').insert({ name: 'Claim Identity Test', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', teacher_id: teacherId }).select('id').single()
    if (r.error) throw r.error
    return r
  })
  studentId = s!.id

  const { data: ss } = await retryAsync(async () => {
    const r = await db.from('sow_substrands').select('id').order('id').limit(2)
    if (r.error) throw r.error
    return r
  })
  subStrandA = ss![0].id
  subStrandB = ss![1].id
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

// ── GATE A ─────────────────────────────────────────────────────────────────

test('A1. two different sub-strands in the same subject/term do NOT supersede each other', async () => {
  const a = await addEvidence({ cbcLevel: 1, subStrandId: subStrandA, ref: 'a1-proportional' })
  const b = await addEvidence({ cbcLevel: 4, subStrandId: subStrandB, ref: 'a1-algebra' })

  assert.equal(b.supersedes, null, 'an algebra claim is not a correction of a proportional-reasoning claim')
  assert.equal((await rowById(a.id)).lifecycle_state, 'auto_confirmed', 'and the first claim still stands')

  const projection = await recomputeLearnerProjection(studentId)
  const bySubStrand = projection.academic!.value.bySubStrand
  assert.equal(bySubStrand[subStrandA].latestLevel, 1, 'both curriculum claims survive independently')
  assert.equal(bySubStrand[subStrandB].latestLevel, 4)
})

test('A2. [E4-UPDATED] a correction now supersedes via ARTIFACT identity, not curriculum identity', async () => {
  // Phase 2 wrote this test asserting that two rows sharing
  // learner/subject/sub-strand/type/year/term were "the same claim" and so
  // superseded. Phase E4 replaced that rule: curriculum similarity alone
  // never implies correction. These fixtures declare no artifact, so they
  // are now two independent observations — which is the correct reading of
  // two marks that nothing identifies as the same piece of work.
  const first = await addEvidence({ cbcLevel: 1, subStrandId: subStrandA, term: 2, ref: 'a2-first' })
  const second = await addEvidence({ cbcLevel: 3, subStrandId: subStrandA, term: 2, ref: 'a2-second' })

  assert.equal(second.supersedes, null, 'no correction_key means no correction target')
  assert.equal((await rowById(first.id)).lifecycle_state, 'auto_confirmed', 'both observations stand')

  // Corrections are NOT broken — they are expressed through artifact identity.
  const { assignmentMarkKey } = await import('./correctionKey')
  const key = assignmentMarkKey({ assignmentId: '1a1a1a1a-0000-4000-8000-00000000a2a2', studentId, source: 'teacher_upload' })
  const original = await addEvidence({ cbcLevel: 1, subStrandId: subStrandA, term: 3, ref: 'a2-artifact-original', correctionKey: key })
  const corrected = await addEvidence({ cbcLevel: 3, subStrandId: subStrandA, term: 3, ref: 'a2-artifact-corrected', correctionKey: key })

  assert.equal(corrected.supersedes, original.id, 'same artifact = a genuine correction')
  assert.equal((await rowById(original.id)).lifecycle_state, 'superseded')

  const projection = await recomputeLearnerProjection(studentId)
  assert.equal(projection.academic!.value.bySubStrand[subStrandA].latestLevel, 3,
    'the correction is what Projection reads')
})

test('A3. [E4-UPDATED] unanchored subject-level observations now coexist', async () => {
  // Phase 2 asserted these superseded (null sub-strand was an identity value
  // in the six-field key). Phase E4 removed that key from the supersession
  // path entirely, so two subject-level marks with no declared artifact are
  // two observations — and, importantly, there is NO legacy fallback: if
  // there were, the original defect would survive for exactly the
  // observation-only producers it hurt most.
  const first = await addEvidence({ cbcLevel: 2, subStrandId: null, term: 3, ref: 'a3-first' })
  const second = await addEvidence({ cbcLevel: 3, subStrandId: null, term: 3, ref: 'a3-second' })

  assert.equal(second.supersedes, null, 'no artifact identity, no correction')
  assert.equal((await rowById(first.id)).lifecycle_state, 'auto_confirmed')
})

test('A4. null sub_strand_id does not collide with anchored evidence', async () => {
  const anchored = await addEvidence({ cbcLevel: 1, subStrandId: subStrandB, term: 3, ref: 'a4-anchored' })
  const subjectLevel = await addEvidence({ cbcLevel: 4, subStrandId: null, term: 3, ref: 'a4-subject' })

  assert.notEqual(subjectLevel.supersedes, anchored.id,
    'a term exam over all of Mathematics is not a correction of a sub-strand quiz')
  assert.equal((await rowById(anchored.id)).lifecycle_state, 'auto_confirmed')
})

test('A5. a different assessment_type is still a different claim (unchanged)', async () => {
  const assignment = await addEvidence({ cbcLevel: 1, subStrandId: subStrandA, term: 1, assessmentType: 'cat', ref: 'a5-cat' })
  assert.equal(assignment.supersedes, null, 'a CAT is not a correction of an assignment')
})

// ── GATE B ─────────────────────────────────────────────────────────────────

test('B1. confirming pending evidence works exactly as before', async () => {
  const { id: runId } = await repos.evidence.createIngestionRun({
    source: 'parent_observation', initiatedBy: authUserId, teacherId: null, institution: null,
  })
  runIds.push(runId)
  const e: LearnerEvidence = {
    learnerId: studentId, extractedName: '', extractedExternalId: null,
    subject: 'english', rawSubject: 'english', score: null, cbcLevel: 2,
    assessmentType: 'term_exam', academicYear: 2026, term: 1,
    evidenceSource: 'parent_observation', trustTier: EVIDENCE_SOURCE_TRUST_TIER.parent_observation,
    evidenceConfidence: 60, extractionMethod: `${SYNTHETIC_MARKER}_b1`,
    reviewStatus: 'pending_review', rawInputRef: `${SYNTHETIC_MARKER}:b1`,
    importedAt: new Date().toISOString(), issues: [], subStrandId: null,
  }
  const inserted = (await persistEvidenceBatch([e], runId)).inserted[0]

  const confirmed = await confirmReview(inserted.id, authUserId, 'first confirmation')
  assert.equal(confirmed.lifecycle_state, 'reviewed_confirmed')
  assert.equal(confirmed.reviewed_by, authUserId)
})

test('B2. re-confirming is an idempotent no-op that PRESERVES the original reviewer', async () => {
  const { data: rows } = await db.from('learner_evidence')
    .select('id, reviewed_by, reviewed_at, review_reason')
    .eq('learner_id', studentId).eq('lifecycle_state', 'reviewed_confirmed').limit(1)
  const row = rows![0]

  // A different reviewer, a different reason — exactly the case that used to
  // silently overwrite who made the educational judgement.
  const otherReviewerId = authUserId // the only real auth user in this fixture
  const again = await confirmReview(row.id, otherReviewerId, 'second confirmation with a different reason')

  const after = await rowById(row.id)
  assert.equal(again.lifecycle_state, 'reviewed_confirmed', 'no error — safe to retry')
  assert.equal(after.reviewed_at, row.reviewed_at, 'the original review timestamp is preserved')
  assert.equal(after.review_reason, row.review_reason, 'and the original reason — not overwritten')
})

test('B3. the repeat attempt is recorded in the audit log rather than being invisible', async () => {
  const { data: rows } = await db.from('learner_evidence')
    .select('id').eq('learner_id', studentId).eq('lifecycle_state', 'reviewed_confirmed').limit(1)

  const { data: events } = await db.from('evidence_audit_log')
    .select('event_type, metadata')
    .eq('evidence_id', rows![0].id)
    .eq('event_type', 'reviewed_confirmed')

  const noOp = (events ?? []).find(e => (e.metadata as Record<string, unknown>)?.no_op === true)
  assert.ok(noOp, 'a repeat confirmation must leave an audit trail')
  assert.equal((noOp!.metadata as Record<string, unknown>).repeat_confirmation, true)
})

test('B4. genuinely illegal transitions are still rejected — the guard was not weakened', async () => {
  const { data: rows } = await db.from('learner_evidence')
    .select('id').eq('learner_id', studentId).eq('lifecycle_state', 'superseded').limit(1)
  // A2's artifact-keyed correction leaves one (A3 no longer does, post-E4).
  assert.ok(rows && rows.length > 0, 'A2 left a superseded row via a real correction')

  await assert.rejects(
    () => confirmReview(rows![0].id, authUserId, 'superseded evidence must not be confirmable'),
    /Invalid evidence lifecycle transition/,
  )
})

test('B5. rejection is unaffected by the idempotency change', async () => {
  const { id: runId } = await repos.evidence.createIngestionRun({
    source: 'parent_observation', initiatedBy: authUserId, teacherId: null, institution: null,
  })
  runIds.push(runId)
  const e: LearnerEvidence = {
    learnerId: studentId, extractedName: '', extractedExternalId: null,
    subject: 'kiswahili', rawSubject: 'kiswahili', score: null, cbcLevel: 2,
    assessmentType: 'term_exam', academicYear: 2026, term: 2,
    evidenceSource: 'parent_observation', trustTier: EVIDENCE_SOURCE_TRUST_TIER.parent_observation,
    evidenceConfidence: 60, extractionMethod: `${SYNTHETIC_MARKER}_b5`,
    reviewStatus: 'pending_review', rawInputRef: `${SYNTHETIC_MARKER}:b5`,
    importedAt: new Date().toISOString(), issues: [], subStrandId: null,
  }
  const inserted = (await persistEvidenceBatch([e], runId)).inserted[0]
  const rejected = await rejectReview(inserted.id, authUserId, 'not corroborated')
  assert.equal(rejected.lifecycle_state, 'reviewed_rejected')

  await assert.rejects(
    () => confirmReview(inserted.id, authUserId, 'rejected evidence must not be confirmable'),
    /Invalid evidence lifecycle transition/,
  )
})
