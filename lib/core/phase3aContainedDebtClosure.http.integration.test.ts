// lib/core/phase3aContainedDebtClosure.http.integration.test.ts
//
// PHASE 3A — Contained Debt Closure. Proves the two findings the adversarial
// closeout audit left as real, contained inconsistencies:
//
//   Part A — app/api/teacher/assignments/[id] GET now grants read access to
//   a REPLACEMENT teacher who currently holds the teaching tenure for the
//   same Core class+subject, in addition to the original creator — without
//   ever granting MARK (PATCH) authority to anyone but the creator.
//
//   Part B — app/api/student/resources now includes class-level durable
//   eligibility (the same assignment_submissions-existence signal
//   assignmentDiscovery.ts already uses) for institutional learners,
//   alongside current class_students membership.
//
//   Part C — app/api/student/home's pending-assignments widget now has a
//   real institutional branch, sourced from the canonical
//   listAssignmentsForAuthenticatedLearner discovery projection — no
//   reimplementation.
//
// Requires a server already running at TEST_BASE_URL (default
// http://localhost:3100), pointed at local Docker Supabase — never
// production. Same fixture patterns as
// lib/core/institutionalSubmissionParity.http.integration.test.ts.
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --experimental-test-module-mocks --test lib/core/phase3aContainedDebtClosure.http.integration.test.ts
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
import { enrollLearner } from '@/lib/core/learners'
import { transferLearner } from '@/lib/core/transfers'
import { admitTransferredLearner } from '@/lib/core/learners'
import { issueLearnerAccountActivation, claimLearnerAccountActivation } from '@/lib/core/learnerAccounts'
import { createAssignment } from '@/lib/assignments/create'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3100'
const SYNTHETIC_MARKER = 'SYNTHETIC_P3A_CLOSURE'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

async function mkUser(label: string): Promise<{ id: string; email: string }> {
  const email = `p3a-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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

async function httpSessionForUserId(userId: string): Promise<SyntheticSession> {
  const { data: updated, error } = await db.auth.admin.updateUserById(userId, { password: PASSWORD })
  if (error || !updated.user?.email) throw new Error(`httpSessionForUserId: failed to set password (${error?.message})`)
  return signInForHttpTest(updated.user.email, PASSWORD)
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

async function mkInstitutionalAssignment(
  teacherEmail: string,
  classSubjectId: string,
  title: string,
): Promise<{ id: string; class_id: string }> {
  const teacherClient = await signInAs(teacherEmail)
  const { assignment } = await createAssignment(teacherClient, {
    classSubjectId, title, subject: 'ignored', topic: 'Fixture Topic', substrandId: null,
    instructions: 'Fixture instructions', dueDate: new Date(Date.now() + 86400000).toISOString(),
    type: undefined, maxScore: undefined, isQuiz: undefined, isAdaptive: undefined,
    isCompassGuided: undefined, isHolidayAssignment: undefined, holidayPeriod: undefined, lessonPlanId: undefined,
  })
  return { id: assignment.id, class_id: assignment.class_id }
}

async function getTeacherAssignmentDetail(session: SyntheticSession, assignmentId: string): Promise<Response> {
  return fetch(`${BASE_URL}/api/teacher/assignments/${assignmentId}`, {
    headers: { Cookie: session.cookieHeader },
  })
}

async function patchTeacherAssignmentStatus(session: SyntheticSession, assignmentId: string, status: string): Promise<Response> {
  return fetch(`${BASE_URL}/api/teacher/assignments/${assignmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: session.cookieHeader },
    body: JSON.stringify({ status }),
  })
}

async function getStudentResources(session: SyntheticSession): Promise<Response> {
  return fetch(`${BASE_URL}/api/student/resources`, { headers: { Cookie: session.cookieHeader } })
}

async function getStudentHome(session: SyntheticSession): Promise<Response> {
  return fetch(`${BASE_URL}/api/student/home`, { headers: { Cookie: session.cookieHeader } })
}

async function getStudentAssignments(session: SyntheticSession): Promise<Response> {
  return fetch(`${BASE_URL}/api/student/assignments`, { headers: { Cookie: session.cookieHeader } })
}

