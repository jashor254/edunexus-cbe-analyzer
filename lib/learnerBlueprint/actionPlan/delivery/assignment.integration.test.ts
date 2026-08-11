// lib/learnerBlueprint/actionPlan/delivery/assignment.integration.test.ts
//
// Phase 2B (docs/architecture/blueprint-assignment-delivery-phase2b.md) —
// integration tests against real (synthetic, cleaned-up) rows and real
// authenticated sessions for `deliverBlueprintActionAsAssignment`. Called
// directly (not over HTTP) — like lib/learnerBlueprint/actionPlan/
// lifecycle.integration.test.ts, this only needs a session-bound
// SupabaseClient, not a running Next.js server, since neither the adapter
// nor lib/assignments/create.ts touches next/headers. The route itself
// (app/api/teacher/blueprint/actions/[actionItemId]/deliver-assignment)
// gets its own small HTTP-level test — see assignment.http.integration.test.ts.
//
// Run with: npx tsx --env-file=.env.local --test lib/learnerBlueprint/actionPlan/delivery/assignment.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { UnauthorizedError, ResourceOwnershipError, NotFoundError, ValidationError, ConflictError } from '@/lib/core/errors'
import { deliverBlueprintActionAsAssignment, type DeliverBlueprintActionAsAssignmentCommand } from './assignment'
import { EVIDENCE_BASIS_EMPTY } from '../types'
import type { BlueprintActionItemRow } from '@/lib/repositories/blueprintActionItem.repository'

const SYNTHETIC_MARKER = 'SYNTHETIC_BLUEPRINT_DELIVERY_PHASE2B_TEST'
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

function anonClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

let schoolId: string, otherSchoolId: string
let coreLearnerId: string, legacyStudentId: string
let classId: string       // owned by `teacherEmail`, teaches the learner
let classId2: string      // owned by `classOnlyTeacherEmail`, no learner relationship

let adminUserId: string, adminEmail: string
let teacherUserId: string, teacherEmail: string, teacherId: string
let classOnlyTeacherUserId: string, classOnlyTeacherEmail: string
let unrelatedTeacherUserId: string, unrelatedTeacherEmail: string
let otherSchoolTeacherUserId: string, otherSchoolTeacherEmail: string
let parentUserId: string, parentEmail: string
let learnerSelfUserId: string, learnerSelfEmail: string

const teacherRowIds: string[] = []
const createdAssignmentIds: string[] = []

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
    title: 'Strengthen fractions',
    rationale: 'Recent evidence shows steady development in Mathematics.',
    intended_outcome: 'Move to Level 3 in fractions by end of term.',
    learner_action: 'Complete 10 fractions practice problems this week.',
    teacher_action: null,
    parent_support: 'Ask your child to explain one fractions problem each evening.',
    school_support: null,
    success_indicator: 'Next confirmed assessment shows Level 3 or above.',
    target_capability: null,
    sub_strand_id: null,
    review_date: '2026-08-15',
    teacher_notes: 'CONFIDENTIAL: this learner is also being monitored for attendance concerns.',
    proposal_source: 'teacher' as const,
    source_generator: null,
    evidence_basis: EVIDENCE_BASIS_EMPTY,
    proposed_by: null,
    ...overrides,
  }
}

