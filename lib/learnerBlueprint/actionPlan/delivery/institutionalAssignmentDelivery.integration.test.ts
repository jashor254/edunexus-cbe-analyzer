// lib/learnerBlueprint/actionPlan/delivery/institutionalAssignmentDelivery.integration.test.ts
//
// PHASE 7.5 — Institutional Adaptive Delivery Convergence.
//
// Before this phase, `deliverBlueprintActionAsAssignment` only ever
// accepted `classId` (a legacy `teacher_classes.id`), routing every
// delivery through `createAssignment`'s Solo-mode `requireClassTeacher`
// authority — which a purely institutional teacher's `class_subjects`
// tenure can never satisfy (confirmed empirically during Phase 7's own
// testing: passing a Core `classes.id` as `classId` failed with
// `ResourceOwnershipError: You are not the teacher of this class.`, since
// `requireClassTeacher` looks the id up in `teacher_classes`, not
// `classes`). This file proves the fix: `classSubjectId` (institutional
// mode) now reaches the same canonical `createAssignment` service that
// already had institutional support built in and already proven elsewhere
// (Phase 6's fixture), closing the one path that had never been wired to
// it — Blueprint delivery.
//
// Run: TEST_SUPABASE_URL=... npx tsx --experimental-test-module-mocks --test lib/learnerBlueprint/actionPlan/delivery/institutionalAssignmentDelivery.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { ResourceOwnershipError, ConflictError } from '@/lib/core/errors'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { createClass, assignSubjectTeacher } from '@/lib/core/classes'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { issueLearnerAccountActivation, claimLearnerAccountActivation } from '@/lib/core/learnerAccounts'
import { listSubjects } from '@/lib/core/subjects'
import { proposeBlueprintAction, approveBlueprintAction } from '@/lib/learnerBlueprint/actionPlan/lifecycle'
import { deliverBlueprintActionAsAssignment } from './assignment'
import { createAssignment } from '@/lib/assignments/create'
import { composeStudentHome } from '@/lib/studentHome/composeStudentHome'
import { asLearnerId } from '@/lib/core/identityTypes'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_P75_INSTITUTIONAL_DELIVERY'
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

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []
const createdClassIds: string[] = []