// Phase 7 — Learner Home Convergence split the flat pendingAssignments array
// into a highlighted `nextAction` card plus a `continueAssignments` preview
// (never both at once: the item chosen as nextAction is deliberately
// excluded from continueAssignments so it isn't shown twice). This helper
// reconstructs "every assignment id Home is showing anywhere" so this
// file's pre-existing no-invented/no-hidden-eligibility invariant still
// holds against the new, sectioned shape.
function homeAssignmentIds(homeBody: { data: { nextAction: { kind: string; id: string } | null; continueAssignments: Array<{ id: string }> } }): Set<string> {
  const ids = new Set(homeBody.data.continueAssignments.map(a => a.id))
  if (homeBody.data.nextAction?.kind === 'assignment') ids.add(homeBody.data.nextAction.id)
  return ids
}

async function mkClassResource(classId: string, title: string): Promise<string> {
  const { data: teacherClass, error: tcError } = await db
    .from('teacher_classes')
    .select('teacher_id')
    .eq('id', classId)
    .single()
  if (tcError) throw tcError
  const { data, error } = await db
    .from('class_resources')
    .insert({ class_id: classId, teacher_id: teacherClass!.teacher_id, title, file_name: `${title}.pdf`, file_type: 'application/pdf', file_path: `fixtures/${SYNTHETIC_MARKER}/${title}.pdf` })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

let schoolA: Awaited<ReturnType<typeof mkSchool>>
let schoolB: Awaited<ReturnType<typeof mkSchool>>
let mathsIdA: string
let mathsIdB: string
let englishIdA: string
let classA: string
let classB: string
let termA: string
let termB: string
let yearA: string
let yearB: string

before(async () => {
  schoolA = await mkSchool('A')
  schoolB = await mkSchool('B')

  for (const [school, setClass, setTerm, setYear, setMaths, setEnglish] of [
    [schoolA, (v: string) => (classA = v), (v: string) => (termA = v), (v: string) => (yearA = v), (v: string) => (mathsIdA = v), (v: string) => (englishIdA = v)],
    [schoolB, (v: string) => (classB = v), (v: string) => (termB = v), (v: string) => (yearB = v), (v: string) => (mathsIdB = v), undefined],
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
    if (setEnglish) (setEnglish as (v: string) => void)(subjects.find(sub => sub.name === 'English')!.id)
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
        const { data: evidenceRows } = await db.from('learner_evidence').select('id').in('learner_id', studentIds)
        const evidenceIds = (evidenceRows ?? []).map(e => e.id)
        if (evidenceIds.length) {
          await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
          await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
          await db.from('learner_evidence').update({ supersedes: null, superseded_by: null }).in('id', evidenceIds)
        }
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
        await db.from('class_resources').delete().in('class_id', tcIds)
        await db.from('assignment_questions').delete().in('assignment_id', (await db.from('assignments').select('id').in('class_id', tcIds)).data?.map(a => a.id) ?? [])
        await db.from('assignments').delete().in('class_id', tcIds)
        await db.from('teacher_classes').delete().in('id', tcIds)
      }
      await db.from('class_subject_legacy_bridge').delete().in('class_subject_id', csIds)
    }
  }
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
    await db.from('ingestion_runs').delete().eq('initiated_by', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

// ═══════════════════════════ PART A — teacher detail READ authority ═══════

test('PART A: original creator can read their own assignment detail', async () => {
  const peter = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-peter-creator')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, peter.membershipId)
  const csId = await currentClassSubjectId(classA, mathsIdA)
  const assignment = await mkInstitutionalAssignment(peter.email, csId, 'Creator Read Assignment')

  const session = await httpSessionForUserId(peter.userId)
  const res = await getTeacherAssignmentDetail(session, assignment.id)
  assert.equal(res.status, 200, await res.text())
})

test('PART A: replacement teacher (Mary) can read the departed creator (Peter)\'s assignment detail', async () => {
  const peter = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-peter-repl')
  const mary = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-mary-repl')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, peter.membershipId)
  const csId = await currentClassSubjectId(classA, mathsIdA)
  const assignment = await mkInstitutionalAssignment(peter.email, csId, 'Peter\'s Assignment (Read Test)')

  // Replace Peter with Mary.
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, mary.membershipId)

  const marySession = await httpSessionForUserId(mary.userId)
  const res = await getTeacherAssignmentDetail(marySession, assignment.id)
  const resText = await res.text()
  assert.equal(res.status, 200, resText)
  const body = JSON.parse(resText)
  assert.equal(body.data.assignment.id, assignment.id)

  // Peter's own historical read access is unaffected — his creator check
  // never depended on this fix, and remains true after being replaced.
  const peterSession = await httpSessionForUserId(peter.userId)
  const peterRes = await getTeacherAssignmentDetail(peterSession, assignment.id)
  assert.equal(peterRes.status, 200, await peterRes.text())
})

test('PART A: unrelated same-school teacher (never taught this class) is denied', async () => {
  const peter = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-peter-unrel')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, peter.membershipId)
  const csId = await currentClassSubjectId(classA, mathsIdA)
  const assignment = await mkInstitutionalAssignment(peter.email, csId, 'Unrelated Teacher Assignment')

  const stranger = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-stranger')
  const session = await httpSessionForUserId(stranger.userId)
  const res = await getTeacherAssignmentDetail(session, assignment.id)
  assert.equal(res.status, 404)
})

test('PART A: teacher of the same class but a DIFFERENT current subject is denied', async () => {
  const peter = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-peter-subj')
  const englishTeacher = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-english-teacher')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, peter.membershipId)
  await assignSubjectTeacher(schoolA.schoolId, classA, englishIdA, englishTeacher.membershipId)
  const mathsCsId = await currentClassSubjectId(classA, mathsIdA)
  const assignment = await mkInstitutionalAssignment(peter.email, mathsCsId, 'Maths-Only Assignment')

  const session = await httpSessionForUserId(englishTeacher.userId)
  const res = await getTeacherAssignmentDetail(session, assignment.id)
  assert.equal(res.status, 404)
})

test('PART A: cross-school teacher is denied even if they hold the SAME subject elsewhere', async () => {
  const peterA = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-peterA-cross')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, peterA.membershipId)
  const csA = await currentClassSubjectId(classA, mathsIdA)
  const assignment = await mkInstitutionalAssignment(peterA.email, csA, 'School A Cross-School Assignment')

  const teacherB = await addTeacher(schoolB.schoolId, schoolB.adminUserId, 'p3a-teacherB-cross')
  await assignSubjectTeacher(schoolB.schoolId, classB, mathsIdB, teacherB.membershipId)

  const session = await httpSessionForUserId(teacherB.userId)
  const res = await getTeacherAssignmentDetail(session, assignment.id)
  assert.equal(res.status, 404)
})

test('PART A: departed teacher who is neither creator nor current tenure holder is denied', async () => {
  const peter = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-peter-departed')
  const mary = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-mary-departed')
  const unrelatedDeparted = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-unrelated-departed')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, peter.membershipId)
  const csId = await currentClassSubjectId(classA, mathsIdA)
  const assignment = await mkInstitutionalAssignment(peter.email, csId, 'Departed Teacher Assignment')
  // unrelatedDeparted never taught this class/subject at all — replace
  // Peter with Mary, leaving unrelatedDeparted with zero relationship.
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, mary.membershipId)

  const session = await httpSessionForUserId(unrelatedDeparted.userId)
  const res = await getTeacherAssignmentDetail(session, assignment.id)
  assert.equal(res.status, 404)
})

test('PART A: MARK authority (PATCH) remains creator-only — replacement teacher can READ but not PATCH', async () => {
  const peter = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-peter-mark')
  const mary = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-mary-mark')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, peter.membershipId)
  const csId = await currentClassSubjectId(classA, mathsIdA)
  const assignment = await mkInstitutionalAssignment(peter.email, csId, 'Mark Authority Assignment')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, mary.membershipId)

  const marySession = await httpSessionForUserId(mary.userId)

  // Mary CAN read it (Phase 3A fix).
  const readRes = await getTeacherAssignmentDetail(marySession, assignment.id)
  assert.equal(readRes.status, 200, await readRes.text())

  // Mary CANNOT mark/patch it — the PATCH route is untouched, still
  // `assignments.teacher_id === teacher.id` only.
  const patchRes = await patchTeacherAssignmentStatus(marySession, assignment.id, 'closed')
  assert.equal(patchRes.status, 404)

  // Peter, the original creator, still can.
  const peterSession = await httpSessionForUserId(peter.userId)
  const peterPatchRes = await patchTeacherAssignmentStatus(peterSession, assignment.id, 'closed')
  assert.equal(peterPatchRes.status, 200, await peterPatchRes.text())
})

