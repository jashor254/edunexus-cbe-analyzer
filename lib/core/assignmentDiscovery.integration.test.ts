// lib/core/assignmentDiscovery.integration.test.ts
//
// PHASE 2 — Institutional Learner Portal Discovery. Proves the read-side
// chain: auth.getUser() -> resolveAuthenticatedLearnerIdentity ->
// resolveAllCoreLearnersForAuthenticatedUser -> compatibility students
// (resolveLegacyStudentId, batched) -> assignment_submissions (the
// recipient-materialization signal fanOutPendingSubmissions already
// writes) -> assignments -> learner-facing projection.
//
// Covers: teacher-replacement visibility (Step 14), inter-school transfer
// chain A->B->C (Step 15/16), a constructed dual-active-enrollment case
// (Step 17), Solo/guardian/missing/suspended-account regression (Step 18/
// 19/22), and evidence-integrity (Step 26).
//
// This file must be run with NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// / NEXT_PUBLIC_SUPABASE_ANON_KEY pointed at local Docker (never
// .env.local/production) — same Phase 2C Step 0 guard as every other
// integration test in this family.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/core/assignmentDiscovery.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { createClass, assignSubjectTeacher } from '@/lib/core/classes'
import { listSubjects } from '@/lib/core/subjects'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { enrollLearner, admitTransferredLearner } from '@/lib/core/learners'
import { transferLearner } from '@/lib/core/transfers'
import { issueLearnerAccountActivation, claimLearnerAccountActivation } from '@/lib/core/learnerAccounts'
import { createAssignment } from '@/lib/assignments/create'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'
import {
  resolveInstitutionalCompatibilityStudentIds,
  listAssignmentsForAuthenticatedLearner,
  resolveInstitutionalAssignmentReadAccess,
} from '@/lib/core/assignmentDiscovery'

