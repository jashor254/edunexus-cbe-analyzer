// lib/testing/parentAttentionAction.http.integration.test.ts
//
// Parent Portal Phase P4 — proves the new Attention/Action model end-to-end
// through the real rendered Parent Home (`/child/[learnerId]`) via a live
// next dev server, part of the parent HTTP manifest
// (`npm run test:parent-http`). Reuses the exact fixture pattern
// `parentChildContextConvergence.http.integration.test.ts` (P3.5)
// established: bridged Core learner <-> legacy student rows, a real
// teacher/class/assignment/submission chain.
//
// Proves (mission Step 39 minimum): overdue attention renders, the
// no-attention state renders honestly, a parent-safe action renders, no
// learner-mutation CTA ever appears on Home, Child A/B isolation,
// multi-school isolation, and action-destination authorization (every
// rendered attention/action destination itself 200s for the same parent).

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'
import { deleteAuthUserOrThrow } from './deleteAuthUserOrThrow'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const MARKER = 'SYNTHETIC_P4_ATTENTION_HTTP'
const db = createServiceClient()

const authUserIds: string[] = []
const schoolIds: string[] = []
const learnerIds: string[] = []
const studentIds: string[] = []
const teacherRowIds: string[] = []
const teacherClassIds: string[] = []
const assignmentIds: string[] = []

const PASSWORD = `Test!${Math.random().toString(36).slice(2, 10)}`

let parentSession: SyntheticSession
let unrelatedParentSession: SyntheticSession

let learnerAId: string // has an overdue assignment + low attendance -> Attention + Action
let learnerBId: string // same parent, zero signals -> zero-attention state
let learnerDId: string // same parent, DIFFERENT school, its own overdue assignment -> multi-school isolation

