// lib/core/institutionalSubmissionParity.http.integration.test.ts
//
// PHASE 2.5 — Institutional Learner Submission Parity. Proves the WRITE-side
// mirror of Phase 2's read-only discovery chain: an authenticated
// institutional learner can submit/submit-file/submit-quiz exactly the
// assignments legitimately issued to them (durable `assignment_submissions`
// existence, the same recipient-materialization signal Phase 2's read path
// already proved), and cannot mutate anything that was not issued to them —
// across wrong-learner, cross-school, pre-enrolment, historical-transfer,
// and forged-identifier attempts. Legacy/Solo learner behavior (unchanged
// code path) is regression-tested alongside.
//
// Requires a server already running at TEST_BASE_URL (default
// http://localhost:3100), pointed at local Docker Supabase — never
// production. Route handlers read the session via `next/headers` cookies()
// (utils/supabase/server.ts), which only resolves inside a real Next.js
// request, so this must run as an HTTP test against a live server, not by
// importing the route handlers directly.
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --experimental-test-module-mocks --test lib/core/institutionalSubmissionParity.http.integration.test.ts
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
const SYNTHETIC_MARKER = 'SYNTHETIC_P25_SUBMIT_HTTP'
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
  const email = `p25submit-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await retryAsync(async () => {
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

/** Real HTTP cookie session for a synthetic institutional learner's auth.users.id — that account is created passwordless (Step 8 of learnerAccounts.ts), so tests set a password via the admin API purely to obtain a real signed-in session, exercising the exact same route/cookie machinery a real browser session would. */
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
  opts?: { isQuiz?: boolean },
): Promise<{ id: string; class_id: string }> {
  const teacherClient = await signInAs(teacherEmail)
  const { assignment } = await createAssignment(teacherClient, {
    classSubjectId, title, subject: 'ignored', topic: 'Fixture Topic', substrandId: null,
    instructions: 'Fixture instructions', dueDate: new Date(Date.now() + 86400000).toISOString(),
    type: undefined, maxScore: undefined, isQuiz: opts?.isQuiz, isAdaptive: undefined,
    isCompassGuided: undefined, isHolidayAssignment: undefined, holidayPeriod: undefined, lessonPlanId: undefined,
  })
  return { id: assignment.id, class_id: assignment.class_id }
}

/** A fully self-contained legacy/Solo world: a `teachers` row, a `teacher_classes` row (the actual FK target of `assignments.class_id`/`class_students.class_id` — NOT Core's `classes.id`), pre-dating Core/institutional entirely. Used only for the regression checks (Section 7 of the Phase 2.5 spec). */
async function mkLegacyTeacher(label: string): Promise<{ userId: string; teacherId: string }> {
  const user = await mkUser(`legacy-teacher-${label}`)
  const { data: teacher, error } = await db
    .from('teachers')
    .insert({ user_id: user.id, full_name: `${SYNTHETIC_MARKER} Legacy Teacher ${label}`, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (error) throw error
  return { userId: user.id, teacherId: teacher.id as string }
}

async function mkLegacyClass(teacherId: string, label: string): Promise<string> {
  const { data, error } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherId, name: `${SYNTHETIC_MARKER} Legacy Class ${label}`, grade: 7, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

/** A minimal legacy/Solo learner — real `students.user_id` (never a compatibility row). */
async function mkLegacyStudent(label: string, classId: string): Promise<{ userId: string; studentId: string; email: string }> {
  const user = await mkUser(`legacy-${label}`)
  const { data: student, error } = await db
    .from('students')
    .insert({ user_id: user.id, name: `${SYNTHETIC_MARKER} Legacy ${label}`, school: SYNTHETIC_MARKER, grade: 7, level: 'Junior School' })
    .select('id')
    .single()
  if (error) throw error
  await db.from('class_students').insert({ class_id: classId, student_id: student.id })
  return { userId: user.id, studentId: student.id as string, email: user.email }
}

/** A legacy assignment on `teacher_classes`/`classId`, bypassing the institutional creation service — mirrors how legacy assignments have always been created (direct insert), so the legacy regression path is genuinely untouched code, not institutional machinery in disguise. */
async function mkLegacyAssignment(classId: string, teacherId: string, studentIds: string[], opts?: { isQuiz?: boolean }): Promise<{ id: string; class_id: string }> {
  const { data: assignment, error } = await db
    .from('assignments')
    .insert({
      class_id: classId, teacher_id: teacherId, title: `${SYNTHETIC_MARKER} Legacy Assignment`,
      subject: 'Mathematics', topic: 'Fixture', instructions: 'Fixture instructions',
      due_date: new Date(Date.now() + 86400000).toISOString(), type: 'practice', max_score: 100,
      is_quiz: !!opts?.isQuiz, status: 'active',
    })
    .select('id, class_id')
    .single()
  if (error) throw error
  if (studentIds.length) {
    await db.from('assignment_submissions').insert(studentIds.map(sid => ({
      assignment_id: assignment.id, student_id: sid, class_id: classId, status: 'pending',
    })))
  }
  return { id: assignment.id as string, class_id: assignment.class_id as string }
}

async function submitTyped(session: SyntheticSession, assignmentId: string, studentId: string, workText: string): Promise<Response> {
  return fetch(`${BASE_URL}/api/student/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: session.cookieHeader },
    body: JSON.stringify({ assignmentId, studentId, work_text: workText }),
  })
}

