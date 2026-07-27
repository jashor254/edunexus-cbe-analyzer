// lib/learnerBlueprint/actionPlan/delivery/assignment.http.integration.test.ts
//
// HTTP-level proof that the route
// (app/api/teacher/blueprint/actions/[actionItemId]/deliver-assignment)
// wires request parsing and error-to-status mapping correctly onto the
// Phase 2B delivery adapter. The adapter's own authorization/lifecycle/
// idempotency matrix is exhaustively covered at the lib level in
// assignment.integration.test.ts (no server required there) — this file
// only needs to prove the route itself, over real HTTP.
//
// Requires a server already running at LMS_TEST_BASE_URL (default
// http://localhost:3939).
//
// Run: LMS_TEST_BASE_URL=http://localhost:3939 npx tsx --env-file=.env.local --test lib/learnerBlueprint/actionPlan/delivery/assignment.http.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'
import { EVIDENCE_BASIS_EMPTY } from '../types'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const SYNTHETIC_MARKER = 'SYNTHETIC_BLUEPRINT_DELIVERY_HTTP_TEST'
const db = createServiceClient()

let schoolId: string
let coreLearnerId: string, legacyStudentId: string
let classId: string, teacherId: string
let teacherAuthId: string, teacherSession: SyntheticSession
const createdAssignmentIds: string[] = []
const createdActionIds: string[] = []

// This session's environment has shown sustained, intermittent network
// flakiness against Supabase Auth's admin endpoints (reproduced across
// multiple unrelated test files this session, documented identically in
// lib/learnerBlueprint/actionPlan/lifecycle.integration.test.ts's header) —
// bounded setup retries only, never around an authorization assertion.
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
    learner_id: coreLearnerId, school_id: schoolId, academic_year_id: null, term_id: null, blueprint_snapshot_id: null,
    context: 'current_term', priority: 'medium', visibility: 'teacher_only',
    title: 'Strengthen fractions', rationale: 'Recent evidence shows steady development.',
    intended_outcome: 'Move to Level 3 in fractions by end of term.',
    learner_action: 'Complete 10 fractions practice problems this week.',
    teacher_action: null, parent_support: null, school_support: null,
    success_indicator: 'Next confirmed assessment shows Level 3 or above.',
    target_capability: null, review_date: '2026-08-15', teacher_notes: null,
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
  if (createdAssignmentIds.length) await db.from('assignments').delete().in('id', createdAssignmentIds)
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
  return `${BASE_URL}/api/teacher/blueprint/actions/${actionItemId}/deliver-assignment`
}

test('POST .../deliver-assignment: unauthenticated request is rejected with 401', async () => {
  const action = await insertApprovedAction()
  const res = await fetch(deliverUrl(action.id), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId, confirmClassWideDelivery: true, subject: 'Mathematics', topic: 'Fractions', dueDate: '2026-09-01' }),
  })
  assert.equal(res.status, 401)
})

test('POST .../deliver-assignment: missing confirmClassWideDelivery in the body is rejected with 400 (zod shape)', async () => {
  const action = await insertApprovedAction()
  const res = await fetch(deliverUrl(action.id), {
    method: 'POST', headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId, subject: 'Mathematics', topic: 'Fractions', dueDate: '2026-09-01' }),
  })
  assert.equal(res.status, 400)
})

test('POST .../deliver-assignment: a non-existent action item id is rejected with 404', async () => {
  const res = await fetch(deliverUrl('00000000-0000-0000-0000-000000000000'), {
    method: 'POST', headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId, confirmClassWideDelivery: true, subject: 'Mathematics', topic: 'Fractions', dueDate: '2026-09-01' }),
  })
  assert.equal(res.status, 404)
})

test('POST .../deliver-assignment: confirmClassWideDelivery: false is rejected with 400', async () => {
  const action = await insertApprovedAction()
  const res = await fetch(deliverUrl(action.id), {
    method: 'POST', headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId, confirmClassWideDelivery: false, subject: 'Mathematics', topic: 'Fractions', dueDate: '2026-09-01' }),
  })
  assert.equal(res.status, 400)
})

test('POST .../deliver-assignment: the authorized teacher succeeds end-to-end over real HTTP (201, then 200 on retry)', async () => {
  const action = await insertApprovedAction()
  const res = await fetch(deliverUrl(action.id), {
    method: 'POST', headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId, confirmClassWideDelivery: true, subject: 'Mathematics', topic: 'Fractions', dueDate: '2026-09-01' }),
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(body.data.alreadyDelivered, false)
  assert.equal(body.data.assignment.blueprint_action_item_id, action.id)
  createdAssignmentIds.push(body.data.assignment.id)

  const retry = await fetch(deliverUrl(action.id), {
    method: 'POST', headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId, confirmClassWideDelivery: true, subject: 'Mathematics', topic: 'Fractions', dueDate: '2026-09-01' }),
  })
  assert.equal(retry.status, 200)
  const retryBody = await retry.json()
  assert.equal(retryBody.data.alreadyDelivered, true)
  assert.equal(retryBody.data.assignment.id, body.data.assignment.id)
})

test('the existing assignment creation route is unaffected by this phase (still succeeds, still ordinary and provenance-free)', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/assignments`, {
    method: 'POST', headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      class_id: classId, title: 'Ordinary assignment', subject: 'Mathematics', topic: 'Ratios',
      instructions: 'Complete questions 1-10', due_date: new Date(Date.now() + 86400_000).toISOString(),
    }),
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(body.data.assignment.blueprint_action_item_id, null)
  createdAssignmentIds.push(body.data.assignment.id)
})
