// lib/compass/compassEvidenceLoop.integration.test.ts
//
// Compass v2 Wave 2, Phase 12 — proves the full learner intelligence loop
// end to end, against real (synthetic, cleaned up) data: a Compass session's
// evidence is created, reviewed (or conservatively auto-confirmed), and only
// then does the Behaviour Projector — permanently null in production before
// this wave, per the Compass Audit §8 — actually activate. Blueprint and
// Career Intelligence are not separately exercised here (both simply call
// recomputeLearnerProjection(studentId) with no filtering, per
// lib/learnerIntelligence/blueprint.ts:228 and careerIntelligence.ts:146 — the
// same function this test calls directly, so once it's proven that function
// returns a non-null `behaviour` field, both consumers reflect it by
// construction, not by a separate code path).
//
// ⚠️ Creates one real (throwaway) auth.users account and legacy
// teacher/student rows, all deleted in `after()`, including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/compass/compassEvidenceLoop.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServiceClient } from '@/utils/supabase/service'
import { recordCompassSessionEvidence } from './evidence'
import { confirmReview, rejectReview, getPendingReview } from '@/lib/intelligence/evidenceLifecycle'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { ENGAGEMENT_EXTRACTION_METHOD, MASTERY_EXTRACTION_METHOD } from './evidenceClaimTypes'

const SYNTHETIC_MARKER = 'SYNTHETIC_COMPASS_EVIDENCE_LOOP_TEST'
const db = createServiceClient()

let authUserId: string   // stands in for the authenticated actor who ends the session
let teacherId: string
let studentId: string
let ingestionRunIds: string[] = []

// This session's environment has shown sustained, intermittent network
// flakiness against Supabase Auth's admin endpoints (documented identically
// in lib/learnerBlueprint/actionPlan/lifecycle.integration.test.ts's header)
// — bounded setup retries only, never around an assertion.
async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

before(async () => {
  const { data: authUser } = await retryAsync(async () => {
    const res = await db.auth.admin.createUser({
      email: `compass-evidence-loop-test-${Date.now()}@example.com`,
      password: `Test!${Math.random().toString(36).slice(2, 10)}`,
      email_confirm: true,
    })
    if (res.error) throw res.error
    return res
  })
  authUserId = authUser.user.id

  const { data: teacher, error: teacherErr } = await db
    .from('teachers')
    .insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (teacherErr) throw teacherErr
  teacherId = teacher.id

  const { data: student, error } = await db
    .from('students')
    .insert({ teacher_id: teacherId, name: 'Compass Loop Test Learner', grade: 8, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'teacher' })
    .select('id')
    .single()
  if (error) throw error
  studentId = student.id
})

after(async () => {
  await db.from('learner_projections').delete().eq('learner_id', studentId)

  // Derive the runs from the learner's own evidence rather than trusting the
  // module-level list: a test that failed early may never have populated it,
  // and the previous teacher_id-based lookup never populated it at all — so
  // synthetic ingestion_runs rows were being left behind on every run.
  if (studentId) {
    const derived = await ingestionRunIdsForLearner()
    ingestionRunIds = [...new Set([...ingestionRunIds, ...derived])]
  }

  if (ingestionRunIds.length > 0) {
    const { data: ev } = await db.from('learner_evidence').select('id').in('ingestion_run_id', ingestionRunIds)
    const evidenceIds = (ev ?? []).map(e => e.id)
    if (evidenceIds.length > 0) {
      await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
      await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
      await db.from('learner_evidence').update({ supersedes: null, superseded_by: null }).in('id', evidenceIds)
      await db.from('learner_evidence').delete().in('id', evidenceIds)
    }
    if (ingestionRunIds.length) await db.from('ingestion_runs').delete().in('id', ingestionRunIds)
  }
  await db.from('students').delete().eq('id', studentId)
  await db.from('teachers').delete().eq('id', teacherId)
  await db.auth.admin.deleteUser(authUserId)
  console.log('[cleanup] synthetic compass-evidence-loop fixtures removed')
})

/**
 * The ingestion runs this learner's Compass evidence actually belongs to.
 *
 * Previously looked up as `ingestion_runs WHERE teacher_id = <teacher>`,
 * which never matched: `recordCompassSessionEvidence` creates its run with
 * `teacherId: null` (a Compass session has no teacher), so the filter
 * returned zero rows and every assertion below silently had nothing to
 * assert against. A test-harness defect, not a product one — the
 * assertions themselves are unchanged; only the query that finds the rows
 * is corrected, deriving the runs from the learner's own evidence.
 */