async function mkUser(label: string) {
  const email = `p75delivery-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data } = await retryAsync(async () => {
    const res = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    if (res.error) throw res.error
    return res
  })
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

type SchoolFixture = { schoolId: string; adminUserId: string; adminSchoolUserId: string }

async function mkSchool(): Promise<SchoolFixture> {
  const admin = await mkUser('admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')
  const act = await activateSchool(school.id, { gradeCodes: ['G7'] })
  if (act.status !== 'complete') throw new Error(`fixture activation failed: ${act.error}`)
  const schoolUser = await repos.teachers.findSchoolUser(admin.id, school.id)
  if (!schoolUser) throw new Error('mkSchool: school_users row not found')
  return { schoolId: school.id, adminUserId: admin.id, adminSchoolUserId: schoolUser.id }
}

async function addTeacher(schoolId: string, adminUserId: string): Promise<{ userId: string; email: string; membershipId: string }> {
  const user = await mkUser('teacher')
  await inviteTeacher(schoolId, user.email, adminUserId)
  const accepted = await acceptTeacherInvitation(user.id, schoolId, { full_name: `${SYNTHETIC_MARKER} Teacher` })
  return { userId: user.id, email: user.email, membershipId: accepted.schoolUser.id }
}

async function mkClass(schoolId: string): Promise<string> {
  const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', schoolId).limit(1)
  const cls = await createClass(schoolId, {
    grade_id: classes![0].grade_id, academic_year_id: classes![0].academic_year_id,
    display_name: `${SYNTHETIC_MARKER} Grade 7`,
  })
  createdClassIds.push(cls.id)
  return cls.id
}

async function mathsSubjectId(): Promise<string> {
  const subjects = await listSubjects('junior_secondary')
  return subjects.find(s => s.name === 'Mathematics')?.id ?? subjects[0].id
}

let schoolA: SchoolFixture
let schoolB: SchoolFixture
let classA: string
let classB: string
let mathsId: string
let teacherA: { userId: string; email: string; membershipId: string }
let teacherB: { userId: string; email: string; membershipId: string }
let learnerAId: string
let learnerAUserId: string

before(async () => {
  schoolA = await mkSchool()
  schoolB = await mkSchool()
  classA = await mkClass(schoolA.schoolId)
  classB = await mkClass(schoolB.schoolId)
  mathsId = await mathsSubjectId()

  teacherA = await addTeacher(schoolA.schoolId, schoolA.adminUserId)
  teacherB = await addTeacher(schoolB.schoolId, schoolB.adminUserId)
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsId, teacherA.membershipId)
  await assignSubjectTeacher(schoolB.schoolId, classB, mathsId, teacherB.membershipId)

  const term = await repos.schools.findCurrentTerm(schoolA.schoolId)
  const { data: classRow } = await db.from('classes').select('academic_year_id').eq('id', classA).single()
  const admitted = await onboardLearner(schoolA.schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-A`, first_name: 'Test', last_name: 'Delivery',
    class_id: classA, term_id: term!.id, academic_year_id: classRow!.academic_year_id,
  })
  assert.equal(admitted.status, 'complete')
  learnerAId = admitted.learnerId!

  const issued = await issueLearnerAccountActivation(schoolA.schoolId, learnerAId, schoolA.adminSchoolUserId)
  if (issued.status !== 'issued') throw new Error(`unexpected issuance status ${issued.status}`)
  const claim = await claimLearnerAccountActivation(issued.token)
  if (claim.status !== 'claimed') throw new Error(`unexpected claim status ${claim.status}`)
  const { data: account } = await db.from('learner_accounts').select('user_id').eq('id', claim.learnerAccountId).single()
  learnerAUserId = account!.user_id as string
  createdAuthUserIds.push(learnerAUserId)

  // Materialize the Phase 1C compatibility bridge (students row +
  // class_students roster) — canManageLearnerRecordCore's teacher branch
  // requires it to exist before a non-admin teacher can manage this
  // learner's Blueprint action plan at all (same bootstrap Phase 7's own
  // composeStudentHome.integration.test.ts needed).
  const { data: classSubjectRowA } = await db.from('class_subjects').select('id').eq('class_id', classA).eq('subject_id', mathsId).is('ended_at', null).single()
  const teacherAClientBootstrap = await signInAs(teacherA.email)
  await createAssignment(teacherAClientBootstrap, {
    classSubjectId: classSubjectRowA!.id, title: 'Bootstrap Assignment', subject: 'ignored', topic: 'Bootstrap', substrandId: null,
    instructions: 'x', dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
    type: undefined, maxScore: undefined, isQuiz: undefined, isAdaptive: undefined,
    isCompassGuided: undefined, isHolidayAssignment: undefined, holidayPeriod: undefined, lessonPlanId: undefined,
  })
})

after(async () => {
  for (const id of createdSchoolIds) {
    // Best-effort — an approved blueprint_action_items row is permanently
    // immutable (enforce_blueprint_action_item_decision_immutability,
    // Phase 6), so any school this suite delivered an action for cannot be
    // fully torn down. Known, tolerated synthetic residue — same pattern
    // documented in lib/studentHome/composeStudentHome.integration.test.ts.
    await db.from('assignments').delete().in('class_id', createdClassIds).then(() => {}, () => {})
    await db.from('school_users').delete().eq('school_id', id).then(() => {}, () => {})
    await db.from('schools').delete().eq('id', id).then(() => {}, () => {})
  }
  for (const id of createdAuthUserIds) {
    try { await deleteAuthUserOrThrow(db, id) } catch { /* best-effort, known tolerated residual */ }
  }
})

// ── 1. Reproduce the pre-fix failure ────────────────────────────────────────