const SYNTHETIC_MARKER = 'SYNTHETIC_P2_DISCOVERY'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkUser(label: string): Promise<{ id: string; email: string }> {
  const email = `p2disc-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

async function mkSchool(label: string): Promise<{ schoolId: string; adminUserId: string; adminSchoolUserId: string }> {
  const admin = await mkUser(`${label}-admin`)
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${label}_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')
  const act = await activateSchool(school.id, { gradeCodes: ['G7'] })
  if (act.status !== 'complete') throw new Error(`fixture activation failed (${label}): ${act.error}`)
  const schoolUser = await repos.teachers.findSchoolUser(admin.id, school.id)
  if (!schoolUser) throw new Error('mkSchool: school_users row not found after addSchoolUser')
  return { schoolId: school.id, adminUserId: admin.id, adminSchoolUserId: schoolUser.id }
}

async function addTeacher(schoolId: string, adminUserId: string, label: string): Promise<{ userId: string; email: string; membershipId: string }> {
  const user = await mkUser(label)
  await inviteTeacher(schoolId, user.email, adminUserId)
  const accepted = await acceptTeacherInvitation(user.id, schoolId, { full_name: `${SYNTHETIC_MARKER} ${label}` })
  return { userId: user.id, email: user.email, membershipId: accepted.schoolUser.id }
}

async function currentClassSubjectId(classId: string, subjectId: string): Promise<string> {
  const { data, error } = await db
    .from('class_subjects')
    .select('id')
    .eq('class_id', classId).eq('subject_id', subjectId).is('ended_at', null).single()
  if (error) throw error
  return data!.id as string
}

/** Admits + enrolls a learner via the ordinary school-side onboarding flow, then activates and claims a learner account for them — returns the auth `user_id` this phase's discovery chain begins from. */
async function admitAndActivate(schoolId: string, classId: string, termId: string, academicYearId: string, adminSchoolUserId: string, admissionNumber: string): Promise<{ learnerId: string; userId: string }> {
  const result = await onboardLearner(schoolId, {
    admission_number: admissionNumber, first_name: 'Test', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })
  assert.equal(result.status, 'complete')
  const learnerId = result.learnerId!

  const issued = await issueLearnerAccountActivation(schoolId, learnerId, adminSchoolUserId)
  if (issued.status !== 'issued') throw new Error(`admitAndActivate: unexpected issuance status ${issued.status}`)
  const claim = await claimLearnerAccountActivation(issued.token)
  if (claim.status !== 'claimed') throw new Error(`admitAndActivate: unexpected claim status ${claim.status}`)

  const { data: account } = await db.from('learner_accounts').select('user_id').eq('id', claim.learnerAccountId).single()
  createdAuthUserIds.push(account!.user_id as string)
  return { learnerId, userId: account!.user_id as string }
}

async function mkInstitutionalAssignment(teacherEmail: string, classSubjectId: string, title: string): Promise<{ id: string; class_id: string }> {
  const teacherClient = await signInAs(teacherEmail)
  const { assignment } = await createAssignment(teacherClient, {
    classSubjectId, title, subject: 'ignored', topic: 'Fixture Topic', substrandId: null,
    instructions: 'Fixture instructions', dueDate: new Date(Date.now() + 86400000).toISOString(),
    type: undefined, maxScore: undefined, isQuiz: undefined, isAdaptive: undefined,
    isCompassGuided: undefined, isHolidayAssignment: undefined, holidayPeriod: undefined, lessonPlanId: undefined,
  })
  return { id: assignment.id, class_id: assignment.class_id }
}

let schoolA: Awaited<ReturnType<typeof mkSchool>>
let schoolB: Awaited<ReturnType<typeof mkSchool>>
let schoolC: Awaited<ReturnType<typeof mkSchool>>
let schoolD: Awaited<ReturnType<typeof mkSchool>>
let mathsIdA: string
let mathsIdB: string
let mathsIdC: string
let mathsIdD: string
let classA: string
let classB: string
let classC: string
let classD: string
let termA: string
let termB: string
let termC: string
let termD: string
let yearA: string
let yearB: string
let yearC: string
let yearD: string

before(async () => {
  schoolA = await mkSchool('A')
  schoolB = await mkSchool('B')
  schoolC = await mkSchool('C')
  schoolD = await mkSchool('D')

  for (const [school, setClass, setTerm, setYear, setMaths] of [
    [schoolA, (v: string) => (classA = v), (v: string) => (termA = v), (v: string) => (yearA = v), (v: string) => (mathsIdA = v)],
    [schoolB, (v: string) => (classB = v), (v: string) => (termB = v), (v: string) => (yearB = v), (v: string) => (mathsIdB = v)],
    [schoolC, (v: string) => (classC = v), (v: string) => (termC = v), (v: string) => (yearC = v), (v: string) => (mathsIdC = v)],
    [schoolD, (v: string) => (classD = v), (v: string) => (termD = v), (v: string) => (yearD = v), (v: string) => (mathsIdD = v)],
  ] as const) {
    const s = school as Awaited<ReturnType<typeof mkSchool>>
    const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', s.schoolId).limit(1)
    const cls = await createClass(s.schoolId, {
      grade_id: classes![0].grade_id, academic_year_id: classes![0].academic_year_id,
      display_name: `${SYNTHETIC_MARKER} Grade 7`,
    })
    ;(setClass as (v: string) => void)(cls.id)
    const term = await repos.schools.findCurrentTerm(s.schoolId)
    ;(setTerm as (v: string) => void)(term!.id)
    ;(setYear as (v: string) => void)(classes![0].academic_year_id)
    const subjects = await listSubjects('junior_secondary')
    ;(setMaths as (v: string) => void)(subjects.find(sub => sub.name === 'Mathematics')!.id)
  }
})

after(async () => {
  if (createdSchoolIds.length) {
    const { data: coreLearners } = await db.from('learners').select('id').in('school_id', createdSchoolIds)
    const learnerExternalIds = (coreLearners ?? []).map(l => l.id)
    if (learnerExternalIds.length) {
      const { data: bridgedStudents } = await db.from('students').select('id').in('external_id', learnerExternalIds)
      const studentIds = (bridgedStudents ?? []).map(s => s.id)
      if (studentIds.length) {
        await db.from('assignment_submissions').delete().in('student_id', studentIds)
        await db.from('learner_evidence').delete().in('learner_id', studentIds)
        await db.from('learner_projections').delete().in('learner_id', studentIds)
        await db.from('class_students').delete().in('student_id', studentIds)
        await db.from('students').delete().in('id', studentIds)
      }
    }
    const { data: classSubjectRows } = await db.from('class_subjects').select('id').in('school_id', createdSchoolIds)
    const csIds = (classSubjectRows ?? []).map(r => r.id)
    if (csIds.length) {
      const { data: bridgeRows } = await db.from('class_subject_legacy_bridge').select('id, teacher_class_id').in('class_subject_id', csIds)
      const tcIds = (bridgeRows ?? []).map(r => r.teacher_class_id)
      if (tcIds.length) {
        await db.from('assignments').delete().in('class_id', tcIds)
        await db.from('teacher_classes').delete().in('id', tcIds)
      }
      await db.from('class_subject_legacy_bridge').delete().in('class_subject_id', csIds)
    }
  }
  // learner_identity_links.linked_by -> school_users(id) has NO ACTION on
  // delete (deliberate provenance-preservation rule — see
  // lib/core/learnerIdentityConvergence.integration.test.ts's identical
  // teardown comment). Pass 1 across ALL schools first: a transfer-chain
  // fixture's link rows span multiple synthetic schools, so every link must
  // be gone before any school's `school_users`/`schools` delete below.
  for (const id of createdSchoolIds) {
    const { data: learnerRows } = await db.from('learners').select('id, learner_identity_id').eq('school_id', id)
    const learnerIds = (learnerRows ?? []).map(l => l.id)
    if (learnerIds.length) {
      await db.from('learner_identity_links').delete().in('learner_id', learnerIds)
    }
    const identityIds = [...new Set((learnerRows ?? []).map(l => l.learner_identity_id).filter(Boolean))]
    if (identityIds.length) {
      await db.from('learner_accounts').delete().in('learner_identity_id', identityIds)
    }
  }
  for (const id of createdSchoolIds) {
    const { data: transferRows } = await db.from('learner_transfers').select('id').or(`from_school_id.eq.${id},to_school_id.eq.${id}`)
    const transferIds = (transferRows ?? []).map(r => r.id)
    if (transferIds.length) {
      await db.from('learner_transfer_tokens').delete().in('transfer_id', transferIds)
      await db.from('learner_transfers').delete().in('id', transferIds)
    }
  }
  for (const id of createdSchoolIds) {
    await db.from('learner_account_invites').delete().eq('school_id', id)
    await db.from('learner_enrollments').delete().eq('school_id', id)
    await db.from('learners').delete().eq('school_id', id)
    await db.from('class_subjects').delete().eq('school_id', id)
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('classes').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  // Orphaned learner_identities — no FK back to schools/learners to cascade
  // from (deliberate, per the migration's own header). Safe sweep, local
  // Docker only.
  const { data: allIdentities } = await db.from('learner_identities').select('id')
  const { data: referencedRows } = await db.from('learners').select('learner_identity_id').not('learner_identity_id', 'is', null)
  const referenced = new Set((referencedRows ?? []).map(r => r.learner_identity_id))
  const orphanIds = (allIdentities ?? []).map(r => r.id).filter(idVal => !referenced.has(idVal))
  if (orphanIds.length > 0) {
    await db.from('learner_identities').delete().in('id', orphanIds)
  }
  for (const id of createdAuthUserIds) {
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('platform_events').delete().eq('actor_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.from('teachers').delete().eq('user_id', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

// ── Step 18/22: Solo / guardian / missing / suspended-account regression ──

test('an unrelated authenticated user (no learner_accounts row) resolves zero compatibility students and zero assignments', async () => {
  const stranger = await mkUser('stranger')
  const ids = await resolveInstitutionalCompatibilityStudentIds(stranger.id)
  assert.deepEqual(ids, [])
  const assignments = await listAssignmentsForAuthenticatedLearner(stranger.id)
  assert.deepEqual(assignments, [])
})

test('a suspended learner account resolves zero — fails closed, not merely limited', async () => {
  const { userId } = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-SUSPENDED`)
  await db.from('learner_accounts').update({ status: 'suspended', suspended_at: new Date().toISOString() }).eq('user_id', userId)
  const ids = await resolveInstitutionalCompatibilityStudentIds(userId)
  assert.deepEqual(ids, [], 'suspended account must resolve nothing, same as no account at all')
})

