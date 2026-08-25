// lib/core/institutionalIdentityConvergence.http.integration.test.ts
//
// PHASE 1 — Institutional Identity Convergence.
//
// Phase 0's discovery audit found that Home (/api/student/home) and
// Assignments (/api/student/assignments) already dual-branch across both
// learner identity spaces (legacy `students.id` self/parent link, and the
// institutional Phase 1C compatibility bridge — `students.external_id =
// learners.id`, `students.user_id` permanently NULL), but Compass
// (/api/learn/*) and Career Intelligence (/api/career/*, /api/students/list)
// keyed EXCLUSIVELY on the legacy space. An institutional learner — the
// exact population currently being onboarded — could reach Home and
// Assignments but silently got a 403/empty result from Compass and Career,
// with no error explaining why.
//
// This proves the fix: the SAME institutional learner now reaches all four
// surfaces, through the SAME canonical resolver
// (resolveInstitutionalCompatibilityStudentIds, lib/core/assignmentDiscovery.ts)
// Home/Assignments already trusted — no new resolution pattern invented, no
// identity spaces merged, no `students.id`/`learners.id` renamed.
//
// Requires a server already running at TEST_BASE_URL (default
// http://localhost:3100), pointed at local Docker Supabase — never
// production. Route handlers read the session via `next/headers` cookies()
// (utils/supabase/server.ts), which only resolves inside a real Next.js
// request, so this must run as an HTTP test against a live server, not by
// importing the route handlers directly.
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --experimental-test-module-mocks --test lib/core/institutionalIdentityConvergence.http.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { createClass } from '@/lib/core/classes'
import { listSubjects } from '@/lib/core/subjects'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { issueLearnerAccountActivation, claimLearnerAccountActivation } from '@/lib/core/learnerAccounts'
import { createAssignment } from '@/lib/assignments/create'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3100'
const SYNTHETIC_MARKER = 'SYNTHETIC_P1_IDENTITY_HTTP'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
let createdSchoolId: string | null = null

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

async function mkUser(label: string): Promise<{ id: string; email: string }> {
  const email = `p1identity-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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

/** Real HTTP cookie session for a synthetic institutional learner's auth.users.id — that account is created passwordless, so a password is set purely to obtain a real signed-in session via the same route/cookie machinery a real browser would use. */
async function httpSessionForUserId(userId: string): Promise<SyntheticSession> {
  const { data: updated, error } = await db.auth.admin.updateUserById(userId, { password: PASSWORD })
  if (error || !updated.user?.email) throw new Error(`httpSessionForUserId: failed to set password (${error?.message})`)
  return signInForHttpTest(updated.user.email, PASSWORD)
}

async function mkSchool(label: string): Promise<{ schoolId: string; adminUserId: string; adminSchoolUserId: string }> {
  const admin = await mkUser(`${label}-admin`)
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${label}_${Date.now()}` }, admin.id)
  createdSchoolId = school.id
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')
  const act = await activateSchool(school.id, { gradeCodes: ['G7'] })
  if (act.status !== 'complete') throw new Error(`fixture activation failed (${label}): ${act.error}`)
  const schoolUser = await repos.teachers.findSchoolUser(admin.id, school.id)
  if (!schoolUser) throw new Error('mkSchool: school_users row not found after addSchoolUser')
  return { schoolId: school.id, adminUserId: admin.id, adminSchoolUserId: schoolUser.id }
}

async function addTeacher(schoolId: string, adminUserId: string, label: string): Promise<{ userId: string; email: string }> {
  const user = await mkUser(label)
  await inviteTeacher(schoolId, user.email, adminUserId)
  await acceptTeacherInvitation(user.id, schoolId, { full_name: `${SYNTHETIC_MARKER} ${label}` })
  return { userId: user.id, email: user.email }
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
    admission_number: admissionNumber, first_name: 'Test', last_name: 'Institutional',
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

/** Creates a real institutional assignment for the class — the ONLY thing that materializes a learner's Phase 1C compatibility `students` row and fans out an `assignment_submissions` row to them (assignmentDiscovery.ts's documented eligibility signal). Without this, an institutional learner has no compatibility student at all yet — a genuine, separately-documented state (Step 13), not what this test is proving. */
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

/** A minimal legacy/Solo learner — real `students.user_id`, never a compatibility row — for the regression side of the test matrix. */
async function mkLegacyStudent(label: string): Promise<{ userId: string; studentId: string; email: string }> {
  const user = await mkUser(`legacy-${label}`)
  const { data: student, error } = await db
    .from('students')
    .insert({ user_id: user.id, name: `${SYNTHETIC_MARKER} Legacy ${label}`, school: SYNTHETIC_MARKER, grade: 7, level: 'Junior School' })
    .select('id')
    .single()
  if (error) throw error
  return { userId: user.id, studentId: student.id as string, email: user.email }
}

async function getJson(session: SyntheticSession, path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Cookie: session.cookieHeader } })
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

