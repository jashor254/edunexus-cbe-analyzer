// lib/learnerBlueprint/actionPlan/blueprintExecutionExperience.page.http.integration.test.ts
//
// Phase 3A (docs/architecture/blueprint-execution-experience-phase3a.md) —
// end-to-end HTTP proof of the actual teacher workflow: open the learner
// Blueprint, see the "Blueprint Action Plan" section, deliver an approved
// action through the real Phase 2B endpoint, and see the updated delivery
// status on the next page load. Also proves the new section's visibility
// boundary: a parent viewing the same URL (legitimately, via
// `requireLearnerAccess`) never sees teacher delivery controls.
//
// Requires a server already running at LMS_TEST_BASE_URL (default
// http://localhost:3939).
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --test lib/learnerBlueprint/actionPlan/blueprintExecutionExperience.page.http.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'
import { EVIDENCE_BASIS_EMPTY } from './types'
import { asLearnerId } from '@/lib/core/identityTypes'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const SYNTHETIC_MARKER = 'SYNTHETIC_BLUEPRINT_EXECUTION_EXPERIENCE_PHASE3A_TEST'
const db = createServiceClient()

let schoolId: string
let coreLearnerId: string, legacyStudentId: string
let classId: string, teacherId: string
let teacherAuthId: string, teacherSession: SyntheticSession
let parentAuthId: string, parentSession: SyntheticSession
let actionId: string
const createdAssignmentIds: string[] = []

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

before(async () => {
  const teacher = await createSyntheticUser('teacher')
  teacherAuthId = teacher.authId; teacherSession = teacher.session
  const parent = await createSyntheticUser('parent')
  parentAuthId = parent.authId; parentSession = parent.session

  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, teacherAuthId)
  schoolId = school.id
  await db.from('school_users').insert([
    { school_id: schoolId, user_id: teacherAuthId, role: 'teacher', is_active: true },
    { school_id: schoolId, user_id: parentAuthId, role: 'parent', is_active: true },
  ])

  const { data: teacherRow } = await db.from('teachers')
    .insert({ user_id: teacherAuthId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherId = teacherRow!.id

  const { data: classRow } = await db.from('teacher_classes')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'English', class_code: `SYNTH-${Date.now()}-EE` })
    .select('id').single()
  classId = classRow!.id

  const { data: learnerRow } = await db.from('learners')
    .insert({ school_id: schoolId, admission_number: `${SYNTHETIC_MARKER}-001`, first_name: 'Amani', last_name: 'ExecTest' })
    .select('id').single()
  coreLearnerId = learnerRow!.id

  const { data: studentRow } = await db.from('students')
    .insert({ name: 'Amani ExecTest', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', external_id: coreLearnerId })
    .select('id').single()
  legacyStudentId = studentRow!.id
  await db.from('class_students').insert({ class_id: classId, student_id: legacyStudentId })

  await db.from('learner_guardians')
    .insert({ school_id: schoolId, learner_id: coreLearnerId, user_id: parentAuthId, relationship: 'mother', full_name: SYNTHETIC_MARKER, phone: '0700000000' })

  const row = await repos.blueprintActionItems.insert({
    learner_id: asLearnerId(coreLearnerId), school_id: schoolId, academic_year_id: null, term_id: null, blueprint_snapshot_id: null,
    context: 'current_term', priority: 'medium', visibility: 'teacher_only',
    title: 'Execution Experience Test Action', rationale: 'r', intended_outcome: 'Reach the outcome.',
    learner_action: 'Practice daily.', teacher_action: null, parent_support: null, school_support: null,
    success_indicator: 'Success looks like this.',
    sub_strand_id: null, target_capability: null, review_date: null, teacher_notes: null,
    proposal_source: 'teacher', source_generator: null, evidence_basis: EVIDENCE_BASIS_EMPTY, proposed_by: null,
  })
  const approved = await repos.blueprintActionItems.recordDecision(row.id, {
    status: 'approved', reviewed_by: null, reviewed_at: new Date().toISOString(), decision_reason: null, review_date: null,
  })
  actionId = approved.id
})

after(async () => {
  // blueprint_action_items is immutable once approved — left as accepted
  // test debt, matching every prior Blueprint phase's own tests.
  if (createdAssignmentIds.length) await db.from('assignments').delete().in('id', createdAssignmentIds)
  await db.from('learner_guardians').delete().eq('learner_id', coreLearnerId)
  await db.from('class_students').delete().eq('class_id', classId)
  await db.from('students').delete().eq('id', legacyStudentId)
  await db.from('teacher_classes').delete().eq('id', classId)
  await db.from('teachers').delete().eq('id', teacherId)
  await db.from('school_users').delete().eq('school_id', schoolId)
  await db.from('learners').delete().eq('id', coreLearnerId)
  await db.from('schools').delete().eq('id', schoolId)
  for (const id of [teacherAuthId, parentAuthId]) await db.auth.admin.deleteUser(id)
})

function blueprintUrl() {
  return `${BASE_URL}/student/blueprint/${coreLearnerId}`
}

test('an authorized teacher sees the Blueprint Action Plan section with the approved action, not yet delivered', async () => {
  const res = await fetch(blueprintUrl(), { headers: { Cookie: teacherSession.cookieHeader } })
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.match(html, /Blueprint Action Plan/)
  assert.match(html, /Execution Experience Test Action/)
  assert.match(html, /Not yet delivered/)
  assert.match(html, /Create class assignment/)
})

test('a parent viewing the same learner\'s Blueprint never sees the Action Plan section or delivery controls', async () => {
  const res = await fetch(blueprintUrl(), { headers: { Cookie: parentSession.cookieHeader } })
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.doesNotMatch(html, /Blueprint Action Plan/)
  assert.doesNotMatch(html, /Create class assignment/)
  assert.doesNotMatch(html, /Send to Learning Compass/)
})

test('end-to-end: delivering the action through the real Phase 2B endpoint updates what the Blueprint page shows on the next load', async () => {
  const deliverRes = await fetch(`${BASE_URL}/api/teacher/blueprint/actions/${actionId}/deliver-assignment`, {
    method: 'POST',
    headers: { ...{ Cookie: teacherSession.cookieHeader }, 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId, confirmClassWideDelivery: true, subject: 'English', topic: 'Reading', dueDate: '2026-09-01' }),
  })
  assert.equal(deliverRes.status, 201)
  const deliverBody = await deliverRes.json()
  createdAssignmentIds.push(deliverBody.data.assignment.id)

  const res = await fetch(blueprintUrl(), { headers: { Cookie: teacherSession.cookieHeader } })
  const html = await res.text()
  assert.match(html, /Delivered to Assignment/)
  assert.match(html, new RegExp(`teacher/assignments/${deliverBody.data.assignment.id}`))
  assert.doesNotMatch(html, /Not yet delivered/)
})