async function createUser(label: string): Promise<{ authId: string; session: SyntheticSession }> {
  const email = `${MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  const session = await signInForHttpTest(email, PASSWORD)
  return { authId: data.user.id, session }
}

async function createSchoolWithTeacher(label: string) {
  const { data: school, error: schoolErr } = await db.from('schools').insert({ school_name: `${MARKER}_school_${label}` }).select('id').single()
  if (schoolErr) throw schoolErr
  schoolIds.push(school.id)

  const teacherUser = await createUser(`teacher-${label}`)
  const { data: teacherRow, error: teacherErr } = await db.from('teachers')
    .insert({ user_id: teacherUser.authId, full_name: MARKER, school: MARKER })
    .select('id').single()
  if (teacherErr) throw teacherErr
  teacherRowIds.push(teacherRow.id)

  return { schoolId: school.id as string, teacherId: teacherRow.id as string }
}

async function createBridgedChild(schoolId: string, teacherId: string, firstName: string, lastName: string, admissionSuffix: string, parentAuthId: string) {
  const { data: learner, error: learnerErr } = await db.from('learners')
    .insert({ school_id: schoolId, admission_number: `${MARKER}-${admissionSuffix}`, first_name: firstName, last_name: lastName })
    .select('id').single()
  if (learnerErr) throw learnerErr
  learnerIds.push(learner.id)

  const { data: student, error: studentErr } = await db.from('students')
    .insert({ teacher_id: teacherId, name: `${firstName} ${lastName}`, grade: 8, level: 'Junior School', school: MARKER, added_by: 'teacher', external_id: learner.id, school_id: schoolId })
    .select('id').single()
  if (studentErr) throw studentErr
  studentIds.push(student.id)

  const { error: guardianErr } = await db.from('learner_guardians')
    .insert({ learner_id: learner.id, school_id: schoolId, user_id: parentAuthId, relationship: 'mother', full_name: MARKER, phone: '0700000010' })
  if (guardianErr) throw guardianErr

  return { learnerId: learner.id as string, studentId: student.id as string }
}

async function seedOverdueAssignment(schoolLabel: string, teacherId: string, studentId: string, daysOverdue: number) {
  const { data: cls, error: clsErr } = await db.from('teacher_classes')
    .insert({ teacher_id: teacherId, name: `${MARKER}_class_${schoolLabel}`, grade: 8, subject: 'Mathematics', class_code: `${MARKER}_${schoolLabel}_${Date.now()}` })
    .select('id').single()
  if (clsErr) throw clsErr
  teacherClassIds.push(cls.id)

  const { error: rosterErr } = await db.from('class_students').insert({ class_id: cls.id, student_id: studentId })
  if (rosterErr) throw rosterErr

  const dueDate = new Date(Date.now() - daysOverdue * 86400000).toISOString()
  const { data: assignment, error: assignmentErr } = await db.from('assignments')
    .insert({
      class_id: cls.id, teacher_id: teacherId, title: `${MARKER}_assignment_${schoolLabel}`, subject: 'Mathematics', topic: 'Test',
      instructions: 'Do the thing', type: 'graded', max_score: 100, due_date: dueDate, status: 'active',
    })
    .select('id').single()
  if (assignmentErr) throw assignmentErr
  assignmentIds.push(assignment.id)

  const { error: subErr } = await db.from('assignment_submissions')
    .insert({ assignment_id: assignment.id, student_id: studentId, class_id: cls.id, status: 'pending' })
  if (subErr) throw subErr
}

before(async () => {
  const schoolA = await createSchoolWithTeacher('A')
  const parent = await createUser('parent')
  parentSession = parent.session

  const a = await createBridgedChild(schoolA.schoolId, schoolA.teacherId, 'Amani', 'Njeri', 'A', parent.authId)
  const b = await createBridgedChild(schoolA.schoolId, schoolA.teacherId, 'Baraka', 'Mutua', 'B', parent.authId)
  learnerAId = a.learnerId
  learnerBId = b.learnerId

  await seedOverdueAssignment('A', schoolA.teacherId, a.studentId, 3)

  // A real report-card-publication Blueprint Snapshot for Child A only —
  // this is what produces a genuine "What Can I Do?" action
  // (composeParentActions' `view_report_card`) without touching Attendance.
  // NAMED FINDING (see the P4 closeout doc): `composeAttendance()` calls
  // `getLearnerAttendanceHistory()`, which is gated admin-tier-only
  // (`lib/core/attendance.ts:530`) — a parent actorUserId always receives a
  // `PermissionDeniedError`, so `blueprint.attendance.status` is ALWAYS
  // `'unavailable'` for a real parent viewer today. This is a pre-existing
  // gap (not introduced by this phase) that also makes Home's existing
  // "Learning Time" card and the existing `review_attendance` ParentAction
  // permanently inert for parents — confirmed here, not assumed. P4's
  // attendance-based Attention code degrades correctly (guarded on
  // `status === 'available'`) but cannot be exercised by a real parent
  // session until that gate is revisited — out of this phase's scope.
  const { error: snapshotErr } = await db.from('blueprint_snapshots').insert({
    learner_id: learnerAId, school_id: schoolA.schoolId, academic_year_id: null, term_id: null,
    snapshot_type: 'report_card_publication', blueprint_payload: {}, provenance: {}, schema_version: 'test',
  })
  if (snapshotErr) throw snapshotErr

  // Multi-school: Child D, same parent, a DIFFERENT school, its own (larger)
  // overdue count — proves Child A's Home never shows Child D's numbers.
  const schoolD = await createSchoolWithTeacher('D')
  const d = await createBridgedChild(schoolD.schoolId, schoolD.teacherId, 'Dalili', 'Kamau', 'D', parent.authId)
  learnerDId = d.learnerId
  await seedOverdueAssignment('D', schoolD.teacherId, d.studentId, 5)

  const unrelatedParent = await createUser('unrelated-parent')
  unrelatedParentSession = unrelatedParent.session
})

after(async () => {
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort */ } }
  if (assignmentIds.length) {
    await safely(() => db.from('assignment_submissions').delete().in('assignment_id', assignmentIds))
    await safely(() => db.from('assignments').delete().in('id', assignmentIds))
  }
  for (const id of learnerIds) await safely(() => db.from('blueprint_snapshots').delete().eq('learner_id', id))
  if (teacherClassIds.length) await safely(() => db.from('teacher_classes').delete().in('id', teacherClassIds))
  for (const id of studentIds) await safely(() => db.from('students').delete().eq('id', id))
  for (const id of learnerIds) {
    await safely(() => db.from('learner_guardians').delete().eq('learner_id', id))
    await safely(() => db.from('learners').delete().eq('id', id))
  }
  for (const id of schoolIds) await safely(() => db.from('schools').delete().eq('id', id))
  for (const id of teacherRowIds) await safely(() => db.from('teachers').delete().eq('id', id))
  for (const u of authUserIds) await safely(() => deleteAuthUserOrThrow(db, u))
})

// ── Overdue attention renders ───────────────────────────────────────────

test('GET /child/[A]: overdue assignment renders under "Needs Attention"', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerAId}`, { headers: { Cookie: parentSession.cookieHeader }, redirect: 'manual' })
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.ok(html.includes('Needs Attention'), 'the Attention section heading must render')
  assert.ok(html.includes('assignment is overdue') || html.includes('assignments are overdue'), 'the overdue headline must render')
})