// ═══════════════════════════ PART B — resources durability ════════════════

test('PART B: institutional learner sees a CURRENT class resource', async () => {
  const teacher = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-res-teacher-current')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacher.membershipId)
  const csId = await currentClassSubjectId(classA, mathsIdA)
  // Learner must be admitted BEFORE the anchor assignment is created — the
  // compatibility roster (class_students for the legacy teacher_classes
  // row) is only materialized by roster sync, which runs at assignment
  // CREATION time (lib/core/assignmentLearnerBridge.ts), not independently
  // on enrollment. Admitting after would make this indistinguishable from
  // the PRE-ENROLMENT case the rest of this domain deliberately treats as
  // NOT current.
  const learner = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-RES-CURRENT`)
  const assignment = await mkInstitutionalAssignment(teacher.email, csId, 'Anchor Assignment For Resources')
  const resourceId = await mkClassResource(assignment.class_id, `${SYNTHETIC_MARKER} Current Resource`)

  const session = await httpSessionForUserId(learner.userId)
  const res = await getStudentResources(session)
  const resText = await res.text()
  assert.equal(res.status, 200, resText)
  const body = JSON.parse(resText)
  assert.ok(body.data.resources.some((r: { id: string }) => r.id === resourceId), 'current resource must be visible')
})

test('PART B: transferred-out learner keeps DURABLE access to their old school\'s class resources', async () => {
  const teacher = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-res-teacher-xfer')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacher.membershipId)
  const csId = await currentClassSubjectId(classA, mathsIdA)
  const learner = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-RES-XFER`)
  const assignment = await mkInstitutionalAssignment(teacher.email, csId, 'Pre-Transfer Anchor Assignment')
  const resourceId = await mkClassResource(assignment.class_id, `${SYNTHETIC_MARKER} Pre-Transfer Resource`)

  const transferOut = await transferLearner(schoolA.adminSchoolUserId, {
    learner_id: learner.learnerId, direction: 'out', to_school_id: schoolB.schoolId, to_school_name: 'School B',
    transfer_date: new Date().toISOString().slice(0, 10),
  })
  const admitB = await admitTransferredLearner(
    schoolB.schoolId, schoolB.adminSchoolUserId,
    { admission_number: `${SYNTHETIC_MARKER}-RES-XFER-B`, first_name: 'Test', last_name: 'Learner' },
    transferOut.transferToken!
  )
  assert.equal(admitB.status, 'admitted')
  await enrollLearner({ learner_id: admitB.learner!.id, class_id: classB, term_id: termB, academic_year_id: yearB, school_id: schoolB.schoolId })

  const session = await httpSessionForUserId(learner.userId)
  const res = await getStudentResources(session)
  const resText = await res.text()
  assert.equal(res.status, 200, resText)
  const body = JSON.parse(resText)
  assert.ok(body.data.resources.some((r: { id: string }) => r.id === resourceId), 'pre-transfer resource must remain visible after transfer')
})

