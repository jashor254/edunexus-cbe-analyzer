// lib/studentHome/composeStudentHome.integration.test.ts
//
// Phase 7 — Learner Home Convergence. Integration proof, against real rows
// (synthetic, cleaned up), for the one seam nextAction.test.ts's pure unit
// tests cannot reach: does composeStudentHome() actually correlate a real,
// approved, teacher-delivered Blueprint action with the real assignment row
// it produced, and surface it as the learner's Next Action with honest
// teacher-approved provenance — Phase 6's finding that
// listApprovedLearnerActionsForLearner had no consumer, closed here.
//
// Run: TEST_SUPABASE_URL=... npx tsx --experimental-test-module-mocks --test lib/studentHome/composeStudentHome.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { createClass, assignSubjectTeacher } from '@/lib/core/classes'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { listSubjects } from '@/lib/core/subjects'
import { issueLearnerAccountActivation, claimLearnerAccountActivation } from '@/lib/core/learnerAccounts'
import { createAssignment } from '@/lib/assignments/create'
import { proposeBlueprintAction, approveBlueprintAction } from '@/lib/learnerBlueprint/actionPlan/lifecycle'
import { deliverBlueprintActionToCompass } from '@/lib/learnerBlueprint/actionPlan/delivery/compass'
import { asLearnerId } from '@/lib/core/identityTypes'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'
import { composeStudentHome, StudentProfileNotFoundError } from './composeStudentHome'

const SYNTHETIC_MARKER = 'SYNTHETIC_STUDENTHOME_PHASE7_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

const createdAuthUserIds: string[] = []
let createdSchoolId: string | null = null