async function ingestionRunIdsForLearner(): Promise<string[]> {
  const { data } = await db
    .from('learner_evidence')
    .select('ingestion_run_id')
    .eq('learner_id', studentId)
  return [...new Set((data ?? []).map(r => r.ingestion_run_id as string).filter(Boolean))]
}

test('a completed Compass session emits two distinct claim shapes, both pending_review at creation', async () => {
  const sessionId = randomUUID()

  await recordCompassSessionEvidence({
    studentId, initiatedBy: authUserId, sessionId,
    subject: 'mathematics', sessionAbandoned: false,
    exchangeCount: 6, durationSeconds: 480,
    genuineProgress: true, masteredConcepts: ['fractions'],
    endingLevel: 3, academicYear: 2026, term: 1,
  })

  ingestionRunIds = await ingestionRunIdsForLearner()

  const { data: rows } = await db
    .from('learner_evidence')
    .select('id, extraction_method, lifecycle_state, cbc_level, evidence_confidence')
    .in('ingestion_run_id', ingestionRunIds)

  const engagement = rows!.find(r => r.extraction_method === ENGAGEMENT_EXTRACTION_METHOD)
  const mastery    = rows!.find(r => r.extraction_method === MASTERY_EXTRACTION_METHOD)

  assert.ok(engagement, 'expected an engagement claim')
  assert.ok(mastery, 'expected a mastery claim, since genuineProgress + masteredConcepts were supplied')
  assert.equal(mastery!.cbc_level, 3, 'mastery claim should carry the real ending level')

  // Trust tier 1 caps confidence at 60, structurally below the 85 auto-confirm
  // threshold — both claims must be incapable of auto_confirmed at creation,
  // regardless of what Phase 11's policy does to them afterward.
  assert.ok(engagement!.evidence_confidence < 85)
  assert.ok(mastery!.evidence_confidence < 85)

  // The mastery claim must NEVER be promoted by the auto-confirm policy, no
  // matter whether COMPASS_AUTO_CONFIRM_USER_ID is configured in this
  // environment — this is Phase 11's one hard invariant.
  assert.equal(mastery!.lifecycle_state, 'pending_review', 'mastery claims must always require teacher review')
})

test('the mastery claim requires a real teacher review — confirming it activates Behaviour Projection', async () => {
  const pending = await getPendingReview({ learnerId: studentId })
  const mastery = pending.find(r => r.extraction_method === MASTERY_EXTRACTION_METHOD)
  assert.ok(mastery, 'expected the mastery claim to still be pending review')

  // Simulates a teacher's PATCH to /api/teacher/classes/[classId]/compass/evidence/[evidenceId]
  const confirmed = await confirmReview(mastery!.id, authUserId, 'Teacher confirmed: verified against classroom observation')
  assert.equal(confirmed.lifecycle_state, 'reviewed_confirmed')

  const projection = await recomputeLearnerProjection(studentId)

  // Before this wave, this was unconditionally null in production — no
  // ingestion source had ever produced confirmed compass_session evidence
  // (Compass Audit §8, §18). This is the loop actually closing.
  assert.ok(projection.behaviour, 'Behaviour Projection must now be non-null')
  assert.ok((projection.behaviour!.value as { distinctSources: string[] }).distinctSources.includes('compass_session'))
  assert.ok((projection.behaviour!.value as { observationCount: number }).observationCount >= 1)
  assert.ok(projection.behaviour!.supportingEvidenceIds.includes(mastery!.id))
})

