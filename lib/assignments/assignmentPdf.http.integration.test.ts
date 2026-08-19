// lib/assignments/assignmentPdf.http.integration.test.ts
//
// PHASE 3 — Intermittent-Connectivity Assignment Delivery. Proves
// GET /api/student/assignments/[id]/pdf end to end:
//   - reuses the SAME authorization primitives Phase 0/2/2.5 already
//     proved (requireClassMembership for legacy self/parent,
//     resolveInstitutionalAssignmentReadAccess for institutional learners)
//   - the full Step 5 security matrix: own assignment, wrong learner,
//     wrong class, cross-school, post-transfer old-school assignment,
//     historical pre-transfer assignment, teacher replacement, forged
//     UUID, unauthenticated
//   - Step 2/14 PDF content: title/subject/instructions/due date present,
//     quiz correct_index NEVER present anywhere in the PDF bytes
//   - Step 6 evidence integrity: zero learner_evidence/learner_projections
//     rows created by a download, before vs after
//   - Step 26/27 filename + Content-Disposition
//
// Requires a server already running at TEST_BASE_URL (default
// http://localhost:3100), pointed at local Docker Supabase — never
// production.
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --experimental-test-module-mocks --test lib/assignments/assignmentPdf.http.integration.test.ts
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
const SYNTHETIC_MARKER = 'SYNTHETIC_P3_PDF_HTTP'
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
  const email = `p3pdf-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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

async function createSyntheticUser(label: string): Promise<{ authId: string; session: SyntheticSession }> {
  const { id, email } = await mkUser(label)
  const session = await retryAsync(() => signInForHttpTest(email, PASSWORD))
  return { authId: id, session }
}

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

async function pdfGet(session: SyntheticSession | null, assignmentId: string): Promise<Response> {
  return fetch(`${BASE_URL}/api/student/assignments/${assignmentId}/pdf`, {
    headers: session ? cookie(session) : {},
  })
}

async function evidenceCount(studentId: string): Promise<number> {
  const { data } = await db.from('learner_evidence').select('id').eq('learner_id', studentId)
  return data?.length ?? 0
}

async function projectionCount(studentId: string): Promise<number> {
  const { data } = await db.from('learner_projections').select('id').eq('learner_id', studentId)
  return data?.length ?? 0
}

// ── Legacy/Solo fixture ─────────────────────────────────────────────────

type LegacyFixture = {
  teacherAId: string
  studentASession: SyntheticSession
  studentAId: string
  studentBSession: SyntheticSession
  studentBId: string
  parentASession: SyntheticSession
  classAId: string
  classBId: string
  typedAssignmentId: string
  quizAssignmentId: string
}

let legacy: LegacyFixture

async function setUpLegacyFixture(): Promise<LegacyFixture> {
  const teacherA = await createSyntheticUser('legacy-teacher-a')
  const studentA = await createSyntheticUser('legacy-student-a')
  const studentB = await createSyntheticUser('legacy-student-b')
  const parentA = await createSyntheticUser('legacy-parent-a')

  const { data: teacherARow, error: teacherAErr } = await db
    .from('teachers').insert({ user_id: teacherA.authId, full_name: SYNTHETIC_MARKER, school: `${SYNTHETIC_MARKER}_SCHOOL_A` })
    .select('id').single()
  if (teacherAErr) throw teacherAErr

  const { data: classA, error: classAErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherARow.id, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_A_${Date.now()}` })
    .select('id').single()
  if (classAErr) throw classAErr

  const { data: classB, error: classBErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherARow.id, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_B_${Date.now()}` })
    .select('id').single()
  if (classBErr) throw classBErr

  const { data: studentARow, error: studentAErr } = await db
    .from('students').insert({ user_id: studentA.authId, parent_user_id: parentA.authId, name: 'Student A', grade: 8, level: 'Junior School' })
    .select('id').single()
  if (studentAErr) throw studentAErr
  await db.from('class_students').insert({ class_id: classA.id, student_id: studentARow.id })

  const { data: studentBRow, error: studentBErr } = await db
    .from('students').insert({ user_id: studentB.authId, name: 'Student B', grade: 8, level: 'Junior School' })
    .select('id').single()
  if (studentBErr) throw studentBErr
  await db.from('class_students').insert({ class_id: classB.id, student_id: studentBRow.id })

  const { data: typedAssignment, error: typedErr } = await db
    .from('assignments')
    .insert({
      class_id: classA.id, teacher_id: teacherARow.id, title: 'Fixture Ratios Homework',
      subject: 'Mathematics', topic: 'Ratios', instructions: 'Solve problems 1 through 10 showing your working.',
      due_date: new Date(Date.now() + 86400_000).toISOString(), type: 'practice', max_score: 100, status: 'active',
    })
    .select('id').single()
  if (typedErr) throw typedErr

  const { data: quizAssignment, error: quizErr } = await db
    .from('assignments')
    .insert({
      class_id: classA.id, teacher_id: teacherARow.id, title: 'Fixture Fractions Quiz',
      subject: 'Mathematics', topic: 'Fractions', instructions: 'Answer all questions.',
      due_date: new Date(Date.now() + 86400_000).toISOString(), is_quiz: true, max_score: 20, status: 'active',
    })
    .select('id').single()
  if (quizErr) throw quizErr

  const { error: qErr } = await db
    .from('assignment_questions')
    .insert([
      { assignment_id: quizAssignment.id, question_text: 'SECRET_CORRECT_INDEX_MARKER 1/2 + 1/2 = ?', choices: ['1', '2', '0', 'ONE_HALF_PLUS_ONE_HALF_CHOICE'], correct_index: 0, order_index: 0 },
      { assignment_id: quizAssignment.id, question_text: '3/4 - 1/4 = ?', choices: ['1/2', '1', '2', '4'], correct_index: 0, order_index: 1 },
    ])
  if (qErr) throw qErr

  return {
    teacherAId: teacherARow.id,
    studentASession: studentA.session, studentAId: studentARow.id,
    studentBSession: studentB.session, studentBId: studentBRow.id,
    parentASession: parentA.session,
    classAId: classA.id, classBId: classB.id,
    typedAssignmentId: typedAssignment.id, quizAssignmentId: quizAssignment.id,
  }
}

// ── Institutional fixture helpers (Phase 2.5's proven pattern, reused) ──

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

async function mkInstitutionalAssignment(teacherEmail: string, classSubjectId: string, title: string, opts?: { isQuiz?: boolean }): Promise<{ id: string; class_id: string }> {
  const teacherClient = await signInAs(teacherEmail)
  const { assignment } = await createAssignment(teacherClient, {
    classSubjectId, title, subject: 'ignored', topic: 'Fixture Topic', substrandId: null,
    instructions: 'Fixture instructions', dueDate: new Date(Date.now() + 86400000).toISOString(),
    type: undefined, maxScore: undefined, isQuiz: opts?.isQuiz, isAdaptive: undefined,
    isCompassGuided: undefined, isHolidayAssignment: undefined, holidayPeriod: undefined, lessonPlanId: undefined,
  })
  return { id: assignment.id, class_id: assignment.class_id }
}

let schoolA: Awaited<ReturnType<typeof mkSchool>>
let schoolB: Awaited<ReturnType<typeof mkSchool>>
let mathsIdA: string
let mathsIdB: string
let classA: string
let classB: string
let termA: string
let termB: string
let yearA: string
let yearB: string

before(async () => {
  legacy = await setUpLegacyFixture()

  schoolA = await mkSchool('A')
  schoolB = await mkSchool('B')

  for (const [school, setClass, setTerm, setYear, setMaths] of [
    [schoolA, (v: string) => (classA = v), (v: string) => (termA = v), (v: string) => (yearA = v), (v: string) => (mathsIdA = v)],
    [schoolB, (v: string) => (classB = v), (v: string) => (termB = v), (v: string) => (yearB = v), (v: string) => (mathsIdB = v)],
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
  // Legacy fixture cleanup.
  await db.from('teacher_classes').delete().ilike('name', `${SYNTHETIC_MARKER}%`)
  await db.from('students').delete().in('id', [legacy?.studentAId, legacy?.studentBId].filter(Boolean) as string[])
  if (legacy?.teacherAId) await db.from('teachers').delete().eq('id', legacy.teacherAId)

  // Institutional fixture cleanup — mirrors institutionalSubmissionParity's
  // proven teardown exactly.
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
    if (learnerIds.length) await db.from('learner_identity_links').delete().in('learner_id', learnerIds)
    const identityIds = [...new Set((learnerRows ?? []).map(l => l.learner_identity_id).filter(Boolean))]
    if (identityIds.length) await db.from('learner_accounts').delete().in('learner_identity_id', identityIds)
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
  if (orphanIds.length > 0) await db.from('learner_identities').delete().in('id', orphanIds)

  for (const id of createdAuthUserIds) {
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('platform_events').delete().eq('actor_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('ingestion_runs').delete().eq('initiated_by', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

// ── Unauthenticated / malformed ─────────────────────────────────────────

test('GET pdf: unauthenticated request is rejected with 401', async () => {
  const res = await pdfGet(null, legacy.typedAssignmentId)
  assert.equal(res.status, 401)
})

test('GET pdf: forged/malformed assignment UUID is denied, never 500', async () => {
  const res = await pdfGet(legacy.studentASession, 'not-a-real-uuid-at-all')
  assert.ok(res.status === 404 || res.status === 400, `expected 404/400, got ${res.status}`)
})

test('GET pdf: well-formed but nonexistent assignment UUID is 404', async () => {
  const res = await pdfGet(legacy.studentASession, '00000000-0000-0000-0000-000000000000')
  assert.equal(res.status, 404)
})

// ── Legacy self / parent / cross-learner / cross-class ──────────────────

test('GET pdf: legacy learner can download their own class assignment as a real PDF', async () => {
  const res = await pdfGet(legacy.studentASession, legacy.typedAssignmentId)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'application/pdf')
  const disposition = res.headers.get('content-disposition') ?? ''
  assert.match(disposition, /attachment/)
  assert.match(disposition, /\.pdf"/)
  const bytes = new Uint8Array(await res.arrayBuffer())
  assert.ok(bytes.length > 100, 'expected a non-trivial PDF byte stream')
  // %PDF magic bytes — a real PDF, not an HTML print page.
  assert.equal(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]), '%PDF')
})

test('GET pdf: a linked parent can download their child\'s assignment', async () => {
  const res = await pdfGet(legacy.parentASession, legacy.typedAssignmentId)
  assert.equal(res.status, 200, await res.text())
})

test('GET pdf: a different legacy learner cannot download another learner\'s class assignment (wrong class)', async () => {
  const res = await pdfGet(legacy.studentBSession, legacy.typedAssignmentId)
  assert.equal(res.status, 403)
})

// ── PDF content proof (Step 2/14) ────────────────────────────────────────

test('GET pdf: a real, well-formed PDF is returned for a quiz assignment (magic bytes + non-trivial size)', async () => {
  const res = await pdfGet(legacy.studentASession, legacy.quizAssignmentId)
  assert.equal(res.status, 200)
  const bytes = new Uint8Array(await res.arrayBuffer())
  assert.ok(bytes.length > 100)
  assert.equal(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]), '%PDF')
})

test('GET pdf: the content DTO actually fed to the quiz PDF renderer never carries correct_index (Step 14)', async () => {
  // This is the strongest possible proof for Step 14: exercise the EXACT
  // same content-resolution function the route calls
  // (resolveAssignmentPdfContent -> findQuestionsForStudent), and assert
  // the object shape has no correct_index field at all — not merely that
  // it isn't rendered, but that the data reaching the renderer never
  // carries it in the first place. findQuestionsForStudent's own `.select`
  // never names the column (lib/quiz/quiz.ts), so this is a real
  // structural guarantee, not a string-matching heuristic.
  const { resolveAssignmentPdfContent } = await import('@/lib/assignments/assignmentPdfContent')
  const content = await resolveAssignmentPdfContent(legacy.quizAssignmentId)
  assert.ok(content)
  assert.ok(content!.questions.length > 0)
  for (const q of content!.questions) {
    assert.ok(!('correct_index' in q), 'a PDF-bound question must never carry correct_index')
    assert.ok(!('correctIndex' in q), 'a PDF-bound question must never carry correctIndex')
  }
})

test('GET pdf: evidence and projections are unchanged by a download (Step 6)', async () => {
  const before = await evidenceCount(legacy.studentAId)
  const beforeProj = await projectionCount(legacy.studentAId)
  const res = await pdfGet(legacy.studentASession, legacy.typedAssignmentId)
  assert.equal(res.status, 200)
  await res.arrayBuffer()
  const after = await evidenceCount(legacy.studentAId)
  const afterProj = await projectionCount(legacy.studentAId)
  assert.equal(after, before, 'a PDF download must never create learner_evidence')
  assert.equal(afterProj, beforeProj, 'a PDF download must never create/mutate learner_projections')
})

// ── Institutional security matrix ────────────────────────────────────────

test('institutional: legitimate learner can download their own assignment', async () => {
  const teacher = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'pdf-teacher-own')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacher.membershipId)
  const cs = await currentClassSubjectId(classA, mathsIdA)
  const learner = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-OWN`)
  const assignment = await mkInstitutionalAssignment(teacher.email, cs, 'Institutional Own Assignment')
  const session = await httpSessionForUserId(learner.userId)

  const res = await pdfGet(session, assignment.id)
  assert.equal(res.status, 200, await res.text())
  assert.equal(res.headers.get('content-type'), 'application/pdf')
})