let school: Awaited<ReturnType<typeof mkSchool>>
let classId: string
let termId: string
let academicYearId: string
let mathsId: string
let teacherEmail: string
let learnerA: { learnerId: string; userId: string }
let learnerB: { learnerId: string; userId: string }
let compatStudentIdA: string
let compatStudentIdB: string

before(async () => {
  school = await mkSchool('A')

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
  mathsId = subjects.find(s => s.name === 'Mathematics')!.id

  const teacher = await addTeacher(school.schoolId, school.adminUserId, 'teacher-1')
  teacherEmail = teacher.email

  learnerA = await admitAndActivate(school.schoolId, classId, termId, academicYearId, school.adminSchoolUserId, `${SYNTHETIC_MARKER}-A`)
  learnerB = await admitAndActivate(school.schoolId, classId, termId, academicYearId, school.adminSchoolUserId, `${SYNTHETIC_MARKER}-B`)

  const classSubjectId = await currentClassSubjectId(classId, mathsId)
  // One assignment is enough to bridge BOTH learners on this roster —
  // fanOutPendingSubmissions fans out to the whole current class roster.
  await mkInstitutionalAssignment(teacherEmail, classSubjectId, `${SYNTHETIC_MARKER} Assignment`)

  const { data: bridgedA } = await db.from('students').select('id').eq('external_id', learnerA.learnerId).maybeSingle()
  const { data: bridgedB } = await db.from('students').select('id').eq('external_id', learnerB.learnerId).maybeSingle()
  if (!bridgedA || !bridgedB) throw new Error('fixture: compatibility student bridge was not created for one or both learners')
  compatStudentIdA = bridgedA.id as string
  compatStudentIdB = bridgedB.id as string
})

