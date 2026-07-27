// lib/learnerBlueprint/actionPlan/reviewWorkspace.integration.test.ts
//
// Phase 2E — integration tests against real (synthetic, cleaned-up) rows
// and real authenticated sessions for
// `listReviewableBlueprintActionsForLearner()`. Called directly (not over
// HTTP) — the teacher review workspace page calls this function server-side
// directly, so proving it here is proving what the page itself will do.
//
// Run with: npx tsx --env-file=.env.local --test lib/learnerBlueprint/actionPlan/reviewWorkspace.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { deliverBlueprintActionAsAssignment } from './delivery/assignment'
import { reviewBlueprintAction } from './review'
import { listReviewableBlueprintActionsForLearner } from './reviewWorkspace'
import { EVIDENCE_BASIS_EMPTY } from './types'
import type { BlueprintActionItemRow } from '@/lib/repositories/blueprintActionItem.repository'

const SYNTHETIC_MARKER = 'SYNTHETIC_BLUEPRINT_REVIEW_WORKSPACE_PHASE2E_TEST'
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

let schoolId: string, otherSchoolId: string
let coreLearnerId: string, legacyStudentId: string
let otherLearnerId: string
let classId: string
let teacherUserId: string, teacherEmail: string, teacherId: string
let unrelatedTeacherUserId: string, unrelatedTeacherEmail: string
let otherSchoolTeacherUserId: string, otherSchoolTeacherEmail: string
let parentUserId: string, parentEmail: string
let learnerSelfUserId: string, learnerSelfEmail: string
let teacherClient: SupabaseClient

const teacherRowIds: string[] = []
const createdAssignmentIds: string[] = []
let deliveredActionId: string
let undeliveredActionId: string
let otherLearnerActionId: string

function baseActionFields(learnerId: string, overrides: Partial<Parameters<typeof repos.blueprintActionItems.insert>[0]> = {}) {
  return {
    learner_id: learnerId,
    school_id: schoolId,
    academic_year_id: null,
    term_id: null,
    blueprint_snapshot_id: null,
    context: 'current_term' as const,
    priority: 'medium' as const,
    visibility: 'teacher_only' as const,
    title: 'Reading Fluency',
    rationale: 'Recent evidence shows steady development.',
    intended_outcome: 'Reach fluent oral reading by end of term.',
    learner_action: 'Read aloud for 10 minutes daily.',
    teacher_action: null,
    parent_support: null,
    school_support: null,
    success_indicator: 'Next confirmed assessment shows improved reading accuracy.',
    target_capability: null,
    review_date: null,
    teacher_notes: null,
    proposal_source: 'teacher' as const,
    source_generator: null,
    evidence_basis: EVIDENCE_BASIS_EMPTY,
    proposed_by: null,
    ...overrides,
  }
}