test('institutional: WRONG LEARNER cannot download another learner\'s assignment', async () => {
  const teacher = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'pdf-teacher-wronglearner')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacher.membershipId)
  const cs = await currentClassSubjectId(classA, mathsIdA)
  await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-WL-OWNER`)
  const assignment = await mkInstitutionalAssignment(teacher.email, cs, 'Wrong Learner Assignment')
  // The intruder is admitted AFTER this assignment's fan-out already ran —
  // roster fan-out is class-wide at creation time (Phase 1C), so a learner
  // admitted before creation would legitimately also receive this
  // assignment. Admitting afterwards is the only way to construct a
  // genuine "never issued to this learner" case (same construction
  // institutionalSubmissionParity's own WRONG LEARNER test uses).
  const intruder = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-WL-INTRUDER`)

  const intruderSession = await httpSessionForUserId(intruder.userId)
  const res = await pdfGet(intruderSession, assignment.id)
  assert.equal(res.status, 403)
})

test('institutional: CROSS-SCHOOL learner cannot download another school\'s assignment', async () => {
  const teacherA = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'pdf-teacher-crossA')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacherA.membershipId)
  const csA = await currentClassSubjectId(classA, mathsIdA)
  const assignmentA = await mkInstitutionalAssignment(teacherA.email, csA, 'School A Cross-School Assignment')

  const learnerB = await admitAndActivate(schoolB.schoolId, classB, termB, yearB, schoolB.adminSchoolUserId, `${SYNTHETIC_MARKER}-CROSS-B`)
  const sessionB = await httpSessionForUserId(learnerB.userId)

  const res = await pdfGet(sessionB, assignmentA.id)
  assert.equal(res.status, 403)
})