async function mkUser(label: string): Promise<{ id: string; email: string }> {
  const email = `p7home-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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

async function mkSchool(): Promise<{ schoolId: string; adminUserId: string; adminEmail: string; adminSchoolUserId: string }> {
  const admin = await mkUser('admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  createdSchoolId = school.id
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')
  const act = await activateSchool(school.id, { gradeCodes: ['G7'] })
  if (act.status !== 'complete') throw new Error(`fixture activation failed: ${act.error}`)
  const schoolUser = await repos.teachers.findSchoolUser(admin.id, school.id)
  if (!schoolUser) throw new Error('mkSchool: school_users row not found')
  return { schoolId: school.id, adminUserId: admin.id, adminEmail: admin.email, adminSchoolUserId: schoolUser.id }
}

async function addTeacher(schoolId: string, adminUserId: string): Promise<{ userId: string; email: string; membershipId: string }> {
  const user = await mkUser('teacher')
  await inviteTeacher(schoolId, user.email, adminUserId)
  const accepted = await acceptTeacherInvitation(user.id, schoolId, { full_name: `${SYNTHETIC_MARKER} Teacher` })
  return { userId: user.id, email: user.email, membershipId: accepted.schoolUser.id }
}

async function admitAndActivate(schoolId: string, classId: string, termId: string, academicYearId: string, adminSchoolUserId: string, admissionNumber: string): Promise<{ learnerId: string; userId: string }> {
  const result = await onboardLearner(schoolId, {
    admission_number: admissionNumber, first_name: 'Test', last_name: 'Home',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })
  assert.equal(result.status, 'complete')
  const learnerId = result.learnerId!

  const issued = await issueLearnerAccountActivation(schoolId, learnerId, adminSchoolUserId)
  if (issued.status !== 'issued') throw new Error(`unexpected issuance status ${issued.status}`)
  const claim = await claimLearnerAccountActivation(issued.token)
  if (claim.status !== 'claimed') throw new Error(`unexpected claim status ${claim.status}`)

  const { data: account } = await db.from('learner_accounts').select('user_id').eq('id', claim.learnerAccountId).single()
  createdAuthUserIds.push(account!.user_id as string)
  return { learnerId, userId: account!.user_id as string }
}

async function currentClassSubjectId(classId: string, subjectId: string): Promise<string> {
  const { data, error } = await db
    .from('class_subjects')
    .select('id')
    .eq('class_id', classId).eq('subject_id', subjectId).is('ended_at', null).single()
  if (error) throw error
  return data!.id as string
}

let school: Awaited<ReturnType<typeof mkSchool>>
let classId: string
let termId: string
let academicYearId: string
let mathsId: string
let teacherEmail: string
let learner: { learnerId: string; userId: string }

before(async () => {
  school = await mkSchool()

  const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', school.schoolId).limit(1)
  const cls = await createClass(school.schoolId, {
    grade_id: classes![0].grade_id, academic_year_id: classes![0].academic_year_id,
    display_name: `${SYNTHETIC_MARKER} Grade 7`,
  })
  classId = cls.id
  const term = await repos.schools.findCurrentTerm(school.schoolId)
  termId = term!.id
  academicYearId = classes![0].academic_year_id

  const subjects = await listSubjects('junior_secondary')
  mathsId = subjects.find(s => s.name === 'Mathematics')?.id ?? subjects[0].id

  const teacher = await addTeacher(school.schoolId, school.adminUserId)
  teacherEmail = teacher.email
  await assignSubjectTeacher(school.schoolId, classId, mathsId, teacher.membershipId)

  learner = await admitAndActivate(school.schoolId, classId, termId, academicYearId, school.adminSchoolUserId, `${SYNTHETIC_MARKER}-A`)

  // Materialize the Phase 1C compatibility bridge (the students row this
  // learner's assignments key off) — same technique institutional identity
  // tests use: the FIRST institutional assignment fans out the compatibility
  // student row. A throwaway "unrelated" assignment does this without
  // affecting the scenario under test.
  const classSubjectId = await currentClassSubjectId(classId, mathsId)
  const bootstrapTeacherClient = await signInAs(teacherEmail)
  await createAssignment(bootstrapTeacherClient, {
    classSubjectId, title: 'Bootstrap Assignment', subject: 'ignored', topic: 'Bootstrap', substrandId: null,
    instructions: 'x', dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
    type: undefined, maxScore: undefined, isQuiz: undefined, isAdaptive: undefined,
    isCompassGuided: undefined, isHolidayAssignment: undefined, holidayPeriod: undefined, lessonPlanId: undefined,
  })
})

after(async () => {
  if (createdSchoolId) {
    await db.from('assignments').delete().eq('class_id', classId)
    // A DB trigger (enforce_blueprint_action_item_decision_immutability,
    // confirmed by Phase 6's audit) permanently forbids deleting an
    // 'approved' blueprint_action_items row — by design, not a bug. Any
    // test run that reached the approval step leaves that row (and,
    // transitively, its school/learner) as known, tolerated synthetic
    // residue, exactly like the leaked-auth-user pattern below. Best-effort
    // only; never treated as a test failure.
    await db.from('school_users').delete().eq('school_id', createdSchoolId)
    await db.from('schools').delete().eq('id', createdSchoolId).then(() => {}, () => {})
  }
  for (const id of createdAuthUserIds) {
    try { await deleteAuthUserOrThrow(db, id) } catch { /* best-effort, known tolerated residual */ }
  }
})

test('a fresh institutional learner with no evidence and no approved action falls back honestly (no fabricated next action)', async () => {
  const home = await composeStudentHome(learner.userId)
  assert.equal(home.hasTeacher, true, 'institutional learner is always considered class-connected')
  // The bootstrap assignment is the only live item — it becomes Next Action
  // (soonest-due, no overdue/approved competitor) rather than null, which is
  // itself the correct "no evidence yet, but there is real class work" state.
  assert.ok(home.nextAction, 'a real class assignment must still surface as something to do')
  assert.equal(home.hasPendingApprovedAction, false)
})

test('an approved action delivered to Compass becomes Home\'s Next Action, with honest teacher-approved provenance', async () => {
  // Delivery-as-assignment requires a LEGACY teacher_classes id (see
  // deliverBlueprintActionAsAssignment -> createAssignment's Solo-mode
  // authority check, lib/core/permissions.ts's requireClassTeacher) —
  // incompatible with this fixture's institutional Core class, and out of
  // Phase 7's scope to fix (not a Home concern). Compass delivery has no
  // such constraint, exercises the exact same composeStudentHome
  // correlation seam, and is what this test proves.
  const teacherClient = await signInAs(teacherEmail)

  const action = await proposeBlueprintAction(teacherClient, {
    coreLearnerId: asLearnerId(learner.learnerId),
    context: 'current_term',
    title: 'Fractions practice',
    rationale: 'Recent classroom observation showed a fractions gap.',
    intendedOutcome: 'Confident with fraction addition',
    successIndicator: 'Solves 8/10 fraction problems correctly',
    proposalSource: 'teacher',
    visibility: 'learner_visible',
  })
  await approveBlueprintAction(teacherClient, action.id)

  const delivery = await deliverBlueprintActionToCompass(teacherClient, action.id, {
    confirmCompassDelivery: true,
    subject: 'mathematics',
  })

  const home = await composeStudentHome(learner.userId)

  assert.ok(home.hasPendingApprovedAction, 'the delivered, not-yet-started Compass action must be flagged as pending')
  assert.ok(home.nextAction, 'a Next Action must be chosen')
  assert.equal(home.nextAction!.kind, 'compass_action')
  assert.equal(home.nextAction!.id, delivery.delivery.id, 'Next Action must point at the REAL Compass delivery row, not a synthesized id')
  assert.equal(home.nextAction!.href, '/learn', 'a Compass-delivered action must route into Compass, not a fabricated deep link')
  assert.equal(home.nextAction!.title, 'Fractions practice', 'title must come from the teacher-approved action, not internal Compass objective text')
  assert.equal(home.nextAction!.subtitle, 'Recent classroom observation showed a fractions gap.', 'subtitle must be the teacher\'s own rationale — honest provenance (Phase 7 §5), never a generic string, and never claiming automatic AI assignment')
  assert.doesNotMatch(home.nextAction!.subtitle, /AI automatically|instantly adapt/i)
})

test('composeStudentHome throws StudentProfileNotFoundError for a user with no student record at all', async () => {
  const stranger = await mkUser('stranger')
  await assert.rejects(() => composeStudentHome(stranger.id), StudentProfileNotFoundError)
})
