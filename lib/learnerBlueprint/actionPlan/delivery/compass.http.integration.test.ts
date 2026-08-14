// lib/learnerBlueprint/actionPlan/delivery/compass.http.integration.test.ts
//
// HTTP-level proof that the route
// (app/api/teacher/blueprint/actions/[actionItemId]/deliver-compass) wires
// request parsing and error-to-status mapping correctly onto the Phase 2C
// delivery adapter. The adapter's own authorization/lifecycle/idempotency
// matrix is exhaustively covered at the lib level in
// compass.integration.test.ts (no server required there) — this file only
// needs to prove the route itself, over real HTTP, and that the ordinary
// Compass topic route and Phase 2B assignment-delivery route remain green.
//
// Requires a server already running at LMS_TEST_BASE_URL (default
// http://localhost:3939).
//
// Run: LMS_TEST_BASE_URL=http://localhost:3939 npx tsx --env-file=.env.local --test lib/learnerBlueprint/actionPlan/delivery/compass.http.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'
import { EVIDENCE_BASIS_EMPTY } from '../types'
import { asLearnerId } from '@/lib/core/identityTypes'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const SYNTHETIC_MARKER = 'SYNTHETIC_BLUEPRINT_COMPASS_HTTP_TEST'
const db = createServiceClient()

let schoolId: string
let coreLearnerId: string, legacyStudentId: string
let classId: string, teacherId: string
let teacherAuthId: string, teacherSession: SyntheticSession
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
    title: 'Build fluency in fractions', rationale: 'Recent evidence shows steady development.',
    intended_outcome: 'Reach confident fluency adding and subtracting fractions.',
    learner_action: 'Practice fraction addition with Compass for 15 minutes.',
    teacher_action: null, parent_support: null, school_support: null,
    success_indicator: 'Solves 4/5 fraction addition problems correctly.',
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
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `SYNTH-${Date.now()}` })
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
  await db.from('blueprint_compass_deliveries').delete().in('blueprint_action_item_id', createdActionIds)
  await db.from('student_learning_context').delete().eq('student_id', legacyStudentId)
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

function deliverUrl(actionItemId: string) {
  return `${BASE_URL}/api/teacher/blueprint/actions/${actionItemId}/deliver-compass`
}

test('POST .../deliver-compass: unauthenticated request is rejected with 401', async () => {
  const action = await insertApprovedAction()
  const res = await fetch(deliverUrl(action.id), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmCompassDelivery: true, subject: 'mathematics' }),
  })
  assert.equal(res.status, 401)
})

test('POST .../deliver-compass: missing confirmCompassDelivery in the body is rejected with 400', async () => {
  const action = await insertApprovedAction()
  const res = await fetch(deliverUrl(action.id), {
    method: 'POST', headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: 'mathematics' }),
  })
  assert.equal(res.status, 400)
})

test('POST .../deliver-compass: a non-existent action item id is rejected with 404', async () => {
  const res = await fetch(deliverUrl('00000000-0000-0000-0000-000000000000'), {
    method: 'POST', headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmCompassDelivery: true, subject: 'mathematics' }),
  })
  assert.equal(res.status, 404)
})

test('POST .../deliver-compass: confirmCompassDelivery: false is rejected with 400', async () => {
  const action = await insertApprovedAction()
  const res = await fetch(deliverUrl(action.id), {
    method: 'POST', headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmCompassDelivery: false, subject: 'mathematics' }),
  })
  assert.equal(res.status, 400)
})

test('POST .../deliver-compass: the authorized teacher succeeds end-to-end over real HTTP (201, then 200 on retry)', async () => {
  const action = await insertApprovedAction()
  const res = await fetch(deliverUrl(action.id), {
    method: 'POST', headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmCompassDelivery: true, subject: 'mathematics' }),
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(body.data.alreadyDelivered, false)
  assert.equal(body.data.delivery.blueprint_action_item_id, action.id)
  assert.equal(body.data.delivery.status, 'available')

  const retry = await fetch(deliverUrl(action.id), {
    method: 'POST', headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmCompassDelivery: true, subject: 'mathematics' }),
  })
  assert.equal(retry.status, 200)
  const retryBody = await retry.json()
  assert.equal(retryBody.data.alreadyDelivered, true)
  assert.equal(retryBody.data.delivery.id, body.data.delivery.id)
})

test('the existing teacher compass-topic route remains green after the extraction', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/students/${legacyStudentId}/compass-topic`, {
    method: 'PATCH', headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: 'english', concept: 'Grammar basics', strandName: 'Grammar' }),
  })
  assert.equal(res.status, 200)
  const ctx = await repos.compass.getStudentLearningContext(legacyStudentId)
  assert.equal(ctx?.compass_bridge.firstSubject, 'english')
  assert.equal(ctx?.compass_bridge.teacherSuggested, true)
})

test('the existing Blueprint assignment-delivery route (Phase 2B) remains green', async () => {
  const action = await insertApprovedAction()
  const res = await fetch(`${BASE_URL}/api/teacher/blueprint/actions/${action.id}/deliver-assignment`, {
    method: 'POST', headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      classId, confirmClassWideDelivery: true, subject: 'Mathematics', topic: 'Fractions', dueDate: '2026-09-01',
    }),
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  await db.from('assignments').delete().eq('id', body.data.assignment.id)
})