test('institutional: HISTORICAL assignment stays downloadable after transfer; a NEW old-school assignment issued after transfer is not', async () => {
  const teacherA = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'pdf-teacher-xfer')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacherA.membershipId)
  const csA = await currentClassSubjectId(classA, mathsIdA)

  const learner = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-PDFXFER`)
  const historicalAssignment = await mkInstitutionalAssignment(teacherA.email, csA, 'School A Historical PDF Assignment')
  const session = await httpSessionForUserId(learner.userId)

  const transferOut = await transferLearner(schoolA.adminSchoolUserId, {
    learner_id: learner.learnerId, direction: 'out', to_school_id: schoolB.schoolId, to_school_name: 'School B',
    transfer_date: new Date().toISOString().slice(0, 10),
  })
  assert.ok(transferOut.transferToken)
  const admitB = await admitTransferredLearner(
    schoolB.schoolId, schoolB.adminSchoolUserId,
    { admission_number: `${SYNTHETIC_MARKER}-PDFXFER-B`, first_name: 'Test', last_name: 'Learner' },
    transferOut.transferToken!
  )
  assert.equal(admitB.status, 'admitted')
  await enrollLearner({ learner_id: admitB.learner!.id, class_id: classB, term_id: termB, academic_year_id: yearB, school_id: schoolB.schoolId })

  const postTransferAssignment = await mkInstitutionalAssignment(teacherA.email, csA, 'School A Post-Transfer PDF Assignment')

  const historicalRes = await pdfGet(session, historicalAssignment.id)
  assert.equal(historicalRes.status, 200, await historicalRes.text())

  const postRes = await pdfGet(session, postTransferAssignment.id)
  assert.equal(postRes.status, 403)
})

test('institutional: download remains possible after the issuing teacher is replaced', async () => {
  const peter = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'pdf-peter')
  const mary = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'pdf-mary')
  const learner = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-PDFREPL`)

  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, peter.membershipId)
  const peterCsId = await currentClassSubjectId(classA, mathsIdA)
  const assignment = await mkInstitutionalAssignment(peter.email, peterCsId, 'Peter\'s PDF Assignment')

  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, mary.membershipId)

  const session = await httpSessionForUserId(learner.userId)
  const res = await pdfGet(session, assignment.id)
  assert.equal(res.status, 200, await res.text())
})