async function submitFile(session: SyntheticSession, assignmentId: string, studentId: string): Promise<Response> {
  const form = new FormData()
  form.set('assignmentId', assignmentId)
  form.set('studentId', studentId)
  form.set('file', new File([new Uint8Array([1, 2, 3, 4])], 'work.pdf', { type: 'application/pdf' }))
  return fetch(`${BASE_URL}/api/student/submit-file`, {
    method: 'POST',
    headers: { Cookie: session.cookieHeader },
    body: form,
  })
}

async function submitQuiz(session: SyntheticSession, assignmentId: string, studentId: string, answers: Array<{ questionId: string; selectedIndex: number }>): Promise<Response> {
  return fetch(`${BASE_URL}/api/student/submit-quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: session.cookieHeader },
    body: JSON.stringify({ assignmentId, studentId, answers }),
  })
}

async function mkQuizQuestion(assignmentId: string, correctIndex: number): Promise<string> {
  const { data, error } = await db
    .from('assignment_questions')
    .insert({ assignment_id: assignmentId, question_text: 'Fixture question', choices: ['A', 'B', 'C', 'D'], correct_index: correctIndex, order_index: 0 })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
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
  if (createdSchoolIds.length) {
    const { data: coreLearners } = await db.from('learners').select('id').in('school_id', createdSchoolIds)
    const learnerExternalIds = (coreLearners ?? []).map(l => l.id)
    if (learnerExternalIds.length) {
      const { data: bridgedStudents } = await db.from('students').select('id').in('external_id', learnerExternalIds)
      const studentIds = (bridgedStudents ?? []).map(s => s.id)
      if (studentIds.length) {
        await db.from('assignment_submissions').delete().in('student_id', studentIds)
        // evidence_audit_log / evidence_projection_events FK-reference
        // learner_evidence.id — the quiz-submission tests' fire-and-forget
        // recordQuizAutoGradeEvidence writes both a trail row and a
        // projection-event row alongside each evidence row. Deleting
        // learner_evidence before these two must fail (silently, since the
        // Supabase JS client's delete() error is never checked below) and
        // leaves ingestion_runs — and therefore the owning auth.users row —
        // undeletable at the bottom of this hook. Must run first.
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
        await db.from('assignment_questions').delete().in('assignment_id', (await db.from('assignments').select('id').in('class_id', tcIds)).data?.map(a => a.id) ?? [])
        await db.from('assignments').delete().in('class_id', tcIds)
        await db.from('teacher_classes').delete().in('id', tcIds)
      }
      await db.from('class_subject_legacy_bridge').delete().in('class_subject_id', csIds)
    }
  }
  // Legacy fixture cleanup — direct teacher_classes/students created by
  // mkLegacyClass/mkLegacyStudent (never routed through the institutional
  // bridge, so not covered by the sweep above). teacher_classes cascades to
  // assignments -> assignment_submissions/assignment_questions and to
  // class_students, so deleting it first is sufficient for all of those.
  await db.from('teacher_classes').delete().ilike('name', `${SYNTHETIC_MARKER}%`)
  const { data: legacyStudents } = await db.from('students').select('id').ilike('school', SYNTHETIC_MARKER)
  const legacyStudentIds = (legacyStudents ?? []).map(s => s.id)
  if (legacyStudentIds.length) {
    await db.from('students').delete().in('id', legacyStudentIds)
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
    // Phase 2.5's own quiz-evidence write path (recordQuizAutoGradeEvidence
    // -> createIngestionRun) sets `initiated_by` to the SUBMITTING learner's
    // own auth.users.id (student-triggered, not teacher-marked — see
    // lib/quiz/quizEvidence.ts's header). `ingestion_runs.initiated_by` has
    // no cascade-delete rule (confirmed via pg_constraint locally), unlike
    // `public.users.id`, so it must be cleaned explicitly or auth user
    // deletion fails with a dangling-FK error.
    await db.from('ingestion_runs').delete().eq('initiated_by', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

// ── A / Legacy regression — Solo learner submit paths are untouched ────────

test('LEGACY REGRESSION: Solo/legacy learner can still submit typed work exactly as before', async () => {
  const teacher = await mkLegacyTeacher('1')
  const classId = await mkLegacyClass(teacher.teacherId, '1')
  const learner = await mkLegacyStudent('typed', classId)
  const assignment = await mkLegacyAssignment(classId, teacher.teacherId, [learner.studentId])

  const session = await signInForHttpTest(learner.email, PASSWORD)
  const res = await submitTyped(session, assignment.id, learner.studentId, 'My legacy answer')
  const resText = await res.text()
  assert.equal(res.status, 200, resText)
  const body = JSON.parse(resText)
  assert.equal(body.data.submission.student_id, learner.studentId)
  assert.equal(body.data.submission.status, 'submitted')
})

test('LEGACY REGRESSION: Solo/legacy learner cannot submit another legacy learner\'s assignment', async () => {
  const teacher = await mkLegacyTeacher('2')
  const classId = await mkLegacyClass(teacher.teacherId, '2')
  const owner = await mkLegacyStudent('owner', classId)
  const intruder = await mkLegacyStudent('intruder', classId)
  const assignment = await mkLegacyAssignment(classId, teacher.teacherId, [owner.studentId])

  const intruderSession = await signInForHttpTest(intruder.email, PASSWORD)
  // Forged studentId — intruder claims to be the owner.
  const res = await submitTyped(intruderSession, assignment.id, owner.studentId, 'forged')
  assert.equal(res.status, 403)
  const { data: submission } = await db.from('assignment_submissions').select('status, work_text').eq('assignment_id', assignment.id).eq('student_id', owner.studentId).single()
  assert.equal(submission!.status, 'pending', 'owner\'s submission must be untouched')
  assert.equal(submission!.work_text, null)
})

// ── B/K — institutional wrong-learner + forged studentId ───────────────────

test('institutional: legitimate learner can submit typed work (Phase 2.5 fix)', async () => {
  const teacher = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'inst-teacher-1')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacher.membershipId)
  const csId = await currentClassSubjectId(classA, mathsIdA)
  const { userId, learnerId } = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-TYPED`)
  void learnerId
  const assignment = await mkInstitutionalAssignment(teacher.email, csId, 'Institutional Typed Assignment')

  const session = await httpSessionForUserId(userId)
  // Client sends an arbitrary/absent-authority studentId — server must
  // derive the real one itself (Step 6/10: never trust a client-supplied id).
  const res = await submitTyped(session, assignment.id, '00000000-0000-0000-0000-000000000000', 'Institutional answer')
  const resText = await res.text()
  assert.equal(res.status, 200, resText)
  const body = JSON.parse(resText)
  assert.equal(body.data.submission.status, 'submitted')
  assert.equal(body.data.submission.work_text, 'Institutional answer')

  const { data: compatStudent } = await db.from('learners').select('id').eq('id', learnerId).single()
  void compatStudent
})

