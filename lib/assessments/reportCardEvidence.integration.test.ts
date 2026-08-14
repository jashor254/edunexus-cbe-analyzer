// lib/assessments/reportCardEvidence.integration.test.ts
//
// Phase 1 / P0-B — proves the widened report-card evidence producer against
// real (synthetic, cleaned-up) rows.
//
// The first test in this file is a GATE, not a regression check. Before the
// parent intake route may be wired to this producer, the Evidence Domain's
// EXISTING claim-key supersession behaviour has to be observed for the one
// collision P0-B makes possible: a teacher's tier-3 `auto_confirmed` row
// and a parent's tier-1 `pending_review` row sharing a claim key
// (learner + subject + assessment_type + year + term).
//
// If a parent's unreviewed claim can supersede a teacher's confirmed one,
// wiring the parent route would make canonical state LESS trustworthy, and
// the correct response is to stop and take it to the Evidence Domain as its
// own design decision — not to special-case parent evidence here, not to
// change claim keys, and not to quietly prefer the teacher inside this
// producer.
//
// ⚠️ Creates one real (throwaway) auth.users account plus legacy
// teacher/student/assessment rows and evidence, all deleted in `after()`,
// including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/assessments/reportCardEvidence.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import { EVIDENCE_SOURCE_TRUST_TIER, type LearnerEvidence } from '@/lib/intelligence/evidence'
import { computeConfidence, resolveReviewStatus, AUTO_CONFIRM_THRESHOLD } from '@/lib/intelligence/confidence'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { recordReportCardAssessmentEvidence } from './reportCardEvidence'
import { asStudentId } from '@/lib/core/identityTypes'

const SYNTHETIC_MARKER = 'SYNTHETIC_P0B_REPORTCARD_EVIDENCE_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let studentId: string
let collisionStudentId: string
let teacherOnlyStudentId: string
let parentAssessmentId: string
let teacherAssessmentId: string
let teacherOnlyAssessmentId: string
const ingestionRunIds: string[] = []

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

