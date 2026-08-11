// lib/learnerBlueprint/actionPlan/review.integration.test.ts
//
// Phase 2D (docs/architecture/blueprint-review-loop-phase2d.md) —
// integration tests against real (synthetic, cleaned-up) rows and real
// authenticated sessions for `reviewBlueprintAction()` /
// `getBlueprintActionReviewSnapshot()`. Called directly (not over HTTP),
// like Phase 2B/2C's own lib-level integration tests.
//
// This is one continuous story, run as sequential tests sharing state (node
// :test runs top-level tests in definition order): deliver an action to
// both Assignment and Compass, prove downstream activity (submission
// marking, Compass sessions, new Evidence, a new Projection) never
// completes the action on its own, then prove only an explicit
// reviewBlueprintAction() call records a verdict — and that every one of
// the five decisions, and the read-only guardrails, hold.
//
// Run with: npx tsx --env-file=.env.local --test lib/learnerBlueprint/actionPlan/review.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { UnauthorizedError, ResourceOwnershipError, ConflictError } from '@/lib/core/errors'
import { deliverBlueprintActionAsAssignment } from './delivery/assignment'
import { deliverBlueprintActionToCompass } from './delivery/compass'
import { getBlueprintActionReviewSnapshot, reviewBlueprintAction } from './review'
import { EVIDENCE_BASIS_EMPTY } from './types'
import { startIngestionRun } from '@/lib/intelligence/ingestionRun'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import type { LearnerEvidence, CBCLevel } from '@/lib/intelligence/evidence'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import type { BlueprintActionItemRow } from '@/lib/repositories/blueprintActionItem.repository'

const SYNTHETIC_MARKER = 'SYNTHETIC_BLUEPRINT_REVIEW_PHASE2D_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 400 * attempt))
  }
  throw lastError
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await retryAsync(async () => {
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
    if (error) throw error
  })
  return client
}

let schoolId: string
let coreLearnerId: string, legacyStudentId: string
let classId: string
let teacherUserId: string, teacherEmail: string, teacherId: string
let unrelatedTeacherUserId: string, unrelatedTeacherEmail: string
let teacherClient: SupabaseClient

const teacherRowIds: string[] = []
const createdAssignmentIds: string[] = []
const ingestionRunIds: string[] = []
let actionId: string
let assignmentId: string

function baseActionFields(overrides: Partial<Parameters<typeof repos.blueprintActionItems.insert>[0]> = {}) {
  return {
    learner_id: coreLearnerId,
    school_id: schoolId,
    academic_year_id: null,
    term_id: null,
    blueprint_snapshot_id: null,
    context: 'current_term' as const,
    priority: 'medium' as const,
    visibility: 'teacher_only' as const,
    title: 'Reading Fluency',
    rationale: 'Recent evidence shows steady development in reading.',
    intended_outcome: 'Reach fluent oral reading by end of term.',
    learner_action: 'Read aloud for 10 minutes daily.',
    teacher_action: null,
    parent_support: null,
    school_support: null,
    success_indicator: 'Next confirmed assessment shows improved reading accuracy.',
    target_capability: null,
    sub_strand_id: null,
    review_date: '2026-08-15',
    teacher_notes: null,
    proposal_source: 'teacher' as const,
    source_generator: null,
    evidence_basis: EVIDENCE_BASIS_EMPTY,
    proposed_by: null,
    ...overrides,
  }
}

async function insertApprovedAction(): Promise<BlueprintActionItemRow> {
  const row = await repos.blueprintActionItems.insert(baseActionFields())
  return repos.blueprintActionItems.recordDecision(row.id, {
    status: 'approved', reviewed_by: null, reviewed_at: new Date().toISOString(), decision_reason: null, review_date: null,
  })
}