test('institutional: WRONG LEARNER cannot submit another institutional learner\'s assignment, even with a forged studentId, and leaves zero mutation', async () => {
  const teacher = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'inst-teacher-2')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacher.membershipId)
  const csId = await currentClassSubjectId(classA, mathsIdA)

  await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-WRONG-OWNER`)
  const assignment = await mkInstitutionalAssignment(teacher.email, csId, 'Owner-only Assignment')
  // Intruder is admitted AFTER this assignment's fan-out already ran — they
  // are never a recipient of it (same rule as the pre-enrolment case), so
  // this is a genuine "never issued to this learner" attack, not merely a
  // second legitimate recipient forging another's id.
  const intruder = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-WRONG-INTRUDER`)

  const { data: ownerCompat } = await db.from('assignment_submissions').select('student_id, status, work_text').eq('assignment_id', assignment.id).limit(1).single()
  const ownerStudentId = ownerCompat!.student_id as string

  const intruderSession = await httpSessionForUserId(intruder.userId)
  // Intruder forges the owner's real compat studentId (looked up server-side, simulating a leaked/guessed id).
  const res = await submitTyped(intruderSession, assignment.id, ownerStudentId, 'forged institutional answer')
  assert.equal(res.status, 403)

  const { data: after_ } = await db.from('assignment_submissions').select('status, work_text').eq('assignment_id', assignment.id).eq('student_id', ownerStudentId).single()
  assert.equal(after_!.status, ownerCompat!.status, 'owner submission status must be unchanged')
  assert.equal(after_!.work_text, null, 'no work_text must have been written by the intruder')
})