after(async () => {
  if (createdSchoolId) {
    const { data: coreLearners } = await db.from('learners').select('id').eq('school_id', createdSchoolId)
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
    const { data: classSubjectRows } = await db.from('class_subjects').select('id').eq('school_id', createdSchoolId)
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

  const { data: legacyStudents } = await db.from('students').select('id').ilike('school', SYNTHETIC_MARKER)
  const legacyStudentIds = (legacyStudents ?? []).map(s => s.id)
  if (legacyStudentIds.length) await db.from('students').delete().in('id', legacyStudentIds)

  if (createdSchoolId) {
    const { data: learnerRows } = await db.from('learners').select('id, learner_identity_id').eq('school_id', createdSchoolId)
    const learnerIds = (learnerRows ?? []).map(l => l.id)
    const identityIds = [...new Set((learnerRows ?? []).map(l => l.learner_identity_id).filter(Boolean))]
    if (learnerIds.length) {
      await db.from('learner_enrollments').delete().in('learner_id', learnerIds)
      await db.from('learners').delete().in('id', learnerIds)
    }
    if (identityIds.length) {
      await db.from('learner_accounts').delete().in('learner_identity_id', identityIds as string[])
      await db.from('learner_identities').delete().in('id', identityIds as string[])
    }
    await db.from('classes').delete().eq('school_id', createdSchoolId)
    await db.from('school_users').delete().eq('school_id', createdSchoolId)
    await db.from('schools').delete().eq('id', createdSchoolId)
  }

  for (const id of createdAuthUserIds) {
    try { await deleteAuthUserOrThrow(db, id) } catch { /* best-effort — a leaked synthetic auth user is a known, tolerated residual for this test family */ }
  }
})

// ── Institutional learner: Home + Assignments (baseline, already fixed pre-Phase-1) ──

test('institutional learner: Home resolves via the compatibility bridge', async () => {
  const session = await httpSessionForUserId(learnerA.userId)
  const { status, body } = await getJson(session, '/api/student/home')
  assert.equal(status, 200)
  assert.equal((body as { data: { student: { id: string } } }).data.student.id, compatStudentIdA)
})

test('institutional learner: Assignments resolves via the compatibility bridge', async () => {
  const session = await httpSessionForUserId(learnerA.userId)
  const { status, body } = await getJson(session, '/api/student/assignments')
  assert.equal(status, 200)
  const assignments = (body as { data: unknown[] }).data
  assert.ok(Array.isArray(assignments) && assignments.length > 0, 'expected at least one fanned-out assignment')
})

// ── Phase 1 fix: institutional learner now reaches Compass + Career Intelligence ──

test('institutional learner: /api/students/list now resolves the compatibility student (Career entry point)', async () => {
  const session = await httpSessionForUserId(learnerA.userId)
  const { status, body } = await getJson(session, '/api/students/list')
  assert.equal(status, 200)
  const students = (body as { data: { students: Array<{ id: string }> } }).data.students
  assert.ok(students.some(s => s.id === compatStudentIdA), 'expected the compatibility student in the list')
})

test('institutional learner: Compass auto-select (/api/learn/student, no studentId) now resolves the compatibility student', async () => {
  const session = await httpSessionForUserId(learnerA.userId)
  const { status, body } = await getJson(session, '/api/learn/student')
  assert.equal(status, 200)
  assert.equal((body as { data: { id: string } }).data.id, compatStudentIdA)
})

test('institutional learner: Compass explicit studentId (/api/learn/student?studentId=) is authorized via the institutional bridge', async () => {
  const session = await httpSessionForUserId(learnerA.userId)
  const { status } = await getJson(session, `/api/learn/student?studentId=${compatStudentIdA}`)
  assert.equal(status, 200)
})

test('institutional learner: Career Intelligence (/api/career/match) is authorized via the institutional bridge', async () => {
  const session = await httpSessionForUserId(learnerA.userId)
  const { status } = await getJson(session, `/api/career/match?studentId=${compatStudentIdA}`)
  assert.equal(status, 200)
})

test('institutional learner: /api/career/capability-matches is authorized via the institutional bridge', async () => {
  const session = await httpSessionForUserId(learnerA.userId)
  const { status, body } = await getJson(session, `/api/career/capability-matches?studentId=${compatStudentIdA}`)
  // 200 (matches) or 400 "no evidence yet" are both a correctly-AUTHORIZED
  // response — the pre-fix failure mode was 403, proven absent here either way.
  assert.notEqual(status, 403)
  if (status === 400) {
    assert.match(String((body as { error?: string }).error ?? ''), /evidence/i)
  } else {
    assert.equal(status, 200)
  }
})

// ── Identity boundary: institutional learner A cannot reach learner B's data ──

test('institutional learner A cannot authorize against institutional learner B\'s compatibility studentId (Compass)', async () => {
  const session = await httpSessionForUserId(learnerA.userId)
  const { status } = await getJson(session, `/api/learn/student?studentId=${compatStudentIdB}`)
  assert.equal(status, 403)
})

test('institutional learner A cannot authorize against institutional learner B\'s compatibility studentId (Career)', async () => {
  const session = await httpSessionForUserId(learnerA.userId)
  const { status } = await getJson(session, `/api/career/match?studentId=${compatStudentIdB}`)
  assert.equal(status, 403)
})

// ── Legacy/Solo learner regression — unchanged code path, must still work ──

test('legacy/Solo learner: Compass and Career Intelligence still work unchanged', async () => {
  const legacy = await mkLegacyStudent('regression')
  try {
    const session = await httpSessionForUserId(legacy.userId)

    const list = await getJson(session, '/api/students/list')
    assert.equal(list.status, 200)
    assert.equal((list.body as { data: { students: Array<{ id: string }> } }).data.students[0]?.id, legacy.studentId)

    const compass = await getJson(session, '/api/learn/student')
    assert.equal(compass.status, 200)
    assert.equal((compass.body as { data: { id: string } }).data.id, legacy.studentId)

    const career = await getJson(session, `/api/career/match?studentId=${legacy.studentId}`)
    assert.equal(career.status, 200)
  } finally {
    await db.from('students').delete().eq('id', legacy.studentId)
  }
})