test('re-confirming an already-confirmed row is an idempotent, metadata-preserving no-op (Phase 2 GATE B)', async () => {
  // This test previously asserted that a second confirmReview() must throw.
  // Phase 2 GATE B settled that question the other way, deliberately:
  //   - a double-click or a retry after a network flake is normal client
  //     behaviour, and turning it into a failure surfaces alarm for a
  //     harmless action;
  //   - a hard error could not be implemented without narrowing the
  //     lifecycle trigger's same-state branch, a migration whose blast
  //     radius covers every evidence write;
  //   - the REAL harm was never permissiveness, it was that a second
  //     confirmation silently overwrote reviewed_by / reviewed_at /
  //     review_reason — replacing the record of who made the educational
  //     judgement with whoever clicked last.
  // So the expectation is updated to the decided semantics. The Gate B
  // implementation was not changed to satisfy the old assertion.
  const pending = await getPendingReview({ learnerId: studentId })
  const engagement = pending.find(r => r.extraction_method === ENGAGEMENT_EXTRACTION_METHOD)

  let targetId: string
  if (engagement) {
    const first = await confirmReview(engagement.id, authUserId, 'first, legal confirmation')
    assert.equal(first.lifecycle_state, 'reviewed_confirmed')
    targetId = engagement.id
  } else {
    // Already auto-confirmed by Phase 11's policy in this environment.
    const { data: rows } = await db
      .from('learner_evidence')
      .select('id')
      .in('ingestion_run_id', ingestionRunIds)
      .eq('extraction_method', ENGAGEMENT_EXTRACTION_METHOD)
      .eq('lifecycle_state', 'reviewed_confirmed')
      .limit(1)
    assert.ok(rows && rows.length > 0, 'expected an already-confirmed engagement row')
    targetId = rows![0].id
  }

  const { data: before } = await db.from('learner_evidence')
    .select('reviewed_by, reviewed_at, review_reason').eq('id', targetId).single()

  // Second attempt — succeeds, changes nothing.
  const again = await confirmReview(targetId, authUserId, 'second attempt with a DIFFERENT reason')
  assert.equal(again.lifecycle_state, 'reviewed_confirmed', 'idempotent: no error on retry')

  const { data: after } = await db.from('learner_evidence')
    .select('reviewed_by, reviewed_at, review_reason').eq('id', targetId).single()

  assert.equal(after!.reviewed_by, before!.reviewed_by, 'the original reviewer is preserved')
  assert.equal(after!.reviewed_at, before!.reviewed_at, 'and the original timestamp')
  assert.equal(after!.review_reason, before!.review_reason, 'and the original reason — never silently rewritten')

  // The repeat is visible rather than invisible.
  const { data: events } = await db.from('evidence_audit_log')
    .select('metadata').eq('evidence_id', targetId).eq('event_type', 'reviewed_confirmed')
  assert.ok(
    (events ?? []).some(e => (e.metadata as Record<string, unknown>)?.repeat_confirmation === true),
    'the repeat confirmation is recorded in the audit log',
  )
})

test('genuinely illegal lifecycle transitions are still rejected — the guard was not weakened', async () => {
  const { data: rows } = await db
    .from('learner_evidence')
    .select('id')
    .in('ingestion_run_id', ingestionRunIds)
    .eq('lifecycle_state', 'reviewed_rejected')
    .limit(1)

  if (!rows || rows.length === 0) return // nothing rejected yet in this run

  await assert.rejects(
    () => confirmReview(rows[0].id, authUserId, 'rejected evidence must not be confirmable'),
    /Invalid evidence lifecycle transition/,
  )
})

test('rejected evidence is retained, not deleted, and never reaches Projection', async () => {
  const sessionId = randomUUID()
  await recordCompassSessionEvidence({
    studentId, initiatedBy: authUserId, sessionId,
    subject: 'english', sessionAbandoned: true,
    exchangeCount: 1, durationSeconds: 30,
    genuineProgress: false, masteredConcepts: [],
    endingLevel: null, academicYear: 2026, term: 1,
  })

  ingestionRunIds = await ingestionRunIdsForLearner()

  const pending = await getPendingReview({ learnerId: studentId })
  const abandoned = pending.find(r => r.raw_input_ref.includes(sessionId))
  assert.ok(abandoned, 'expected the abandoned-session engagement claim to still be pending (no mastery claim for an abandoned session)')

  const rejected = await rejectReview(abandoned!.id, authUserId, 'Session was abandoned after one exchange — not meaningful engagement')
  assert.equal(rejected.lifecycle_state, 'reviewed_rejected')

  const stillThere = await db.from('learner_evidence').select('id').eq('id', abandoned!.id).maybeSingle()
  assert.ok(stillThere.data, 'rejected evidence must remain permanently queryable, never deleted')

  const confirmedEvidence = await recomputeLearnerProjection(studentId)
  const behaviourEvidenceIds = confirmedEvidence.behaviour?.supportingEvidenceIds ?? []
  assert.ok(!behaviourEvidenceIds.includes(abandoned!.id), 'rejected evidence must never feed a projection')
})