// ── D — cross-school ────────────────────────────────────────────────────

test('institutional: CROSS-SCHOOL learner cannot submit another school\'s assignment', async () => {
  const teacherA = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'inst-teacher-crossA')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacherA.membershipId)
  const csA = await currentClassSubjectId(classA, mathsIdA)
  const assignmentA = await mkInstitutionalAssignment(teacherA.email, csA, 'School A Only Assignment')

  const bLearner = await admitAndActivate(schoolB.schoolId, classB, termB, yearB, schoolB.adminSchoolUserId, `${SYNTHETIC_MARKER}-CROSS-B`)
  const bSession = await httpSessionForUserId(bLearner.userId)

  const res = await submitTyped(bSession, assignmentA.id, '00000000-0000-0000-0000-000000000000', 'cross-school attempt')
  assert.equal(res.status, 403)
})

// ── E — pre-enrolment assignment ────────────────────────────────────────

test('institutional: PRE-ENROLMENT assignment (created before learner joined) is not writable', async () => {
  const teacher = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'inst-teacher-preenrol')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacher.membershipId)
  const csId = await currentClassSubjectId(classA, mathsIdA)
  // Assignment created BEFORE the learner is admitted.
  const assignment = await mkInstitutionalAssignment(teacher.email, csId, 'Pre-enrolment Assignment')

  const learner = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-PREENROL`)
  const session = await httpSessionForUserId(learner.userId)

  const res = await submitTyped(session, assignment.id, '00000000-0000-0000-0000-000000000000', 'late attempt')
  assert.equal(res.status, 403)
  // Other, already-enrolled learners in classA (from earlier tests in this
  // shared-fixture file) legitimately DO have submission rows for this
  // assignment — the assertion must be scoped to THIS learner's own compat
  // student, not "zero rows for the assignment at all".
  const { data: bridged } = await db.from('students').select('id').eq('external_id', learner.learnerId).maybeSingle()
  if (bridged) {
    const { data: ownRow } = await db.from('assignment_submissions').select('id').eq('assignment_id', assignment.id).eq('student_id', bridged.id).maybeSingle()
    assert.equal(ownRow, null, 'no submission row should exist for this learner on a pre-enrolment assignment')
  }
})

// ── F/G — historical transfer: old-school submission stays writable, new old-school assignment stays hidden ──

test('institutional: HISTORICAL assignment (issued while enrolled) remains writable after transfer; a NEW old-school assignment issued after transfer is not', async () => {
  const teacherA = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'inst-teacher-transfer')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacherA.membershipId)
  const csA = await currentClassSubjectId(classA, mathsIdA)

  const learner = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-XFER`)
  const historicalAssignment = await mkInstitutionalAssignment(teacherA.email, csA, 'School A Historical Assignment')

  const session = await httpSessionForUserId(learner.userId)

  // Transfer A -> B.
  const transferOut = await transferLearner(schoolA.adminSchoolUserId, {
    learner_id: learner.learnerId, direction: 'out', to_school_id: schoolB.schoolId, to_school_name: 'School B',
    transfer_date: new Date().toISOString().slice(0, 10),
  })
  assert.ok(transferOut.transferToken)
  const admitB = await admitTransferredLearner(
    schoolB.schoolId, schoolB.adminSchoolUserId,
    { admission_number: `${SYNTHETIC_MARKER}-XFER-B`, first_name: 'Test', last_name: 'Learner' },
    transferOut.transferToken!
  )
  assert.equal(admitB.status, 'admitted')
  await enrollLearner({ learner_id: admitB.learner!.id, class_id: classB, term_id: termB, academic_year_id: yearB, school_id: schoolB.schoolId })

  // A NEW assignment issued by the OLD school (A) after the transfer.
  const postTransferAssignment = await mkInstitutionalAssignment(teacherA.email, csA, 'School A Post-Transfer Assignment')

  // Historical (pre-transfer) submission must still be writable.
  const historicalRes = await submitTyped(session, historicalAssignment.id, '00000000-0000-0000-0000-000000000000', 'late historical submission after transfer')
  const historicalResText = await historicalRes.text()
  assert.equal(historicalRes.status, 200, historicalResText)
  const historicalBody = JSON.parse(historicalResText)
  assert.equal(historicalBody.data.submission.status, 'submitted')

  // New post-transfer assignment from the OLD school must remain hidden/unwritable.
  const postRes = await submitTyped(session, postTransferAssignment.id, '00000000-0000-0000-0000-000000000000', 'must be rejected')
  assert.equal(postRes.status, 403)
  // classA is a shared fixture across this file's other tests — other,
  // already-enrolled classA learners legitimately DO get fanned into this
  // new assignment (same caveat as the PRE-ENROLMENT test above), so the
  // assertion must be scoped to THIS transferred-out learner's own
  // school-A compat student, not "zero rows for the assignment at all".
  const { data: bridged } = await db.from('students').select('id').eq('external_id', learner.learnerId).maybeSingle()
  if (bridged) {
    const { data: ownRow } = await db.from('assignment_submissions').select('id').eq('assignment_id', postTransferAssignment.id).eq('student_id', bridged.id).maybeSingle()
    assert.equal(ownRow, null, 'no submission row should exist for the transferred-out learner on a post-transfer old-school assignment')
  }
})