test('PART B: unrelated class resource and cross-school resource are never visible', async () => {
  const teacherA = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-res-teacher-unrelA')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacherA.membershipId)
  const csA = await currentClassSubjectId(classA, mathsIdA)
  const unrelatedAssignment = await mkInstitutionalAssignment(teacherA.email, csA, 'Unrelated Class Anchor Assignment')
  const unrelatedResourceId = await mkClassResource(unrelatedAssignment.class_id, `${SYNTHETIC_MARKER} Unrelated Resource`)

  const teacherB = await addTeacher(schoolB.schoolId, schoolB.adminUserId, 'p3a-res-teacherB-cross')
  await assignSubjectTeacher(schoolB.schoolId, classB, mathsIdB, teacherB.membershipId)
  const csB = await currentClassSubjectId(classB, mathsIdB)
  const crossSchoolAssignment = await mkInstitutionalAssignment(teacherB.email, csB, 'Cross-School Anchor Assignment')
  const crossSchoolResourceId = await mkClassResource(crossSchoolAssignment.class_id, `${SYNTHETIC_MARKER} Cross-School Resource`)

  // A learner at school A with no relationship to the unrelated class/assignment above.
  const learner = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-RES-UNREL`)
  const session = await httpSessionForUserId(learner.userId)
  const res = await getStudentResources(session)
  const resText = await res.text()
  assert.equal(res.status, 200, resText)
  const body = JSON.parse(resText)
  const ids = new Set(body.data.resources.map((r: { id: string }) => r.id))
  assert.ok(!ids.has(unrelatedResourceId), 'resource of a class this learner never had standing in must not be visible')
  assert.ok(!ids.has(crossSchoolResourceId), 'a different school\'s resource must never be visible')
})

// ═══════════════════════════ PART C — home widget canonical discovery ═════

test('PART C: institutional learner\'s home pending-assignments widget matches /api/student/assignments (no 404, no empty widget)', async () => {
  const teacher = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-home-teacher')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacher.membershipId)
  const csId = await currentClassSubjectId(classA, mathsIdA)
  const learner = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-HOME`)
  const assignment = await mkInstitutionalAssignment(teacher.email, csId, 'Home Widget Assignment')

  const session = await httpSessionForUserId(learner.userId)

  const homeRes = await getStudentHome(session)
  const homeResText = await homeRes.text()
  assert.equal(homeRes.status, 200, homeResText)
  const homeBody = JSON.parse(homeResText)
  const homeIds = homeAssignmentIds(homeBody)
  assert.ok(homeIds.has(assignment.id), 'home widget must show the institutional learner\'s real pending assignment')

  const assignmentsRes = await getStudentAssignments(session)
  const assignmentsResText = await assignmentsRes.text()
  assert.equal(assignmentsRes.status, 200, assignmentsResText)
  const assignmentsBody = JSON.parse(assignmentsResText)
  const fullListIds = new Set((assignmentsBody.data.assignments as Array<{ id: string }>).map(a => a.id))
  assert.ok(fullListIds.has(assignment.id))

  // Every id the home widget shows must also appear on the full assignments
  // page — never disagreement, never an eligibility surface the widget
  // invented on its own.
  for (const id of homeIds) {
    assert.ok(fullListIds.has(id), `home widget shows assignment ${id} not present on the full assignments page`)
  }
})

