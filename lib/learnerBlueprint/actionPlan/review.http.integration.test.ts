// lib/learnerBlueprint/actionPlan/review.http.integration.test.ts
//
// HTTP-level proof that the route
// (app/api/teacher/blueprint/actions/[actionItemId]/review) wires request
// parsing and error-to-status mapping correctly onto the Phase 2D review
// service. The service's own authorization/precondition/guardrail matrix is
// exhaustively covered at the lib level in review.integration.test.ts (no
// server required there) — this file only needs to prove the route itself,
// over real HTTP.
//
// Requires a server already running at LMS_TEST_BASE_URL (default
// http://localhost:3939).
//
// Run: LMS_TEST_BASE_URL=http://localhost:3939 npx tsx --env-file=.env.local --test lib/learnerBlueprint/actionPlan/review.http.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'
import { EVIDENCE_BASIS_EMPTY } from './types'
import { asLearnerId } from '@/lib/core/identityTypes'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const SYNTHETIC_MARKER = 'SYNTHETIC_BLUEPRINT_REVIEW_HTTP_TEST'
const db = createServiceClient()

let schoolId: string
let coreLearnerId: string, legacyStudentId: string
let classId: string, teacherId: string
let teacherAuthId: string, teacherSession: SyntheticSession
const createdAssignmentIds: string[] = []
const createdActionIds: string[] = []

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

async function createSyntheticUser(label: string) {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data } = await retryAsync(async () => {
    const res = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (res.error) throw res.error
    return res
  })
  const session = await retryAsync(() => signInForHttpTest(email, password))
  return { authId: data.user.id, session }
}

async function insertApprovedAction() {
  const row = await repos.blueprintActionItems.insert({
    learner_id: asLearnerId(coreLearnerId), school_id: schoolId, academic_year_id: null, term_id: null, blueprint_snapshot_id: null,
    context: 'current_term', priority: 'medium', visibility: 'teacher_only',
    title: 'Reading Fluency', rationale: 'Recent evidence shows steady development.',
    intended_outcome: 'Reach fluent oral reading by end of term.',
    learner_action: 'Read aloud for 10 minutes daily.',
    teacher_action: null, parent_support: null, school_support: null,
    success_indicator: 'Next confirmed assessment shows improved reading accuracy.',
    target_capability: null,
    sub_strand_id: null, review_date: '2026-08-15', teacher_notes: null,
    proposal_source: 'teacher', source_generator: null, evidence_basis: EVIDENCE_BASIS_EMPTY, proposed_by: null,
  })
  const approved = await repos.blueprintActionItems.recordDecision(row.id, {
    status: 'approved', reviewed_by: null, reviewed_at: new Date().toISOString(), decision_reason: null, review_date: null,
  })
  createdActionIds.push(approved.id)
  return approved
}

before(async () => {
  const teacher = await createSyntheticUser('teacher')
  teacherAuthId = teacher.authId; teacherSession = teacher.session

  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, teacherAuthId)
  schoolId = school.id
  await db.from('school_users').insert({ school_id: schoolId, user_id: teacherAuthId, role: 'teacher', is_active: true })

  const { data: teacherRow } = await db.from('teachers')
    .insert({ user_id: teacherAuthId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherId = teacherRow!.id

  const { data: classRow } = await db.from('teacher_classes')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'English', class_code: `SYNTH-${Date.now()}` })
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
})

after(async () => {
  if (createdAssignmentIds.length) await db.from('assignments').delete().in('id', createdAssignmentIds)
  // blueprint_action_items/blueprint_action_item_history/blueprint_action_reviews
  // are immutable once approved/reviewed — left as accepted test debt, same
  // as every prior Blueprint phase's HTTP test file (see
  // review.integration.test.ts's after() for the full explanation).
  await db.from('blueprint_compass_deliveries').delete().in('blueprint_action_item_id', createdActionIds)
  await db.from('class_students').delete().eq('class_id', classId)
  await db.from('students').delete().eq('id', legacyStudentId)
  await db.from('teacher_classes').delete().eq('id', classId)
  await db.from('learners').delete().eq('id', coreLearnerId)
  await db.from('teachers').delete().eq('id', teacherId)
  await db.from('school_users').delete().eq('school_id', schoolId)
  await db.from('schools').delete().eq('id', schoolId)
  await db.auth.admin.deleteUser(teacherAuthId)
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

function reviewUrl(actionItemId: string) {
  return `${BASE_URL}/api/teacher/blueprint/actions/${actionItemId}/review`
}

test('GET .../review: unauthenticated request is rejected with 401', async () => {
  const action = await insertApprovedAction()
  const res = await fetch(reviewUrl(action.id))
  assert.equal(res.status, 401)
})

test('GET .../review: an undelivered action item is rejected with 409 (nothing to review yet)', async () => {
  const action = await insertApprovedAction()
  const res = await fetch(reviewUrl(action.id), { headers: cookie(teacherSession) })
  assert.equal(res.status, 409)
})

test('GET .../review: a non-existent action item id is rejected with 404', async () => {
  const res = await fetch(reviewUrl('00000000-0000-0000-0000-000000000000'), { headers: cookie(teacherSession) })
  assert.equal(res.status, 404)
})

test('POST .../review: missing decision in the body is rejected with 400 (zod shape)', async () => {
  const action = await insertApprovedAction()
  const res = await fetch(reviewUrl(action.id), {
    method: 'POST', headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: 'no decision field' }),
  })
  assert.equal(res.status, 400)
})

test('POST .../review: an invalid decision value is rejected with 400', async () => {
  const action = await insertApprovedAction()
  const res = await fetch(reviewUrl(action.id), {
    method: 'POST', headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision: 'approved_automatically' }),
  })
  assert.equal(res.status, 400)
})

test('GET then POST .../review: the authorized teacher sees the review screen, then records a decision end-to-end over real HTTP', async () => {
  const action = await insertApprovedAction()

  const deliverRes = await fetch(`${BASE_URL}/api/teacher/blueprint/actions/${action.id}/deliver-assignment`, {
    method: 'POST', headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId, confirmClassWideDelivery: true, subject: 'English', topic: 'Reading', dueDate: '2026-09-01' }),
  })
  assert.equal(deliverRes.status, 201)
  const deliverBody = await deliverRes.json()
  createdAssignmentIds.push(deliverBody.data.assignment.id)

  const getRes = await fetch(reviewUrl(action.id), { headers: cookie(teacherSession) })
  assert.equal(getRes.status, 200)
  const getBody = await getRes.json()
  assert.equal(getBody.data.snapshot.latestDecision, 'awaiting_review')
  assert.equal(getBody.data.snapshot.assignment.delivered, true)
  assert.equal(getBody.data.snapshot.compass.delivered, false)

  const postRes = await fetch(reviewUrl(action.id), {
    method: 'POST', headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision: 'complete', notes: 'Reading accuracy improved.' }),
  })
  assert.equal(postRes.status, 201)
  const postBody = await postRes.json()
  assert.equal(postBody.data.review.decision, 'complete')
  assert.equal(postBody.data.snapshot.latestDecision, 'complete')

  const readBack = await fetch(reviewUrl(action.id), { headers: cookie(teacherSession) })
  const readBackBody = await readBack.json()
  assert.equal(readBackBody.data.snapshot.latestDecision, 'complete')
  assert.equal(readBackBody.data.snapshot.previousReviews.length, 1)
})