// ── Step 14: teacher replacement ──────────────────────────────────────────

test('teacher replacement: learner sees BOTH the departed teacher\'s assignment and the replacement\'s', async () => {
  const peter = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'peter-repl')
  const mary = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'mary-repl')

  const { userId: learnerUserId } = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-REPL`)

  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, peter.membershipId)
  const peterCsId = await currentClassSubjectId(classA, mathsIdA)
  const assignmentA = await mkInstitutionalAssignment(peter.email, peterCsId, 'Peter\'s Assignment')

  // Replace Peter with Mary — closes Peter's tenure, opens a NEW one with its own bridge.
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, mary.membershipId)
  const maryCsId = await currentClassSubjectId(classA, mathsIdA)
  assert.notEqual(maryCsId, peterCsId)
  const assignmentB = await mkInstitutionalAssignment(mary.email, maryCsId, 'Mary\'s Assignment')

  const list = await listAssignmentsForAuthenticatedLearner(learnerUserId)
  const ids = list.map(a => a.id)
  assert.ok(ids.includes(assignmentA.id), 'departed teacher\'s assignment remains visible')
  assert.ok(ids.includes(assignmentB.id), 'replacement teacher\'s assignment is visible')
})

// ── Step 15/16: transfer chain A -> B -> C ────────────────────────────────

test('transfer chain: current-school assignment visible, historical assignment survives, post-transfer old-school assignment hidden', async () => {
  const teacherA = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'teacher-chain-a')
  const teacherB = await addTeacher(schoolB.schoolId, schoolB.adminUserId, 'teacher-chain-b')
  const teacherC = await addTeacher(schoolC.schoolId, schoolC.adminUserId, 'teacher-chain-c')

  const { learnerId: learnerAId, userId } = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-CHAIN`)

  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacherA.membershipId)
  const csA = await currentClassSubjectId(classA, mathsIdA)
  const assignmentA = await mkInstitutionalAssignment(teacherA.email, csA, 'School A Assignment (pre-transfer)')

  // ── A -> B ──
  const transferOut = await transferLearner(schoolA.adminSchoolUserId, {
    learner_id: learnerAId, direction: 'out', to_school_id: schoolB.schoolId, to_school_name: 'School B',
    transfer_date: new Date().toISOString().slice(0, 10),
  })
  assert.ok(transferOut.transferToken)

  const admitB = await admitTransferredLearner(
    schoolB.schoolId, schoolB.adminSchoolUserId,
    { admission_number: `${SYNTHETIC_MARKER}-CHAIN-B`, first_name: 'Test', last_name: 'Learner' },
    transferOut.transferToken!
  )
  assert.equal(admitB.status, 'admitted')
  const learnerBId = admitB.learner!.id
  await enrollLearner({ learner_id: learnerBId, class_id: classB, term_id: termB, academic_year_id: yearB, school_id: schoolB.schoolId })

  // A new assignment issued by School A AFTER the transfer — the learner
  // was removed from School A's Core roster (withdrawActiveEnrollments),
  // so the next compatibility roster sync (triggered by this assignment's
  // own creation) excludes them from fan-out entirely.
  const assignmentAPostTransfer = await mkInstitutionalAssignment(teacherA.email, csA, 'School A Assignment (post-transfer, must be hidden)')

  await assignSubjectTeacher(schoolB.schoolId, classB, mathsIdB, teacherB.membershipId)
  const csB = await currentClassSubjectId(classB, mathsIdB)
  const assignmentB = await mkInstitutionalAssignment(teacherB.email, csB, 'School B Assignment (current)')

  let list = await listAssignmentsForAuthenticatedLearner(userId)
  let ids = list.map(a => a.id)
  assert.ok(ids.includes(assignmentA.id), 'Step 7/15 — historical School A assignment (created while enrolled) remains visible after transfer')
  assert.ok(ids.includes(assignmentB.id), 'current School B assignment visible')
  assert.ok(!ids.includes(assignmentAPostTransfer.id), 'Step 15 — new School A assignment issued AFTER transfer must stay hidden')

  // ── B -> C ──
  const transferOut2 = await transferLearner(schoolB.adminSchoolUserId, {
    learner_id: learnerBId, direction: 'out', to_school_id: schoolC.schoolId, to_school_name: 'School C',
    transfer_date: new Date().toISOString().slice(0, 10),
  })
  assert.ok(transferOut2.transferToken)

  const admitC = await admitTransferredLearner(
    schoolC.schoolId, schoolC.adminSchoolUserId,
    { admission_number: `${SYNTHETIC_MARKER}-CHAIN-C`, first_name: 'Test', last_name: 'Learner' },
    transferOut2.transferToken!
  )
  assert.equal(admitC.status, 'admitted')
  assert.equal(admitC.learnerIdentityId, admitB.learnerIdentityId, 'Step 16 — SAME durable identity throughout, no reactivation, no guessing')
  const learnerCId = admitC.learner!.id
  await enrollLearner({ learner_id: learnerCId, class_id: classC, term_id: termC, academic_year_id: yearC, school_id: schoolC.schoolId })

  await assignSubjectTeacher(schoolC.schoolId, classC, mathsIdC, teacherC.membershipId)
  const csC = await currentClassSubjectId(classC, mathsIdC)
  const assignmentC = await mkInstitutionalAssignment(teacherC.email, csC, 'School C Assignment (current)')

  // A new School B assignment issued after the B -> C transfer must also stay hidden.
  const assignmentBPostTransfer = await mkInstitutionalAssignment(teacherB.email, csB, 'School B Assignment (post-transfer, must be hidden)')

  list = await listAssignmentsForAuthenticatedLearner(userId)
  ids = list.map(a => a.id)
  assert.ok(ids.includes(assignmentA.id), 'Step 16 — School A history still visible two transfers later')
  assert.ok(ids.includes(assignmentB.id), 'Step 16 — School B history still visible after the B->C transfer')
  assert.ok(ids.includes(assignmentC.id), 'current School C assignment visible')
  assert.ok(!ids.includes(assignmentAPostTransfer.id), 'still hidden')
  assert.ok(!ids.includes(assignmentBPostTransfer.id), 'Step 16 — new School B assignment issued after the SECOND transfer must stay hidden')

  // Step 22 security matrix: durable identity id manipulation has no
  // meaning here — the chain never accepts one from the caller — and the
  // learner's own auth session (`userId`) is the only input, exactly as
  // Step 10 requires.
  const access = await resolveInstitutionalAssignmentReadAccess(userId, assignmentC.id)
  assert.ok(access, 'the current, legitimately-received assignment is directly readable')
  const deniedAccess = await resolveInstitutionalAssignmentReadAccess(userId, assignmentAPostTransfer.id)
  assert.equal(deniedAccess, null, 'a post-transfer assignment the learner was never fanned into is not directly readable either')
})