test('PART C: transferred learner\'s home widget reflects the SAME visibility as the full assignments page (new school visible, old post-transfer hidden)', async () => {
  const teacherA = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'p3a-home-teacherA-xfer')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacherA.membershipId)
  const csA = await currentClassSubjectId(classA, mathsIdA)
  const learner = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-HOME-XFER`)
  const historicalAssignment = await mkInstitutionalAssignment(teacherA.email, csA, 'Home Historical Assignment')

  const transferOut = await transferLearner(schoolA.adminSchoolUserId, {
    learner_id: learner.learnerId, direction: 'out', to_school_id: schoolB.schoolId, to_school_name: 'School B',
    transfer_date: new Date().toISOString().slice(0, 10),
  })
  const admitB = await admitTransferredLearner(
    schoolB.schoolId, schoolB.adminSchoolUserId,
    { admission_number: `${SYNTHETIC_MARKER}-HOME-XFER-B`, first_name: 'Test', last_name: 'Learner' },
    transferOut.transferToken!
  )
  assert.equal(admitB.status, 'admitted')
  await enrollLearner({ learner_id: admitB.learner!.id, class_id: classB, term_id: termB, academic_year_id: yearB, school_id: schoolB.schoolId })

  const teacherB = await addTeacher(schoolB.schoolId, schoolB.adminUserId, 'p3a-home-teacherB-xfer')
  await assignSubjectTeacher(schoolB.schoolId, classB, mathsIdB, teacherB.membershipId)
  const csB = await currentClassSubjectId(classB, mathsIdB)
  const newSchoolAssignment = await mkInstitutionalAssignment(teacherB.email, csB, 'Home New School Assignment')
  // A new post-transfer assignment issued by the OLD school — must stay hidden.
  const postTransferOldSchool = await mkInstitutionalAssignment(teacherA.email, csA, 'Home Post-Transfer Old-School Assignment')
  void postTransferOldSchool

  const session = await httpSessionForUserId(learner.userId)
  const homeRes = await getStudentHome(session)
  const homeResText = await homeRes.text()
  assert.equal(homeRes.status, 200, homeResText)
  const homeBody = JSON.parse(homeResText)
  const homeIds = homeAssignmentIds(homeBody)

  const assignmentsRes = await getStudentAssignments(session)
  const assignmentsBody = JSON.parse(await assignmentsRes.text())
  const fullListIds = new Set((assignmentsBody.data.assignments as Array<{ id: string }>).map(a => a.id))

  assert.deepEqual([...homeIds].sort(), [...fullListIds].sort(), 'home widget and full assignments page must show identical assignment sets after a transfer')
  assert.ok(fullListIds.has(historicalAssignment.id), 'pre-transfer historical assignment must remain visible')
  assert.ok(fullListIds.has(newSchoolAssignment.id), 'new school assignment must be visible')
  assert.ok(!fullListIds.has(postTransferOldSchool.id), 'post-transfer old-school assignment must remain hidden')
})