test('PRE-FIX REPRODUCTION: passing a Core classes.id as classId (Solo-mode dispatch) fails — this is the exact failure Phase 7 discovered', async () => {
  const teacherClient = await signInAs(teacherA.email)
  const action = await proposeBlueprintAction(teacherClient, {
    coreLearnerId: asLearnerId(learnerAId),
    context: 'current_term',
    title: 'Reproduction check',
    rationale: 'Recent classroom observation showed a gap.', intendedOutcome: 'Confident with the target skill', successIndicator: 'Solves 8/10 practice problems correctly',
    proposalSource: 'teacher', visibility: 'learner_visible',
  })
  await approveBlueprintAction(teacherClient, action.id)

  await assert.rejects(
    () => deliverBlueprintActionAsAssignment(teacherClient, action.id, {
      classId: classA, // a Core classes.id, NOT a teacher_classes.id — this is exactly what Home's own earlier testing tripped over
      confirmClassWideDelivery: true,
      subject: 'Mathematics',
      topic: 'Repro',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
    }),
    ResourceOwnershipError,
    'a Core classes.id must never be accepted as a legacy teacher_classes.id — proves the gap Phase 7.5 closes via classSubjectId instead'
  )
})

// ── 2. Institutional delivery succeeds via classSubjectId ──────────────────

let deliveredAssignmentId: string
let approvedActionId: string

test('an institutional teacher delivers an approved action via classSubjectId (the fix)', async () => {
  const teacherClient = await signInAs(teacherA.email)
  const action = await proposeBlueprintAction(teacherClient, {
    coreLearnerId: asLearnerId(learnerAId),
    context: 'current_term',
    title: 'Fractions practice',
    rationale: 'Recent classroom observation showed a fractions gap.',
    intendedOutcome: 'Confident with fraction addition', successIndicator: 'Solves 8/10 fraction problems correctly',
    proposalSource: 'teacher', visibility: 'learner_visible',
  })
  await approveBlueprintAction(teacherClient, action.id)
  approvedActionId = action.id

  const { data: classSubjectRow } = await db.from('class_subjects').select('id').eq('class_id', classA).eq('subject_id', mathsId).is('ended_at', null).single()

  // ARCHITECTURE GUARD (§16) — behavioral, not source-string: teacherA was
  // never onboarded through ANY legacy path (no inviteTeacher/
  // acceptTeacherInvitation-equivalent legacy flow, no manual
  // teacher_classes grant) — every membership this fixture ever gave
  // teacherA is purely institutional (school_users + class_subjects). A
  // compatibility `teachers`/`teacher_classes` row DOES exist by now, but
  // only as Phase 1B's own internal storage bridge, auto-created as a SIDE
  // EFFECT of the bootstrap institutional assignment above — never as a
  // precondition this test set up. classSubjectId itself is also
  // confirmed distinct from any teacher_classes.id (different tables,
  // never colliding UUID spaces).
  const { data: legacyMembership } = await db.from('teacher_classes').select('id').eq('id', classSubjectRow!.id)
  assert.equal((legacyMembership ?? []).length, 0, 'sanity: classSubjectId must never collide with a teacher_classes.id')

  const { assignment, alreadyDelivered } = await deliverBlueprintActionAsAssignment(teacherClient, action.id, {
    classSubjectId: classSubjectRow!.id,
    confirmClassWideDelivery: true,
    subject: 'ignored — institutional mode overwrites this with the Core subject name',
    topic: 'Fractions',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
  })

  assert.equal(alreadyDelivered, false)
  assert.equal(assignment.subject, 'Mathematics', 'institutional mode must use the Core-resolved subject name, never the client-supplied string')
  assert.equal(assignment.blueprint_action_item_id, action.id, 'provenance link must be preserved (§11)')
  deliveredAssignmentId = assignment.id
})