// ── Step 17: constructed dual-active-enrollment case ──────────────────────

test('multi-school active: one durable identity legitimately active at two schools sees both, and each school stays isolated from the other', async () => {
  const teacherD = await addTeacher(schoolD.schoolId, schoolD.adminUserId, 'teacher-dual-d')
  const teacherOnA = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'teacher-dual-a')

  const { learnerId: learnerAId, userId } = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-DUALA`)

  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacherOnA.membershipId)
  const csA = await currentClassSubjectId(classA, mathsIdA)
  const assignmentDualA = await mkInstitutionalAssignment(teacherOnA.email, csA, 'School A Dual Assignment')

  // Phase 2C found (read-only production audit) that dual-active enrollment
  // is a real, un-enforced-against DB state, not reachable via any exposed
  // admin action today. Constructed here via the real transfer-continuity
  // primitive (so the SAME durable identity is genuinely shared, not
  // faked) and then flipping School A's row back to 'active' — a state the
  // schema permits (no unique-active-row constraint, per Phase 2C) even
  // though no current UI path produces it.
  const transferOut = await transferLearner(schoolA.adminSchoolUserId, {
    learner_id: learnerAId, direction: 'out', to_school_id: schoolD.schoolId, to_school_name: 'School D',
    transfer_date: new Date().toISOString().slice(0, 10),
  })
  const admitD = await admitTransferredLearner(
    schoolD.schoolId, schoolD.adminSchoolUserId,
    { admission_number: `${SYNTHETIC_MARKER}-DUALD`, first_name: 'Test', last_name: 'Learner' },
    transferOut.transferToken!
  )
  assert.equal(admitD.status, 'admitted')
  const learnerDId = admitD.learner!.id
  await enrollLearner({ learner_id: learnerDId, class_id: classD, term_id: termD, academic_year_id: yearD, school_id: schoolD.schoolId })
  await db.from('learners').update({ status: 'active' }).eq('id', learnerAId) // constructed dual-active

  await assignSubjectTeacher(schoolD.schoolId, classD, mathsIdD, teacherD.membershipId)
  const csD = await currentClassSubjectId(classD, mathsIdD)
  const assignmentDualD = await mkInstitutionalAssignment(teacherD.email, csD, 'School D Dual Assignment')

  const list = await listAssignmentsForAuthenticatedLearner(userId)
  const ids = list.map(a => a.id)
  assert.ok(ids.includes(assignmentDualA.id), 'Step 17 — School A assignment visible under dual-active enrollment')
  assert.ok(ids.includes(assignmentDualD.id), 'Step 17 — School D assignment ALSO visible, neither school arbitrarily dropped')

  // Isolation: an unrelated learner at School D never sees School A's (or this learner's) assignments.
  const { userId: otherUserId } = await admitAndActivate(schoolD.schoolId, classD, termD, yearD, schoolD.adminSchoolUserId, `${SYNTHETIC_MARKER}-DUAL-OTHER`)
  const otherList = await listAssignmentsForAuthenticatedLearner(otherUserId)
  const otherIds = otherList.map(a => a.id)
  assert.ok(!otherIds.includes(assignmentDualA.id), 'Step 22 — an unrelated learner never sees another learner\'s School A assignment (they were never enrolled at School A at all)')
})

// ── Step 26: evidence integrity ────────────────────────────────────────────

test('assignment discovery produces zero learner_evidence and zero learner_projections rows', async () => {
  const { learnerId, userId } = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-NOEVIDENCE`)
  const teacher = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'teacher-noevidence')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacher.membershipId)
  const csId = await currentClassSubjectId(classA, mathsIdA)
  await mkInstitutionalAssignment(teacher.email, csId, 'No-Evidence Assignment')

  const list = await listAssignmentsForAuthenticatedLearner(userId)
  assert.ok(list.length >= 1)

  const { data: bridged } = await db.from('students').select('id').eq('external_id', learnerId).maybeSingle()
  assert.ok(bridged, 'fixture assumption: fan-out already provisioned the compatibility student')
  const { data: evidence } = await db.from('learner_evidence').select('id').eq('learner_id', bridged!.id)
  const { data: projections } = await db.from('learner_projections').select('id').eq('learner_id', bridged!.id)
  assert.equal(evidence?.length ?? 0, 0, 'viewing/discovering assignments produces no learner_evidence')
  assert.equal(projections?.length ?? 0, 0, 'viewing/discovering assignments produces no learner_projections recompute')
})