// ── I — teacher replacement ─────────────────────────────────────────────

test('institutional: submission remains possible after the issuing teacher is replaced', async () => {
  const peter = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'inst-peter-repl2')
  const mary = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'inst-mary-repl2')

  const learner = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-REPLACE`)

  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, peter.membershipId)
  const peterCsId = await currentClassSubjectId(classA, mathsIdA)
  const assignment = await mkInstitutionalAssignment(peter.email, peterCsId, 'Peter\'s Assignment (Submission Test)')

  // Replace Peter with Mary.
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, mary.membershipId)

  const session = await httpSessionForUserId(learner.userId)
  const res = await submitTyped(session, assignment.id, '00000000-0000-0000-0000-000000000000', 'submitted after teacher replaced')
  assert.equal(res.status, 200, await res.text())
})

// ── J — multi-school-active learner ─────────────────────────────────────

test('institutional: multi-school-active learner can submit at each school it is legitimately active at, no cross-school collision', async () => {
  const teacherA = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'inst-multi-teacherA')
  const teacherB = await addTeacher(schoolB.schoolId, schoolB.adminUserId, 'inst-multi-teacherB')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacherA.membershipId)
  await assignSubjectTeacher(schoolB.schoolId, classB, mathsIdB, teacherB.membershipId)
  const csA = await currentClassSubjectId(classA, mathsIdA)
  const csB = await currentClassSubjectId(classB, mathsIdB)

  const learnerA = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-MULTI-A`)
  // Same identity, second active enrollment at School B — constructed directly
  // exactly as assignmentDiscovery.integration.test.ts's own multi-school test does.
  const { data: identityRow } = await db.from('learners').select('learner_identity_id').eq('id', learnerA.learnerId).single()
  const onboardB = await onboardLearner(schoolB.schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-MULTI-B`, first_name: 'Test', last_name: 'Learner',
    class_id: classB, term_id: termB, academic_year_id: yearB,
  })
  assert.equal(onboardB.status, 'complete')
  await db.from('learners').update({ learner_identity_id: identityRow!.learner_identity_id }).eq('id', onboardB.learnerId)

  const assignmentA = await mkInstitutionalAssignment(teacherA.email, csA, 'Multi-School A Assignment')
  const assignmentB = await mkInstitutionalAssignment(teacherB.email, csB, 'Multi-School B Assignment')

  const session = await httpSessionForUserId(learnerA.userId)
  const resA = await submitTyped(session, assignmentA.id, '00000000-0000-0000-0000-000000000000', 'answer at school A')
  assert.equal(resA.status, 200, await resA.text())
  const resB = await submitTyped(session, assignmentB.id, '00000000-0000-0000-0000-000000000000', 'answer at school B')
  assert.equal(resB.status, 200, await resB.text())
})

// ── submit-file: institutional ownership + storage safety ──────────────

test('institutional: legitimate learner can submit-file, storage path is scoped to their own compat studentId', async () => {
  const teacher = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'inst-teacher-file')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacher.membershipId)
  const csId = await currentClassSubjectId(classA, mathsIdA)
  const learner = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-FILE`)
  const assignment = await mkInstitutionalAssignment(teacher.email, csId, 'Institutional File Assignment')

  const session = await httpSessionForUserId(learner.userId)
  const res = await submitFile(session, assignment.id, '00000000-0000-0000-0000-000000000000')
  const resText = await res.text()
  assert.equal(res.status, 200, resText)
  const body = JSON.parse(resText)
  assert.equal(body.data.submission.status, 'submitted')
  assert.ok(typeof body.data.submission.file_path === 'string')

  const { data: sub } = await db.from('assignment_submissions').select('student_id, file_path').eq('id', body.data.submission.id).single()
  // The object path's studentId segment must be the server-resolved compat
  // studentId, never any client-supplied value (path shape: assignmentId/studentId/ts.ext).
  assert.ok((sub!.file_path as string).includes(`${assignment.id}/${sub!.student_id}/`))
})