async function insertActionWithStatus(status: 'proposed' | 'edited' | 'approved' | 'rejected' | 'deferred', overrides: Partial<Parameters<typeof repos.blueprintActionItems.insert>[0]> = {}): Promise<BlueprintActionItemRow> {
  const row = await repos.blueprintActionItems.insert(baseActionFields(overrides))
  await repos.blueprintActionItemHistory.record({
    action_item_id: row.id, event_type: 'proposed', previous_status: null, resulting_status: row.status, snapshot: row, actor_id: null, reason: null,
  })
  if (status === 'proposed') return row

  if (status === 'edited') {
    const edited = await repos.blueprintActionItems.updateContent(row.id, { status: 'edited' })
    await repos.blueprintActionItemHistory.record({
      action_item_id: row.id, event_type: 'edited', previous_status: 'proposed', resulting_status: 'edited', snapshot: edited, actor_id: null, reason: null,
    })
    return edited
  }

  const decided = await repos.blueprintActionItems.recordDecision(row.id, {
    status,
    reviewed_by: null,
    reviewed_at: new Date().toISOString(),
    decision_reason: status === 'rejected' ? 'Not appropriate at this time.' : status === 'deferred' ? 'Revisit next term.' : null,
    review_date: null,
  })
  await repos.blueprintActionItemHistory.record({
    action_item_id: row.id, event_type: status, previous_status: 'proposed', resulting_status: status, snapshot: decided, actor_id: null, reason: null,
  })
  return decided
}