async function addEvidence(subject: string, score: number, cbcLevel: CBCLevel): Promise<void> {
  const run = await startIngestionRun({ source: 'csv_export', initiatedBy: teacherUserId, teacherId: null, institution: SYNTHETIC_MARKER })
  ingestionRunIds.push(run.id)
  const evidence: LearnerEvidence = {
    learnerId: legacyStudentId, extractedName: SYNTHETIC_MARKER, extractedExternalId: null,
    subject, rawSubject: subject, score, cbcLevel,
    assessmentType: 'cat', academicYear: 2026, term: 1, evidenceSource: 'csv_export',
    trustTier: 2, evidenceConfidence: 95, extractionMethod: 'csv_parser_v1',
    reviewStatus: 'auto_confirmed', rawInputRef: `test:${SYNTHETIC_MARKER}:${legacyStudentId}:${Date.now()}:${Math.random()}`,
    importedAt: new Date().toISOString(), issues: [],
  }
  await persistEvidenceBatch([evidence], run.id)
}

before(async () => {
  const mkUser = async (label: string) => {
    const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
    const { data } = await retryAsync(async () => {
      const res = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
      if (res.error) throw res.error
      return res
    })
    return { id: data.user.id, email }
  }

  const teacher = await mkUser('teacher'); teacherUserId = teacher.id; teacherEmail = teacher.email
  const unrelatedTeacher = await mkUser('unrelated-teacher'); unrelatedTeacherUserId = unrelatedTeacher.id; unrelatedTeacherEmail = unrelatedTeacher.email

  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, teacherUserId)
  schoolId = school.id

  await db.from('school_users').insert([
    { school_id: schoolId, user_id: teacherUserId, role: 'teacher', is_active: true },
    { school_id: schoolId, user_id: unrelatedTeacherUserId, role: 'teacher', is_active: true },
  ])

  const { data: teacherRow } = await db.from('teachers')
    .insert({ user_id: teacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherId = teacherRow!.id; teacherRowIds.push(teacherId)

  const { data: unrelatedTeacherRow } = await db.from('teachers')
    .insert({ user_id: unrelatedTeacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherRowIds.push(unrelatedTeacherRow!.id)

  const { data: classRow } = await db.from('teacher_classes')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'English', class_code: `SYNTH-${Date.now()}-R` })
    .select('id').single()
  classId = classRow!.id

  const { data: learnerRow } = await db.from('learners')
    .insert({ school_id: schoolId, admission_number: `${SYNTHETIC_MARKER}-001`, first_name: 'Amani', last_name: 'Test' })
    .select('id').single()
  coreLearnerId = learnerRow!.id

  const { data: studentRow } = await db.from('students')
    .insert({ name: 'Amani Test', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', external_id: coreLearnerId })
    .select('id').single()
  legacyStudentId = studentRow!.id

  await db.from('class_students').insert({ class_id: classId, student_id: legacyStudentId })

  teacherClient = await signInAs(teacherEmail)

  const action = await insertApprovedAction()
  actionId = action.id
})

after(async () => {
  // `blueprint_action_reviews` (this phase) and `blueprint_action_item_history`
  // are unconditionally append-only (DB triggers reject UPDATE/DELETE, even
  // for the service-role client), and `blueprint_action_items` itself is
  // immutable once `approved` (Phase 1's own trigger) — the exact same
  // intentional-immutability-vs-cleanup tension already documented for
  // `SYNTHETIC_` schools in docs/architecture/blueprint-compass-delivery-
  // phase2c.md §16. No explicit delete is attempted against any of the
  // three; they are left as accepted test debt, matching every prior
  // Blueprint phase's own integration test (none of them delete
  // `blueprint_action_items` or `blueprint_action_item_history` either).
  if (createdAssignmentIds.length) await db.from('assignments').delete().in('id', createdAssignmentIds)
  await db.from('blueprint_compass_deliveries').delete().eq('blueprint_action_item_id', actionId)
  await db.from('compass_sessions').delete().eq('learner_id', legacyStudentId)
  if (ingestionRunIds.length) await db.from('learner_evidence').delete().in('ingestion_run_id', ingestionRunIds)
  await db.from('learner_projections').delete().eq('learner_id', legacyStudentId)
  await db.from('class_students').delete().eq('class_id', classId)
  await db.from('students').delete().eq('id', legacyStudentId)
  await db.from('teacher_classes').delete().eq('id', classId)
  await db.from('teachers').delete().in('id', teacherRowIds)
  await db.from('school_users').delete().eq('school_id', schoolId)
  // learners/schools deletes are attempted for symmetry with other phases'
  // tests but will silently no-op (error swallowed, not thrown, by
  // supabase-js) if the still-present blueprint_action_items row blocks the
  // cascade — see comment above.
  await db.from('learners').delete().eq('id', coreLearnerId)
  await db.from('schools').delete().eq('id', schoolId)
  for (const id of [teacherUserId, unrelatedTeacherUserId]) await db.auth.admin.deleteUser(id)
})

// ── Preconditions ────────────────────────────────────────────────────────────

test('an undelivered action item cannot be reviewed', async () => {
  await assert.rejects(() => getBlueprintActionReviewSnapshot(teacherClient, actionId), ConflictError)
})

test('unauthenticated caller cannot read a review snapshot', async () => {
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await assert.rejects(() => reviewBlueprintAction(anon, actionId, { decision: 'complete' }), UnauthorizedError)
})

// ── Delivery, then downstream activity that must never auto-complete ───────

test('deliver the action to Assignment and Compass', async () => {
  const { assignment } = await deliverBlueprintActionAsAssignment(teacherClient, actionId, {
    classId, confirmClassWideDelivery: true, subject: 'English', topic: 'Reading', dueDate: '2026-09-01',
  })
  assignmentId = assignment.id
  createdAssignmentIds.push(assignmentId)

  const { delivery } = await deliverBlueprintActionToCompass(teacherClient, actionId, {
    confirmCompassDelivery: true, subject: 'english',
  })
  assert.equal(delivery.blueprint_action_item_id, actionId)

  const snapshot = await getBlueprintActionReviewSnapshot(teacherClient, actionId)
  assert.equal(snapshot.assignment.delivered, true)
  assert.equal(snapshot.compass.delivered, true)
  assert.equal(snapshot.latestDecision, 'awaiting_review')
})

test('assignment completion alone does not complete the action', async () => {
  await db.from('assignment_submissions').update({ status: 'marked', score: 90, marked_at: new Date().toISOString() }).eq('assignment_id', assignmentId)

  const snapshot = await getBlueprintActionReviewSnapshot(teacherClient, actionId)
  assert.equal(snapshot.assignment.delivered, true)
  if (snapshot.assignment.delivered) assert.equal(snapshot.assignment.completionLabel, 'completed')
  assert.equal(snapshot.latestDecision, 'awaiting_review')

  const refetched = await repos.blueprintActionItems.findById(actionId)
  assert.equal(refetched!.status, 'approved')
})

test('Compass completion alone does not complete the action', async () => {
  await db.from('compass_sessions').insert({
    learner_id: legacyStudentId, subject: 'english', mode: 'school', status: 'completed',
    session_state: {}, exchange_count: 4,
  })

  const snapshot = await getBlueprintActionReviewSnapshot(teacherClient, actionId)
  assert.equal(snapshot.compass.delivered, true)
  if (snapshot.compass.delivered) {
    assert.equal(snapshot.compass.sessionCount, 1)
    assert.equal(snapshot.compass.completedCount, 1)
  }
  assert.equal(snapshot.latestDecision, 'awaiting_review')

  const refetched = await repos.blueprintActionItems.findById(actionId)
  assert.equal(refetched!.status, 'approved')
})

test('new evidence alone does not complete the action, and review reads the latest evidence', async () => {
  await addEvidence('english', 55, 2)
  await addEvidence('english', 78, 3) // the newer, higher-scoring entry — should be what "latest" reflects

  const snapshot = await getBlueprintActionReviewSnapshot(teacherClient, actionId)
  assert.ok(snapshot.evidence.count >= 2)
  assert.match(snapshot.evidence.latestSummary ?? '', /score 78/)
  assert.equal(snapshot.latestDecision, 'awaiting_review')

  const refetched = await repos.blueprintActionItems.findById(actionId)
  assert.equal(refetched!.status, 'approved')
})

test('new projection alone does not complete the action, and review reads the latest persisted projection', async () => {
  const computed = await recomputeLearnerProjection(legacyStudentId)
  void computed

  const snapshot = await getBlueprintActionReviewSnapshot(teacherClient, actionId)
  assert.ok(snapshot.projection.projections.length > 0)

  const direct = await repos.projections.findProjectionsForLearner(legacyStudentId)
  for (const entry of snapshot.projection.projections) {
    const match = direct.find(d => d.projector_type === entry.projectorType)
    assert.ok(match, `expected a persisted projection row for ${entry.projectorType}`)
    assert.equal(entry.confidence, match!.confidence)
  }
  assert.equal(snapshot.latestDecision, 'awaiting_review')

  const refetched = await repos.blueprintActionItems.findById(actionId)
  assert.equal(refetched!.status, 'approved')
})

// ── Only an explicit teacher review records a verdict ───────────────────────

test('an unrelated teacher cannot review this learner\'s action', async () => {
  const unrelatedClient = await signInAs(unrelatedTeacherEmail)
  await assert.rejects(() => reviewBlueprintAction(unrelatedClient, actionId, { decision: 'complete' }), ResourceOwnershipError)
})

test('teacher review completes the action — the action item status itself is never mutated', async () => {
  const { review, snapshot } = await reviewBlueprintAction(teacherClient, actionId, { decision: 'complete', notes: 'Reading accuracy improved substantially.' })
  assert.equal(review.decision, 'complete')
  assert.equal(snapshot.latestDecision, 'complete')

  const refetched = await repos.blueprintActionItems.findById(actionId)
  assert.equal(refetched!.status, 'approved', 'a review verdict never changes the action item\'s own lifecycle status')

  const readBack = await getBlueprintActionReviewSnapshot(teacherClient, actionId)
  assert.equal(readBack.latestDecision, 'complete')
  assert.equal(readBack.previousReviews.length, 1)
})

test('teacher can reopen', async () => {
  const { review } = await reviewBlueprintAction(teacherClient, actionId, { decision: 'reopen', notes: 'Needs another cycle of practice.' })
  assert.equal(review.decision, 'reopen')
  const snapshot = await getBlueprintActionReviewSnapshot(teacherClient, actionId)
  assert.equal(snapshot.latestDecision, 'reopen')
  assert.equal(snapshot.previousReviews.length, 2)
})

test('teacher can defer', async () => {
  const { review } = await reviewBlueprintAction(teacherClient, actionId, { decision: 'defer' })
  assert.equal(review.decision, 'defer')
  const snapshot = await getBlueprintActionReviewSnapshot(teacherClient, actionId)
  assert.equal(snapshot.latestDecision, 'defer')
  assert.equal(snapshot.previousReviews.length, 3)
})

test('teacher can request revision', async () => {
  const { review } = await reviewBlueprintAction(teacherClient, actionId, { decision: 'needs_revision', notes: 'Adjust the target — too ambitious for this term.' })
  assert.equal(review.decision, 'needs_revision')
  const snapshot = await getBlueprintActionReviewSnapshot(teacherClient, actionId)
  assert.equal(snapshot.latestDecision, 'needs_revision')
  assert.equal(snapshot.previousReviews.length, 4)
})

test('teacher can record no_decision — the review looked, but reached no verdict yet', async () => {
  const { review } = await reviewBlueprintAction(teacherClient, actionId, { decision: 'no_decision' })
  assert.equal(review.decision, 'no_decision')
  const snapshot = await getBlueprintActionReviewSnapshot(teacherClient, actionId)
  assert.equal(snapshot.latestDecision, 'no_decision')
  assert.equal(snapshot.previousReviews.length, 5)
})

// ── History is append-only ──────────────────────────────────────────────────

test('history is append-only: every review appended a distinct, correctly-typed history event, and no history row can be altered', async () => {
  const history = await repos.blueprintActionItemHistory.listForActionItem(actionId)
  const reviewEvents = history.filter(h => h.event_type.startsWith('review_'))
  assert.deepEqual(
    reviewEvents.map(e => e.event_type),
    ['review_completed', 'review_reopened', 'review_deferred', 'review_revision_requested', 'review_no_decision'],
  )
  for (const e of reviewEvents) assert.equal(e.resulting_status, 'approved')

  const { error } = await db.from('blueprint_action_item_history').update({ reason: 'tampered' }).eq('id', reviewEvents[0].id)
  assert.ok(error, 'blueprint_action_item_history must reject an UPDATE even from the service-role client')
})

test('a review row itself is immutable: neither UPDATE nor DELETE is accepted, even from the service-role client', async () => {
  const reviews = await repos.blueprintActionReviews.listForActionItem(actionId)
  assert.ok(reviews.length >= 5)

  const updateResult = await db.from('blueprint_action_reviews').update({ decision: 'complete' }).eq('id', reviews[0].id)
  assert.ok(updateResult.error, 'blueprint_action_reviews must reject an UPDATE')

  const deleteResult = await db.from('blueprint_action_reviews').delete().eq('id', reviews[0].id)
  assert.ok(deleteResult.error, 'blueprint_action_reviews must reject a DELETE')
})

// ── Guardrails: review never writes to the systems it reads ────────────────

test('reviewBlueprintAction() writes no evidence', async () => {
  const before = await db.from('learner_evidence').select('id').eq('learner_id', legacyStudentId)
  await reviewBlueprintAction(teacherClient, actionId, { decision: 'no_decision' })
  const after = await db.from('learner_evidence').select('id').eq('learner_id', legacyStudentId)
  assert.equal(after.data?.length, before.data?.length)
})

test('reviewBlueprintAction() writes no projection', async () => {
  const before = await db.from('learner_projections').select('id, last_computed').eq('learner_id', legacyStudentId)
  await reviewBlueprintAction(teacherClient, actionId, { decision: 'no_decision' })
  const after = await db.from('learner_projections').select('id, last_computed').eq('learner_id', legacyStudentId)
  assert.deepEqual(after.data, before.data)
})

test('reviewBlueprintAction() performs no Compass mutation', async () => {
  const before = await db.from('compass_sessions').select('id, status, updated_at').eq('learner_id', legacyStudentId)
  await reviewBlueprintAction(teacherClient, actionId, { decision: 'no_decision' })
  const after = await db.from('compass_sessions').select('id, status, updated_at').eq('learner_id', legacyStudentId)
  assert.deepEqual(after.data, before.data)
})

test('reviewBlueprintAction() performs no assignment mutation', async () => {
  const beforeAssignment = await db.from('assignments').select('status, updated_at').eq('id', assignmentId).single()
  const beforeSubmissions = await db.from('assignment_submissions').select('id, status, score').eq('assignment_id', assignmentId)
  await reviewBlueprintAction(teacherClient, actionId, { decision: 'no_decision' })
  const afterAssignment = await db.from('assignments').select('status, updated_at').eq('id', assignmentId).single()
  const afterSubmissions = await db.from('assignment_submissions').select('id, status, score').eq('assignment_id', assignmentId)
  assert.deepEqual(afterAssignment.data, beforeAssignment.data)
  assert.deepEqual(afterSubmissions.data, beforeSubmissions.data)
})