async function insertApprovedAction(learnerId: string, overrides: Partial<Parameters<typeof repos.blueprintActionItems.insert>[0]> = {}): Promise<BlueprintActionItemRow> {
  const row = await repos.blueprintActionItems.insert(baseActionFields(learnerId, overrides))
  return repos.blueprintActionItems.recordDecision(row.id, {
    status: 'approved', reviewed_by: null, reviewed_at: new Date().toISOString(), decision_reason: null, review_date: null,
  })
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
  const otherSchoolTeacher = await mkUser('other-school-teacher'); otherSchoolTeacherUserId = otherSchoolTeacher.id; otherSchoolTeacherEmail = otherSchoolTeacher.email
  const parent = await mkUser('parent'); parentUserId = parent.id; parentEmail = parent.email
  const learnerSelf = await mkUser('learner-self'); learnerSelfUserId = learnerSelf.id; learnerSelfEmail = learnerSelf.email

  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, teacherUserId)
  schoolId = school.id
  const otherSchool = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-other-school` }, otherSchoolTeacherUserId)
  otherSchoolId = otherSchool.id

  await db.from('school_users').insert([
    { school_id: schoolId, user_id: teacherUserId, role: 'teacher', is_active: true },
    { school_id: schoolId, user_id: unrelatedTeacherUserId, role: 'teacher', is_active: true },
    { school_id: schoolId, user_id: parentUserId, role: 'parent', is_active: true },
    { school_id: otherSchoolId, user_id: otherSchoolTeacherUserId, role: 'teacher', is_active: true },
  ])

  const { data: teacherRow } = await db.from('teachers')
    .insert({ user_id: teacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherId = teacherRow!.id; teacherRowIds.push(teacherId)

  const { data: unrelatedTeacherRow } = await db.from('teachers')
    .insert({ user_id: unrelatedTeacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherRowIds.push(unrelatedTeacherRow!.id)

  const { data: otherSchoolTeacherRow } = await db.from('teachers')
    .insert({ user_id: otherSchoolTeacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherRowIds.push(otherSchoolTeacherRow!.id)

  const { data: classRow } = await db.from('teacher_classes')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'English', class_code: `SYNTH-${Date.now()}-W` })
    .select('id').single()
  classId = classRow!.id

  const { data: learnerRow } = await db.from('learners')
    .insert({ school_id: schoolId, admission_number: `${SYNTHETIC_MARKER}-001`, first_name: 'Amani', last_name: 'Test' })
    .select('id').single()
  coreLearnerId = learnerRow!.id

  const { data: otherLearnerRow } = await db.from('learners')
    .insert({ school_id: schoolId, admission_number: `${SYNTHETIC_MARKER}-002`, first_name: 'Beatrice', last_name: 'Other' })
    .select('id').single()
  otherLearnerId = otherLearnerRow!.id

  const { data: studentRow } = await db.from('students')
    .insert({ name: 'Amani Test', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', external_id: coreLearnerId, user_id: learnerSelfUserId })
    .select('id').single()
  legacyStudentId = studentRow!.id

  await db.from('class_students').insert({ class_id: classId, student_id: legacyStudentId })

  await db.from('learner_guardians')
    .insert({ school_id: schoolId, learner_id: coreLearnerId, user_id: parentUserId, relationship: 'mother', full_name: SYNTHETIC_MARKER, phone: '0700000000' })

  teacherClient = await signInAs(teacherEmail)

  const delivered = await insertApprovedAction(coreLearnerId, { title: 'Delivered action' })
  deliveredActionId = delivered.id
  const { assignment } = await deliverBlueprintActionAsAssignment(teacherClient, deliveredActionId, {
    classId, confirmClassWideDelivery: true, subject: 'English', topic: 'Reading', dueDate: '2026-09-01',
  })
  createdAssignmentIds.push(assignment.id)

  const undelivered = await insertApprovedAction(coreLearnerId, { title: 'Undelivered action' })
  undeliveredActionId = undelivered.id

  const otherLearnerAction = await insertApprovedAction(otherLearnerId, { title: 'Someone else\'s action' })
  otherLearnerActionId = otherLearnerAction.id
})

after(async () => {
  // blueprint_action_items/history/reviews are immutable once
  // approved/inserted — left as accepted test debt, matching every prior
  // Blueprint phase's own integration test (see review.integration.test.ts).
  if (createdAssignmentIds.length) await db.from('assignments').delete().in('id', createdAssignmentIds)
  await db.from('learner_guardians').delete().eq('learner_id', coreLearnerId)
  await db.from('class_students').delete().eq('class_id', classId)
  await db.from('students').delete().eq('id', legacyStudentId)
  await db.from('teacher_classes').delete().eq('id', classId)
  await db.from('teachers').delete().in('id', teacherRowIds)
  await db.from('school_users').delete().in('school_id', [schoolId, otherSchoolId])
  await db.from('learners').delete().eq('id', coreLearnerId)
  await db.from('learners').delete().eq('id', otherLearnerId)
  await db.from('schools').delete().in('id', [schoolId, otherSchoolId])
  for (const id of [teacherUserId, unrelatedTeacherUserId, otherSchoolTeacherUserId, parentUserId, learnerSelfUserId]) {
    await db.auth.admin.deleteUser(id)
  }
})

// ── Authorization ────────────────────────────────────────────────────────────

test('unauthenticated caller is denied', async () => {
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await assert.rejects(() => listReviewableBlueprintActionsForLearner(anon, coreLearnerId), UnauthorizedError)
})

test('an unrelated same-school teacher is denied', async () => {
  const client = await signInAs(unrelatedTeacherEmail)
  await assert.rejects(() => listReviewableBlueprintActionsForLearner(client, coreLearnerId), ResourceOwnershipError)
})

test('a cross-school teacher is denied', async () => {
  const client = await signInAs(otherSchoolTeacherEmail)
  await assert.rejects(() => listReviewableBlueprintActionsForLearner(client, coreLearnerId), ResourceOwnershipError)
})

test('a parent is denied', async () => {
  const client = await signInAs(parentEmail)
  await assert.rejects(() => listReviewableBlueprintActionsForLearner(client, coreLearnerId), ResourceOwnershipError)
})

test('the learner themself is denied — this is a teacher workspace, not a learner view', async () => {
  const client = await signInAs(learnerSelfEmail)
  await assert.rejects(() => listReviewableBlueprintActionsForLearner(client, coreLearnerId), ResourceOwnershipError)
})

// ── Scoping and undelivered-state correctness ───────────────────────────────

test('the authorized teacher sees exactly this learner\'s actions — another learner\'s action never appears', async () => {
  const items = await listReviewableBlueprintActionsForLearner(teacherClient, coreLearnerId)
  const ids = items.map(i => i.actionId)
  assert.ok(ids.includes(deliveredActionId))
  assert.ok(ids.includes(undeliveredActionId))
  assert.ok(!ids.includes(otherLearnerActionId))
})

test('an approved-but-undelivered action does not throw and reports both channels as not delivered', async () => {
  const items = await listReviewableBlueprintActionsForLearner(teacherClient, coreLearnerId)
  const item = items.find(i => i.actionId === undeliveredActionId)!
  assert.equal(item.assignmentDelivered, false)
  assert.equal(item.compassDelivered, false)
  assert.equal(item.awaitingReview, true)
  assert.equal(item.latestDecision, 'awaiting_review')
  assert.equal(item.reviewCount, 0)
})

test('a delivered action reports assignmentDelivered: true and is awaiting review before any review exists', async () => {
  const items = await listReviewableBlueprintActionsForLearner(teacherClient, coreLearnerId)
  const item = items.find(i => i.actionId === deliveredActionId)!
  assert.equal(item.assignmentDelivered, true)
  assert.equal(item.compassDelivered, false)
  assert.equal(item.awaitingReview, true)
})

test('after a review is recorded, the list reflects the latest decision and is no longer awaiting review (absent new activity)', async () => {
  await reviewBlueprintAction(teacherClient, deliveredActionId, { decision: 'complete', notes: 'Looks solid.' })
  const items = await listReviewableBlueprintActionsForLearner(teacherClient, coreLearnerId)
  const item = items.find(i => i.actionId === deliveredActionId)!
  assert.equal(item.latestDecision, 'complete')
  assert.equal(item.reviewCount, 1)
  assert.equal(item.awaitingReview, false)
})

test('new assignment activity after the latest review flips the action back to awaiting review', async () => {
  await db.from('assignment_submissions').update({ status: 'marked', score: 88, marked_at: new Date().toISOString() }).eq('assignment_id', createdAssignmentIds[0])
  const items = await listReviewableBlueprintActionsForLearner(teacherClient, coreLearnerId)
  const item = items.find(i => i.actionId === deliveredActionId)!
  assert.equal(item.awaitingReview, true, 'new submission activity after the last review should re-surface the action')
  assert.equal(item.latestDecision, 'complete', 'the prior review decision is still the latest recorded decision — awaiting-review is a presentation flag, not a status reset')
})