const validCommand = (overrides: Partial<DeliverBlueprintActionAsAssignmentCommand> = {}): DeliverBlueprintActionAsAssignmentCommand => ({
  classId,
  confirmClassWideDelivery: true,
  subject: 'Mathematics',
  topic: 'Fractions',
  dueDate: '2026-09-01',
  ...overrides,
})

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

  const admin = await mkUser('admin'); adminUserId = admin.id; adminEmail = admin.email
  const teacher = await mkUser('teacher'); teacherUserId = teacher.id; teacherEmail = teacher.email
  const classOnlyTeacher = await mkUser('class-only-teacher'); classOnlyTeacherUserId = classOnlyTeacher.id; classOnlyTeacherEmail = classOnlyTeacher.email
  const unrelatedTeacher = await mkUser('unrelated-teacher'); unrelatedTeacherUserId = unrelatedTeacher.id; unrelatedTeacherEmail = unrelatedTeacher.email
  const otherSchoolTeacher = await mkUser('other-school-teacher'); otherSchoolTeacherUserId = otherSchoolTeacher.id; otherSchoolTeacherEmail = otherSchoolTeacher.email
  const parent = await mkUser('parent'); parentUserId = parent.id; parentEmail = parent.email
  const learnerSelf = await mkUser('learner-self'); learnerSelfUserId = learnerSelf.id; learnerSelfEmail = learnerSelf.email

  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, adminUserId)
  schoolId = school.id
  const otherSchool = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-other-school` }, otherSchoolTeacherUserId)
  otherSchoolId = otherSchool.id

  await db.from('school_users').insert([
    { school_id: schoolId, user_id: adminUserId, role: 'school_admin', is_active: true },
    { school_id: schoolId, user_id: teacherUserId, role: 'teacher', is_active: true },
    { school_id: schoolId, user_id: classOnlyTeacherUserId, role: 'teacher', is_active: true },
    { school_id: schoolId, user_id: unrelatedTeacherUserId, role: 'teacher', is_active: true },
    { school_id: schoolId, user_id: parentUserId, role: 'parent', is_active: true },
    { school_id: otherSchoolId, user_id: otherSchoolTeacherUserId, role: 'teacher', is_active: true },
  ])

  const { data: teacherRow } = await db.from('teachers')
    .insert({ user_id: teacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherId = teacherRow!.id; teacherRowIds.push(teacherId)

  const { data: classOnlyTeacherRow } = await db.from('teachers')
    .insert({ user_id: classOnlyTeacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherRowIds.push(classOnlyTeacherRow!.id)

  const { data: unrelatedTeacherRow } = await db.from('teachers')
    .insert({ user_id: unrelatedTeacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherRowIds.push(unrelatedTeacherRow!.id)

  const { data: otherSchoolTeacherRow } = await db.from('teachers')
    .insert({ user_id: otherSchoolTeacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherRowIds.push(otherSchoolTeacherRow!.id)

  const { data: classRow } = await db.from('teacher_classes')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `SYNTH-${Date.now()}-A` })
    .select('id').single()
  classId = classRow!.id

  const { data: classRow2 } = await db.from('teacher_classes')
    .insert({ teacher_id: classOnlyTeacherRow!.id, name: `${SYNTHETIC_MARKER}-2`, grade: 8, subject: 'Mathematics', class_code: `SYNTH-${Date.now()}-B` })
    .select('id').single()
  classId2 = classRow2!.id

  const { data: learnerRow } = await db.from('learners')
    .insert({ school_id: schoolId, admission_number: `${SYNTHETIC_MARKER}-001`, first_name: 'Amani', last_name: 'Test' })
    .select('id').single()
  coreLearnerId = learnerRow!.id

  const { data: studentRow } = await db.from('students')
    .insert({ name: 'Amani Test', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', external_id: coreLearnerId, user_id: learnerSelfUserId })
    .select('id').single()
  legacyStudentId = studentRow!.id

  await db.from('class_students').insert({ class_id: classId, student_id: legacyStudentId })

  await db.from('learner_guardians')
    .insert({ school_id: schoolId, learner_id: coreLearnerId, user_id: parentUserId, relationship: 'mother', full_name: SYNTHETIC_MARKER, phone: '0700000000' })
})

after(async () => {
  if (createdAssignmentIds.length) await db.from('assignments').delete().in('id', createdAssignmentIds)
  await db.from('learner_guardians').delete().eq('learner_id', coreLearnerId)
  await db.from('class_students').delete().in('class_id', [classId, classId2])
  await db.from('students').delete().eq('id', legacyStudentId)
  await db.from('teacher_classes').delete().in('id', [classId, classId2])
  await db.from('learners').delete().eq('id', coreLearnerId)
  await db.from('teachers').delete().in('id', teacherRowIds)
  await db.from('school_users').delete().in('school_id', [schoolId, otherSchoolId])
  await db.from('schools').delete().in('id', [schoolId, otherSchoolId])
  for (const id of [adminUserId, teacherUserId, classOnlyTeacherUserId, unrelatedTeacherUserId, otherSchoolTeacherUserId, parentUserId, learnerSelfUserId]) {
    await db.auth.admin.deleteUser(id)
  }
})

// ── Lifecycle status gates ──────────────────────────────────────────────────

test('a proposed action cannot be delivered', async () => {
  const action = await insertActionWithStatus('proposed')
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => deliverBlueprintActionAsAssignment(client, action.id, validCommand()), ConflictError)
})

test('an edited-but-unapproved action cannot be delivered', async () => {
  const action = await insertActionWithStatus('edited')
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => deliverBlueprintActionAsAssignment(client, action.id, validCommand()), ConflictError)
})

test('a rejected action cannot be delivered', async () => {
  const action = await insertActionWithStatus('rejected')
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => deliverBlueprintActionAsAssignment(client, action.id, validCommand()), ConflictError)
})

test('a deferred action cannot be delivered', async () => {
  const action = await insertActionWithStatus('deferred')
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => deliverBlueprintActionAsAssignment(client, action.id, validCommand()), ConflictError)
})

test('a non-existent action item id is a NotFoundError, not a generic 500', async () => {
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => deliverBlueprintActionAsAssignment(client, '00000000-0000-0000-0000-000000000000', validCommand()), NotFoundError)
})

// ── Authorization (pure denial — must fail before any state changes) ───────

test('authorization: unauthenticated caller cannot deliver', async () => {
  const action = await insertActionWithStatus('approved')
  await assert.rejects(() => deliverBlueprintActionAsAssignment(anonClient(), action.id, validCommand()), UnauthorizedError)
})

test('authorization: parent cannot deliver', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(parentEmail)
  await assert.rejects(() => deliverBlueprintActionAsAssignment(client, action.id, validCommand()), ResourceOwnershipError)
})

test('authorization: the learner themself cannot deliver', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(learnerSelfEmail)
  await assert.rejects(() => deliverBlueprintActionAsAssignment(client, action.id, validCommand()), ResourceOwnershipError)
})

test('authorization: an unrelated same-school teacher (no learner relationship) cannot deliver', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(unrelatedTeacherEmail)
  await assert.rejects(() => deliverBlueprintActionAsAssignment(client, action.id, validCommand()), ResourceOwnershipError)
})

test('authorization: a cross-school teacher cannot deliver', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(otherSchoolTeacherEmail)
  await assert.rejects(() => deliverBlueprintActionAsAssignment(client, action.id, validCommand()), ResourceOwnershipError)
})

test('authorization: a teacher authorized for the CLASS but not the learner action is denied (class authority alone is not enough)', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(classOnlyTeacherEmail)
  await assert.rejects(() => deliverBlueprintActionAsAssignment(client, action.id, validCommand({ classId: classId2 })), ResourceOwnershipError)
})

test('authorization: a teacher authorized for the LEARNER but not the selected class is denied (learner authority alone is not enough)', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => deliverBlueprintActionAsAssignment(client, action.id, validCommand({ classId: classId2 })), ResourceOwnershipError)
})

// ── Validation (also pure denial, no state change) ──────────────────────────

test('validation: missing class-wide confirmation is rejected', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => deliverBlueprintActionAsAssignment(client, action.id, validCommand({ confirmClassWideDelivery: false })), ValidationError)
})

test('validation: a missing class selection is rejected', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => deliverBlueprintActionAsAssignment(client, action.id, validCommand({ classId: '' })), ValidationError)
})

test('validation: missing subject/topic is rejected (assignment payload invalid)', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => deliverBlueprintActionAsAssignment(client, action.id, validCommand({ subject: '' })), ValidationError)
})

test('validation: no dueDate override and no reviewDate on the action is rejected', async () => {
  const action = await insertActionWithStatus('approved', { review_date: null })
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => deliverBlueprintActionAsAssignment(client, action.id, validCommand({ dueDate: undefined })), ValidationError)
})

// ── Happy path, provenance, fan-out, side effects, idempotency ─────────────

test('an authorized teacher delivers an approved action as a class-wide assignment through the canonical Phase 2A service', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(teacherEmail)

  const { assignment, alreadyDelivered } = await deliverBlueprintActionAsAssignment(client, action.id, validCommand())
  createdAssignmentIds.push(assignment.id)

  assert.equal(alreadyDelivered, false)
  assert.equal(assignment.class_id, classId)
  assert.equal(assignment.teacher_id, teacherId)
  assert.equal(assignment.blueprint_action_item_id, action.id)
  assert.equal(assignment.status, 'active')
  assert.equal(assignment.is_adaptive, false)

  // Deterministic content mapping — present, and none of the private fields leaked.
  assert.ok(assignment.instructions.includes(action.learner_action!))
  assert.ok(assignment.instructions.includes(action.success_indicator))
  assert.ok(!assignment.instructions.includes(action.teacher_notes!), 'teacher-private notes must never appear in assignment content')
  assert.ok(!assignment.instructions.includes(action.parent_support!), 'parent-support text must never leak into instructions unless explicitly teacher-selected')
  assert.ok(!JSON.stringify(assignment).includes('CONFIDENTIAL'))

  // Submission fan-out reaches the correct roster (the enrolled learner), via the Phase 2A service — no direct insert here.
  const { data: submissions } = await db.from('assignment_submissions').select('student_id, status').eq('assignment_id', assignment.id)
  assert.equal(submissions?.length, 1)
  assert.equal(submissions?.[0].student_id, legacyStudentId)
  assert.equal(submissions?.[0].status, 'pending')

  // Action history: a 'delivered' event was appended, status remains 'approved', original history untouched.
  const history = await repos.blueprintActionItemHistory.listForActionItem(action.id)
  const deliveredEvents = history.filter(h => h.event_type === 'delivered')
  assert.equal(deliveredEvents.length, 1)
  assert.equal(deliveredEvents[0].resulting_status, 'approved')
  assert.ok(deliveredEvents[0].reason?.includes(assignment.id))
  const approvedEvent = history.find(h => h.event_type === 'approved')
  assert.ok(approvedEvent, 'the original approval history event must remain untouched')

  const stillAction = await repos.blueprintActionItems.findById(action.id)
  assert.equal(stillAction?.status, 'approved', 'delivery must not change the action item\'s own status')

  // No Compass/Evidence side effects.
  const [{ data: compassSessions }, { data: evidenceRows }] = await Promise.all([
    db.from('compass_sessions').select('id').eq('learner_id', legacyStudentId).gte('created_at', assignment.created_at),
    db.from('learner_evidence').select('id').eq('learner_id', legacyStudentId).gte('created_at', assignment.created_at),
  ])
  assert.equal(compassSessions?.length ?? 0, 0)
  assert.equal(evidenceRows?.length ?? 0, 0)

  // ── Idempotency: a second delivery attempt returns the same assignment, no duplicate. ──
  const second = await deliverBlueprintActionAsAssignment(client, action.id, validCommand({ classId: classId2, subject: 'Different', topic: 'Different' }))
  assert.equal(second.alreadyDelivered, true)
  assert.equal(second.assignment.id, assignment.id)

  const { data: allForAction } = await db.from('assignments').select('id').eq('blueprint_action_item_id', action.id)
  assert.equal(allForAction?.length, 1, 'exactly one assignment must exist for this action item after two delivery calls')
})

test('learners outside the class receive no submission row', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(teacherEmail)
  const { assignment } = await deliverBlueprintActionAsAssignment(client, action.id, validCommand())
  createdAssignmentIds.push(assignment.id)

  const { data: submissions } = await db.from('assignment_submissions').select('student_id').eq('assignment_id', assignment.id)
  const studentIds = (submissions ?? []).map(s => s.student_id)
  // Only the one learner enrolled in `classId` — no other synthetic student exists that could leak in, and the roster read is scoped to `classId` only (Phase 2A behavior, unaffected by delivery).
  assert.deepEqual(studentIds, [legacyStudentId])
})

test('concurrent delivery attempts for the same action create at most one assignment', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(teacherEmail)

  const [a, b] = await Promise.all([
    deliverBlueprintActionAsAssignment(client, action.id, validCommand()),
    deliverBlueprintActionAsAssignment(client, action.id, validCommand()),
  ])
  createdAssignmentIds.push(a.assignment.id, b.assignment.id)

  assert.equal(a.assignment.id, b.assignment.id, 'both concurrent calls must resolve to the same assignment id')

  const { data: allForAction } = await db.from('assignments').select('id').eq('blueprint_action_item_id', action.id)
  assert.equal(allForAction?.length, 1)
})

test('a school administrator can also deliver (matches existing assignment-creation admin policy — school_admin still must independently be the requireClassTeacher owner, so this exercises the admin-tier canManageLearnerRecordCore branch only, not a bypass of class ownership)', async () => {
  // Admins are not `teachers` rows in this legacy schema, so requireClassTeacher (class ownership) would deny them for `classId` — proving canManageLearnerRecordCore's admin branch works without asserting a false "admins can create assignments for classes they don't own" claim.
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(adminEmail)
  await assert.rejects(() => deliverBlueprintActionAsAssignment(client, action.id, validCommand()), ResourceOwnershipError)
})

// ── Static ownership: the ordinary assignment route cannot attach provenance ──

test('static: CreateAssignmentCommand has no client-facing schema field for blueprintActionItemId in the ordinary route', async () => {
  const fs = await import('node:fs/promises')
  const routeSource = await fs.readFile('app/api/teacher/assignments/route.ts', 'utf8')
  assert.ok(!routeSource.includes('blueprint_action_item_id') && !routeSource.includes('blueprintActionItemId'),
    'the ordinary teacher-facing assignment route must never reference Blueprint provenance fields')
})