test('idempotency: a second delivery call for the SAME action returns the same assignment, not a duplicate', async () => {
  const teacherClient = await signInAs(teacherA.email)
  const { data: classSubjectRow } = await db.from('class_subjects').select('id').eq('class_id', classA).eq('subject_id', mathsId).is('ended_at', null).single()

  const second = await deliverBlueprintActionAsAssignment(teacherClient, approvedActionId, {
    classSubjectId: classSubjectRow!.id,
    confirmClassWideDelivery: true,
    subject: 'ignored',
    topic: 'Different topic — must be ignored on replay',
    dueDate: new Date(Date.now() + 999 * 86400000).toISOString(),
  })

  assert.equal(second.alreadyDelivered, true)
  assert.equal(second.assignment.id, deliveredAssignmentId, 'idempotent replay — the SAME assignment, not a second one')
})

// ── 3. Home integration proof ───────────────────────────────────────────────

test('Learner Home (Phase 7) surfaces the institutionally-delivered action as Next Action, unchanged precedence logic', async () => {
  const home = await composeStudentHome(learnerAUserId)
  assert.ok(home.hasPendingApprovedAction, 'the delivered, not-yet-completed institutional action must be flagged as pending')
  assert.ok(home.nextAction, 'a Next Action must be chosen')
  assert.equal(home.nextAction!.kind, 'assignment')
  assert.equal(home.nextAction!.id, deliveredAssignmentId, 'Next Action must point at the REAL institutionally-delivered assignment')
  assert.equal(home.nextAction!.title, 'Fractions practice')
  assert.equal(home.nextAction!.subtitle, 'Recent classroom observation showed a fractions gap.')
})

// ── 4. School boundary ──────────────────────────────────────────────────────

test('SCHOOL BOUNDARY: a teacher\'s own tenure in a DIFFERENT school cannot deliver a learner\'s action from another school', async () => {
  const teacherClient = await signInAs(teacherA.email)
  const action = await proposeBlueprintAction(teacherClient, {
    coreLearnerId: asLearnerId(learnerAId), // a School A learner
    context: 'current_term',
    title: 'Cross-school attempt',
    rationale: 'Recent classroom observation showed a gap.', intendedOutcome: 'Confident with the target skill', successIndicator: 'Solves 8/10 practice problems correctly',
    proposalSource: 'teacher', visibility: 'learner_visible',
  })
  await approveBlueprintAction(teacherClient, action.id)

  // teacherB's tenure is real and current — but it belongs to School B,
  // not the action's School A. A teacher who happened to ALSO hold School
  // A's tenure would pass; teacherB does not.
  const { data: classSubjectRowB } = await db.from('class_subjects').select('id').eq('class_id', classB).eq('subject_id', mathsId).is('ended_at', null).single()

  const teacherBClient = await signInAs(teacherB.email)
  await assert.rejects(
    () => deliverBlueprintActionAsAssignment(teacherBClient, action.id, {
      classSubjectId: classSubjectRowB!.id,
      confirmClassWideDelivery: true,
      subject: 'ignored',
      topic: 'x',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
    }),
    ResourceOwnershipError,
    'canManageLearnerRecordCore already blocks teacherB from managing a School-A-only action, before the school-mismatch check even runs'
  )
})

// ── 5. Approval boundary preserved ──────────────────────────────────────────

test('APPROVAL BOUNDARY: an unapproved (merely proposed) action cannot be delivered institutionally', async () => {
  const teacherClient = await signInAs(teacherA.email)
  const action = await proposeBlueprintAction(teacherClient, {
    coreLearnerId: asLearnerId(learnerAId),
    context: 'current_term',
    title: 'Not yet approved',
    rationale: 'Recent classroom observation showed a gap.', intendedOutcome: 'Confident with the target skill', successIndicator: 'Solves 8/10 practice problems correctly',
    proposalSource: 'teacher', visibility: 'learner_visible',
  })
  // deliberately NOT approved

  const { data: classSubjectRow } = await db.from('class_subjects').select('id').eq('class_id', classA).eq('subject_id', mathsId).is('ended_at', null).single()

  await assert.rejects(
    () => deliverBlueprintActionAsAssignment(teacherClient, action.id, {
      classSubjectId: classSubjectRow!.id,
      confirmClassWideDelivery: true,
      subject: 'ignored',
      topic: 'x',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
    }),
    ConflictError,
    'approval is still required before institutional delivery, exactly as legacy delivery already enforced'
  )
})