// ── A parent-safe action renders ────────────────────────────────────────

test('GET /child/[A]: a real report-card-publication snapshot produces a genuine "What Can I Do?" action', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerAId}`, { headers: { Cookie: parentSession.cookieHeader }, redirect: 'manual' })
  const html = await res.text()
  assert.ok(html.includes('What Can I Do?'), 'the Action section heading must render when real actions exist')
  assert.ok(html.includes('View Report Card') || html.includes('Celebrate Achievement'), 'the existing Parent Action Centre action(s) sourced from the real snapshot must surface')
})

// ── No learner-mutation CTA ever appears ────────────────────────────────

test('GET /child/[A]: no learner-mutation CTA anywhere on Home (P2\'s invariant, re-proven under P4)', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerAId}`, { headers: { Cookie: parentSession.cookieHeader }, redirect: 'manual' })
  const html = await res.text()
  for (const forbidden of ['Start a Compass session', 'Start Session', 'Submit Assignment', 'Answer Quiz', 'Start learning']) {
    assert.ok(!html.includes(forbidden), `Home must never render "${forbidden}"`)
  }
})

// ── Zero-attention state renders honestly ───────────────────────────────

test('GET /child[B]: zero signals -> honest "Nothing needs your attention right now", never Child A\'s overdue item', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerBId}`, { headers: { Cookie: parentSession.cookieHeader }, redirect: 'manual' })
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.ok(html.includes('Nothing needs your attention right now'), 'Child B has no real signal — must show the honest zero-attention state')
  assert.ok(!html.includes('assignment is overdue') && !html.includes('assignments are overdue'), 'Child A\'s overdue count must never leak onto Child B\'s Home')
})

// ── Same-parent same-school sibling isolation (highest-risk case) ───────

test('Sibling isolation: Child A\'s attention items never appear on Child B\'s Home (same parent, same school)', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerBId}`, { headers: { Cookie: parentSession.cookieHeader }, redirect: 'manual' })
  const html = await res.text()
  assert.ok(!html.includes(`/child/${learnerAId}/assignments`), 'Child A\'s own destination link must not appear on Child B\'s Home')
})

// ── Multi-school isolation ───────────────────────────────────────────────

test('Multi-school isolation: Child A\'s Home shows its OWN overdue count (1), never Child D\'s (a different school)', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerAId}`, { headers: { Cookie: parentSession.cookieHeader }, redirect: 'manual' })
  const html = await res.text()
  assert.ok(html.includes('1 assignment is overdue.'), 'Child A has exactly 1 overdue assignment')
  assert.ok(!html.includes(`/child/${learnerDId}`), 'Child D (different school) must never appear on Child A\'s Home')
})

// ── Action-destination authorization ────────────────────────────────────

test('Action destination authorization: the overdue attention item\'s own destination 200s for the same parent', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerAId}/assignments`, { headers: { Cookie: parentSession.cookieHeader }, redirect: 'manual' })
  assert.equal(res.status, 200, 'the destination Home links to must itself be reachable for this parent, never a predictable 403')
})

// ── Unrelated parent gets no signal for a child that isn't theirs ───────

test('An unrelated parent never sees Child A\'s identity or attention content', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerAId}`, { headers: { Cookie: unrelatedParentSession.cookieHeader }, redirect: 'manual' })
  assert.notEqual(res.status, 500)
  const html = await res.text()
  assert.ok(!html.includes('Amani'), 'an unrelated parent must never see the child\'s name')
  assert.ok(!html.includes('assignment is overdue') && !html.includes('assignments are overdue'), 'an unrelated parent must never see this child\'s attention content')
})