async function insertStudent(name: string): Promise<string> {
  const { data } = await retryAsync(async () => {
    const r = await db.from('students')
      .insert({ name, grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', teacher_id: teacherId })
      .select('id').single()
    if (r.error) throw r.error
    return r
  })
  return data!.id
}

async function insertAssessment(forStudent: string, source: 'teacher' | 'parent', scores: Record<string, number>): Promise<string> {
  const { data } = await retryAsync(async () => {
    const r = await db.from('assessments')
      .insert({
        student_id: forStudent, user_id: authUserId, grade: 8, term: 2, year: 2026,
        grade_level: 'junior', subject_scores: scores, curriculum_type: 'cbc',
        assessment_style: 'formative', source,
      })
      .select('id').single()
    if (r.error) throw r.error
    return r
  })
  return data!.id
}

before(async () => {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${Date.now()}@example.com`
  const { data: authUser } = await retryAsync(async () => {
    const r = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
    if (r.error) throw r.error
    return r
  })
  authUserId = authUser.user.id

  const { data: teacher } = await retryAsync(async () => {
    const r = await db.from('teachers').insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
    if (r.error) throw r.error
    return r
  })
  teacherId = teacher!.id

  studentId = await insertStudent('Parent Intake Test')
  collisionStudentId = await insertStudent('Trust Collision Test')
  // A learner used by exactly one test (T), so the teacher-path regression
  // check cannot be perturbed by the collision probe's deliberate mutations.
  teacherOnlyStudentId = await insertStudent('Teacher Path Regression Test')

  parentAssessmentId = await insertAssessment(studentId, 'parent', { mathematics: 2, english: 3, kiswahili: 1 })
  teacherAssessmentId = await insertAssessment(collisionStudentId, 'teacher', { mathematics: 4 })
  teacherOnlyAssessmentId = await insertAssessment(teacherOnlyStudentId, 'teacher', { mathematics: 3, english: 4 })
})

after(async () => {
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort */ } }
  const students = [studentId, collisionStudentId, teacherOnlyStudentId].filter(Boolean)

  for (const id of students) {
    const { data: rows } = await db.from('learner_evidence').select('id').eq('learner_id', id)
    const ids = (rows ?? []).map(r => r.id)
    if (ids.length) await safely(() => db.from('evidence_audit_log').delete().in('evidence_id', ids))
    await safely(() => db.from('learner_projections').delete().eq('learner_id', id))
    await safely(() => db.from('evidence_projection_events').delete().eq('learner_id', id))
    await safely(() => db.from('learner_evidence').delete().eq('learner_id', id))
    await safely(() => db.from('assessments').delete().eq('student_id', id))
    await safely(() => db.from('student_learning_context').delete().eq('student_id', id))
    await safely(() => db.from('learner_profiles').delete().eq('student_id', id))
    await safely(() => db.from('students').delete().eq('id', id))
  }
  if (ingestionRunIds.length) await safely(() => db.from('ingestion_runs').delete().in('id', ingestionRunIds))
  if (teacherId) await safely(() => db.from('teachers').delete().eq('id', teacherId))
  if (authUserId) await safely(() => db.auth.admin.deleteUser(authUserId))
})

async function evidenceFor(learnerId: string) {
  const { data } = await db.from('learner_evidence')
    .select('id, subject, cbc_level, evidence_source, trust_tier, lifecycle_state, sub_strand_id, strand, sub_strand, supersedes, raw_input_ref, evidence_confidence')
    .eq('learner_id', learnerId)
    .order('created_at', { ascending: true })
  return data ?? []
}

// ════════════════════════════════════════════════════════════════════════════
// GATE — the critical trust-collision probe. Runs first, on its own learner.
// ════════════════════════════════════════════════════════════════════════════

test('GATE. a parent tier-1 pending claim must not degrade a teacher tier-3 confirmed claim', async () => {
  // 1. Teacher's confirmed claim, via the real producer.
  await recordReportCardAssessmentEvidence(teacherAssessmentId, collisionStudentId, teacherId, authUserId)

  const afterTeacher = await evidenceFor(collisionStudentId)
  const teacherRow = afterTeacher.find(r => r.evidence_source === 'teacher_upload')
  assert.ok(teacherRow, 'the teacher path must have emitted evidence')
  assert.equal(teacherRow!.lifecycle_state, 'auto_confirmed')
  assert.equal(teacherRow!.trust_tier, 3)
  assert.equal(teacherRow!.cbc_level, 4)

  const projectionAfterTeacher = await recomputeLearnerProjection(collisionStudentId)
  assert.equal(projectionAfterTeacher.academic?.value.bySubject.mathematics?.latestLevel, 4)

  // 2. A parent claim with the SAME claim key: same learner, subject
  //    (mathematics), assessment type (term_exam), year (2026), term (2) —
  //    but a contradicting level and tier-1 standing. Built directly rather
  //    than through the producer so the probe tests the Evidence Domain's
  //    semantics, not this file's plumbing.
  const confidence = computeConfidence({
    identityConfidence: 100, identityMatchType: 'external_id', fieldIssueCount: 0, source: 'parent_observation',
  })
  assert.ok(confidence < AUTO_CONFIRM_THRESHOLD, 'tier-1 confidence must sit below the auto-confirm threshold')
  assert.equal(resolveReviewStatus(confidence), 'pending_review')

  const { id: runId } = await repos.evidence.createIngestionRun({
    source: 'parent_observation', initiatedBy: authUserId, teacherId: null, institution: null,
  })
  ingestionRunIds.push(runId)

  const parentClaim: LearnerEvidence = {
    learnerId: collisionStudentId,
    extractedName: '', extractedExternalId: null,
    subject: 'mathematics', rawSubject: 'mathematics',
    score: null, cbcLevel: 1,
    assessmentType: 'term_exam', academicYear: 2026, term: 2,
    evidenceSource: 'parent_observation',
    trustTier: EVIDENCE_SOURCE_TRUST_TIER.parent_observation,
    evidenceConfidence: confidence,
    extractionMethod: `${SYNTHETIC_MARKER}_collision_probe`,
    reviewStatus: resolveReviewStatus(confidence),
    rawInputRef: `${SYNTHETIC_MARKER}:collision:mathematics`,
    importedAt: new Date().toISOString(),
    issues: [],
  }

  const result = await persistEvidenceBatch([parentClaim], runId)
  const parentRow = result.inserted[0]

  // 3. OBSERVE. Report what actually happened before asserting safety.
  const afterParent = await evidenceFor(collisionStudentId)
  const teacherRowAfter = afterParent.find(r => r.id === teacherRow!.id)!

  console.log('\n── TRUST-COLLISION PROBE OBSERVATION ─────────────────────────')
  console.log(`  teacher row lifecycle before: auto_confirmed`)
  console.log(`  teacher row lifecycle after:  ${teacherRowAfter.lifecycle_state}`)
  console.log(`  parent row lifecycle:         ${parentRow.lifecycle_state} (tier ${parentRow.trust_tier}, confidence ${parentRow.evidence_confidence})`)
  console.log(`  parent row supersedes:        ${parentRow.supersedes ?? 'null'}`)
  console.log('──────────────────────────────────────────────────────────────\n')

  // 4. The safety property that actually matters: what Projection reads.
  //    A pending_review row is not confirmed evidence, so it must not enter
  //    Projection, and it must not knock the teacher's confirmed row out of
  //    it either.
  assert.equal(parentRow.lifecycle_state, 'pending_review',
    'a parent claim must never be auto-confirmed — tier 1 is structurally incapable of it')

  assert.notEqual(teacherRowAfter.lifecycle_state, 'superseded',
    'STOP P0-B: a parent pending_review claim superseded a teacher auto_confirmed claim. ' +
    'Do not wire the parent route. This is an Evidence Domain design decision, not a producer fix.')

  const projectionAfterParent = await recomputeLearnerProjection(collisionStudentId)
  assert.equal(projectionAfterParent.academic?.value.bySubject.mathematics?.latestLevel, 4,
    'STOP P0-B: an unreviewed parent claim changed canonical academic state.')

  const confirmed = await repos.evidence.findConfirmedEvidenceForLearner(asStudentId(collisionStudentId))
  assert.ok(!confirmed.some(r => r.evidence_source === 'parent_observation'),
    'no parent_observation row may reach the confirmed set without a review')
})

test('GATE-2. [E4-UPDATED] the parent/teacher trust collision is now structurally impossible', async () => {
  // Phase 1 found that a parent tier-1 claim sharing a teacher claim's
  // six-field key received a `supersedes` pointer which lay dormant until a
  // teacher confirmed it — safe, but only because execution was deferred.
  //
  // Phase E4 removed the collision at its root. Supersession now follows
  // producer-declared ARTIFACT identity scoped to
  // (learner, evidence_source, correction_key), so a parent-sourced claim
  // can never target a teacher-sourced row at all. The pointer is never
  // written, so there is nothing to defer — a stronger guarantee than the
  // one this test originally recorded.
  const rows = await evidenceFor(collisionStudentId)
  const parentRow = rows.find(r => r.evidence_source === 'parent_observation')!
  const teacherRow = rows.find(r => r.evidence_source === 'teacher_upload')!

  assert.equal(parentRow.supersedes, null,
    'no pointer is created across producers — the collision cannot form')
  assert.equal(teacherRow.lifecycle_state, 'auto_confirmed', 'the teacher mark stands')

  // And confirming the parent claim changes nothing about the teacher's.
  const { confirmReview } = await import('@/lib/intelligence/evidenceLifecycle')
  await confirmReview(parentRow.id, authUserId, `${SYNTHETIC_MARKER}: teacher accepts the parent-reported score`)

  const after = await evidenceFor(collisionStudentId)
  const teacherAfter = after.find(r => r.id === teacherRow.id)!
  const parentAfter = after.find(r => r.id === parentRow.id)!

  assert.equal(parentAfter.lifecycle_state, 'reviewed_confirmed')
  assert.equal(teacherAfter.lifecycle_state, 'auto_confirmed',
    'a confirmed parent claim no longer displaces the teacher mark — both observations now stand')

  const projection = await recomputeLearnerProjection(collisionStudentId)
  assert.ok(projection.academic, 'and both contribute to the learner\'s record')
})

// ════════════════════════════════════════════════════════════════════════════
// P0-B behaviour
// ════════════════════════════════════════════════════════════════════════════

test('1+2+3+4. parent intake produces one tier-1, pending_review row per scored subject', async () => {
  await recordReportCardAssessmentEvidence(parentAssessmentId, studentId, null, authUserId)

  const rows = await evidenceFor(studentId)
  assert.equal(rows.length, 3, 'one row per scored subject (mathematics, english, kiswahili)')

  for (const row of rows) {
    assert.equal(row.evidence_source, 'parent_observation', 'source is chosen from assessments.source')
    assert.equal(row.trust_tier, 1, 'the existing tier for parent_observation — not a new tier')
    assert.equal(row.lifecycle_state, 'pending_review', 'never auto-confirmed')
    assert.ok(row.evidence_confidence <= 60, 'tier-1 ceiling applies')
  }

  assert.deepEqual(
    rows.map(r => r.subject).sort(),
    ['english', 'kiswahili', 'mathematics'],
  )
  assert.deepEqual(
    rows.sort((a, b) => a.subject.localeCompare(b.subject)).map(r => r.cbc_level),
    [3, 1, 2],
    'levels are carried through verbatim from subject_scores',
  )
})

test('5. re-processing the same assessment does not create another evidence set', async () => {
  const before = await evidenceFor(studentId)
  await recordReportCardAssessmentEvidence(parentAssessmentId, studentId, null, authUserId)
  await recordReportCardAssessmentEvidence(parentAssessmentId, studentId, null, authUserId)
  const after = await evidenceFor(studentId)

  assert.equal(after.length, before.length, 'idempotent — no redundant rows, no redundant supersession chain')
  assert.deepEqual(after.map(r => r.id).sort(), before.map(r => r.id).sort(), 'the same rows, untouched')
})

test('7+8. sub_strand_id is null and no strand is fabricated — the source has no curriculum anchor', async () => {
  const rows = await evidenceFor(studentId)
  for (const row of rows) {
    assert.equal(row.sub_strand_id, null,
      'the `assessments` table has no strand/sub-strand columns; inventing one would be fake curriculum identity')
    assert.equal(row.strand, null)
    assert.equal(row.sub_strand, null)
  }
})

test('9. derived Clinic diagnoses are not stored as evidence', async () => {
  const rows = await evidenceFor(studentId)
  // Only the raw per-subject observations become evidence. Tiers, root
  // causes, pathway scores, career notes and guided topics are derived
  // diagnosis or AI interpretation and must have no representation here.
  assert.equal(rows.length, 3, 'exactly the three scored subjects — nothing derived was emitted')
  for (const row of rows) {
    assert.ok(row.raw_input_ref.startsWith(`assessments:${parentAssessmentId}:`),
      'every row traces to the raw assessment, never to a derived diagnosis')
  }
})

test('6. a teacher review promotes the parent claim into canonical state', async () => {
  const rows = await evidenceFor(studentId)
  const maths = rows.find(r => r.subject === 'mathematics')!

  const beforeProjection = await recomputeLearnerProjection(studentId)
  assert.equal(beforeProjection.academic, null, 'nothing pending has reached Projection')

  const { confirmReview } = await import('@/lib/intelligence/evidenceLifecycle')
  await confirmReview(maths.id, authUserId, `${SYNTHETIC_MARKER}: teacher confirms the parent-reported score`)

  const afterProjection = await recomputeLearnerProjection(studentId)
  assert.equal(afterProjection.academic?.value.bySubject.mathematics?.latestLevel, 2,
    'the teacher review — and only the teacher review — is what admits it to canonical state')
})

test('11. the Clinic\'s own outputs are untouched by evidence emission', async () => {
  // This producer reads `assessments` and writes only `learner_evidence` +
  // its ingestion run. The assessment row and the Clinic's
  // student_learning_context must be exactly as the pipeline left them.
  const { data: assessment } = await db.from('assessments')
    .select('subject_scores, source, term, year').eq('id', parentAssessmentId).maybeSingle()
  assert.deepEqual(assessment!.subject_scores, { mathematics: 2, english: 3, kiswahili: 1 })
  assert.equal(assessment!.source, 'parent')

  const { data: ctx } = await db.from('student_learning_context')
    .select('student_id').eq('student_id', studentId).maybeSingle()
  assert.equal(ctx, null, 'this test never ran the Clinic pipeline, and the producer did not invent a context row')
})

test('12. a producer failure cannot fail assessment processing (fire-and-forget contract)', async () => {
  // A non-existent assessment id is the cheapest real failure path: the
  // producer must return quietly rather than throw, because both routes
  // invoke it fire-and-forget after the pipeline has already succeeded.
  await assert.doesNotReject(
    () => recordReportCardAssessmentEvidence('00000000-0000-0000-0000-000000000000', studentId, null, authUserId),
  )
})

test('T. the teacher path is unchanged — same source, tier and auto-confirmation as before', async () => {
  // Its own learner: the collision probe above deliberately supersedes its
  // teacher row, so asserting the teacher path's normal behaviour there
  // would be asserting against a state another test intentionally changed.
  await recordReportCardAssessmentEvidence(teacherOnlyAssessmentId, teacherOnlyStudentId, teacherId, authUserId)

  const rows = await evidenceFor(teacherOnlyStudentId)
  assert.equal(rows.length, 2, 'one row per scored subject, exactly as before P0-B')
  for (const row of rows) {
    assert.equal(row.evidence_source, 'teacher_upload', 'assessments.source = teacher still maps to teacher_upload')
    assert.equal(row.trust_tier, 3)
    assert.equal(row.lifecycle_state, 'auto_confirmed', 'teacher-entered scores still auto-confirm')
    assert.ok(row.raw_input_ref.startsWith(`assessments:${teacherOnlyAssessmentId}:`), 'provenance format is unchanged')
  }

  const projection = await recomputeLearnerProjection(teacherOnlyStudentId)
  assert.equal(projection.academic?.value.bySubject.mathematics?.latestLevel, 3,
    'and still reaches canonical state without a review, exactly as before')
})