test('institutional: WRONG LEARNER cannot submit-file for another learner\'s assignment, and no Storage object or submission mutation is left behind', async () => {
  const teacher = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'inst-teacher-file-wrong')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacher.membershipId)
  const csId = await currentClassSubjectId(classA, mathsIdA)
  await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-FILE-OWNER`)
  const assignment = await mkInstitutionalAssignment(teacher.email, csId, 'File Owner-only Assignment')
  // Intruder joins AFTER fan-out — genuinely never a recipient of this assignment.
  const intruder = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-FILE-INTRUDER`)

  const intruderSession = await httpSessionForUserId(intruder.userId)
  const { data: ownerCompat } = await db.from('assignment_submissions').select('student_id').eq('assignment_id', assignment.id).limit(1).single()
  const res = await submitFile(intruderSession, assignment.id, ownerCompat!.student_id as string)
  assert.equal(res.status, 403)

  const { data: sub } = await db.from('assignment_submissions').select('status, file_path').eq('assignment_id', assignment.id).eq('student_id', ownerCompat!.student_id as string).single()
  assert.equal(sub!.status, 'pending')
  assert.equal(sub!.file_path, null)
})

// ── submit-quiz: grading + evidence attribution ─────────────────────────

test('institutional: legitimate learner can submit-quiz; grade and quiz_auto_grade evidence attribute to the CORRECT compat studentId', async () => {
  const teacher = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'inst-teacher-quiz')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacher.membershipId)
  const csId = await currentClassSubjectId(classA, mathsIdA)
  const learner = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-QUIZ`)
  const assignment = await mkInstitutionalAssignment(teacher.email, csId, 'Institutional Quiz', { isQuiz: true })
  const questionId = await mkQuizQuestion(assignment.id, 2)

  const session = await httpSessionForUserId(learner.userId)
  const res = await submitQuiz(session, assignment.id, '00000000-0000-0000-0000-000000000000', [{ questionId, selectedIndex: 2 }])
  const resText = await res.text()
  assert.equal(res.status, 200, resText)
  const body = JSON.parse(resText)
  assert.equal(body.data.submission.status, 'marked')
  assert.equal(body.data.grade.score, 100)

  const correctStudentId = body.data.submission.student_id as string

  // Evidence attribution — must be keyed to the caller's own compat
  // students.id (assignment evidence deliberately stays keyed there per
  // CLAUDE.md), never any other value, and there must be exactly one row.
  await new Promise(resolve => setTimeout(resolve, 1500)) // evidence emission is fire-and-forget
  const { data: evidenceRows } = await db
    .from('learner_evidence')
    .select('learner_id, evidence_source, score')
    .eq('learner_id', correctStudentId)
    .eq('evidence_source', 'quiz_auto_grade')
  assert.equal((evidenceRows ?? []).length, 1, 'exactly one quiz_auto_grade evidence row for the correct learner')
  assert.equal(evidenceRows![0].learner_id, correctStudentId)
})

test('institutional: WRONG LEARNER cannot submit-quiz for another learner\'s quiz — zero grading, zero evidence side effects', async () => {
  const teacher = await addTeacher(schoolA.schoolId, schoolA.adminUserId, 'inst-teacher-quiz-wrong')
  await assignSubjectTeacher(schoolA.schoolId, classA, mathsIdA, teacher.membershipId)
  const csId = await currentClassSubjectId(classA, mathsIdA)
  await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-QUIZ-OWNER`)
  const assignment = await mkInstitutionalAssignment(teacher.email, csId, 'Quiz Owner-only', { isQuiz: true })
  const questionId = await mkQuizQuestion(assignment.id, 1)
  // Intruder joins AFTER fan-out — genuinely never a recipient of this quiz.
  const intruder = await admitAndActivate(schoolA.schoolId, classA, termA, yearA, schoolA.adminSchoolUserId, `${SYNTHETIC_MARKER}-QUIZ-INTRUDER`)

  const intruderSession = await httpSessionForUserId(intruder.userId)
  const { data: ownerCompat } = await db.from('assignment_submissions').select('student_id').eq('assignment_id', assignment.id).limit(1).single()
  const res = await submitQuiz(intruderSession, assignment.id, ownerCompat!.student_id as string, [{ questionId, selectedIndex: 1 }])
  assert.equal(res.status, 403)

  const { data: sub } = await db.from('assignment_submissions').select('status, score').eq('assignment_id', assignment.id).eq('student_id', ownerCompat!.student_id as string).single()
  assert.equal(sub!.status, 'pending')
  assert.equal(sub!.score, null)

  await new Promise(resolve => setTimeout(resolve, 1000))
  const { data: evidenceRows } = await db.from('learner_evidence').select('id').eq('learner_id', ownerCompat!.student_id as string).eq('evidence_source', 'quiz_auto_grade')
  assert.equal((evidenceRows ?? []).length, 0, 'no evidence must have been created for the denied attempt')
})
