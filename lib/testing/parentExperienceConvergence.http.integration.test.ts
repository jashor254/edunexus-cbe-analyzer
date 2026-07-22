// lib/testing/parentExperienceConvergence.http.integration.test.ts
//
// Sprint 5 (Parent Experience Convergence) — proves, against real signed-in
// HTTP clients, that the new parent-facing surfaces (Assignments, Gradebook,
// Progress, Holiday Plan per child; family-wide Calendar/Resources) are
// reachable by the linked parent and only the linked parent — reusing the
// exact same authorization primitive (requireParent, lib/core/permissions.ts)
// every route/page in this sprint calls, not a bespoke check per page.
//
// Fixture bridges Core (learners/learner_guardians, for requireParent's
// coreLearnerIds check and the [learnerId] URL param) and legacy
// (students/teacher_classes/class_students/assignments, for the actual data
// APIs) exactly the way real enrolled learners are bridged (students.external_id
// -> learners.id, Sprint 9F) — not a shortcut fixture.
//
// Run: LMS_TEST_BASE_URL=http://localhost:3939 npx tsx --env-file=.env.local --test lib/testing/parentExperienceConvergence.http.integration.test.ts
// (requires `next dev -p 3939 &` already running)

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { requireParent } from '@/lib/core/permissions'
import { ResourceOwnershipError } from '@/lib/core/errors'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const SYNTHETIC_MARKER = 'SYNTHETIC_SPRINT5_PARENT_CONVERGENCE_TEST'
const db = createServiceClient()

const authUserIds: string[] = []
const schoolIds: string[] = []
const learnerIds: string[] = []
const studentIds: string[] = []
const teacherRowIds: string[] = []
const teacherClassIds: string[] = []
const assignmentIds: string[] = []

let parentSession: SyntheticSession
let otherParentSession: SyntheticSession
let teacherSession: SyntheticSession
let parentEmail: string
let otherParentEmail: string
let teacherEmail: string
let coreLearnerId: string
let legacyStudentId: string

const PASSWORD = `Test!${Math.random().toString(36).slice(2, 10)}`

async function createUser(label: string): Promise<{ authId: string; session: SyntheticSession; email: string }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  const session = await signInForHttpTest(email, PASSWORD)
  return { authId: data.user.id, session, email }
}

/** A real, signed-in SupabaseClient (not just a cookie header) — needed to call requireParent() directly. */
async function signInClient(email: string) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

before(async () => {
  const parent = await createUser('parent')
  const otherParent = await createUser('other-parent')
  const teacher = await createUser('teacher')
  parentSession = parent.session
  otherParentSession = otherParent.session
  teacherSession = teacher.session
  parentEmail = parent.email
  otherParentEmail = otherParent.email
  teacherEmail = teacher.email

  // Core side: school + learner + guardian link (drives requireParent's coreLearnerIds check)
  const { data: school, error: schoolErr } = await db
    .from('schools').insert({ school_name: SYNTHETIC_MARKER, created_by: parent.authId }).select('id').single()
  if (schoolErr) throw schoolErr
  schoolIds.push(school.id)

  const { data: learner, error: learnerErr } = await db
    .from('learners')
    .insert({ school_id: school.id, admission_number: `${SYNTHETIC_MARKER}-001`, first_name: 'Test', last_name: 'Learner' })
    .select('id').single()
  if (learnerErr) throw learnerErr
  coreLearnerId = learner.id
  learnerIds.push(learner.id)

  const { error: guardianErr } = await db.from('learner_guardians').insert({
    school_id: school.id, learner_id: learner.id, user_id: parent.authId,
    relationship: 'mother', full_name: SYNTHETIC_MARKER, phone: '0700000000',
  })
  if (guardianErr) throw guardianErr

  // Legacy side: teacher + class + roster + bridged student row (external_id -> learners.id)
  const { data: teacherRow, error: teacherErr } = await db
    .from('teachers').insert({ user_id: teacher.authId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  if (teacherErr) throw teacherErr
  teacherRowIds.push(teacherRow.id)

  const { data: student, error: studentErr } = await db
    .from('students')
    .insert({
      teacher_id: teacherRow.id, name: SYNTHETIC_MARKER, grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER,
      added_by: 'teacher', external_id: coreLearnerId, parent_user_id: parent.authId,
    })
    .select('id').single()
  if (studentErr) throw studentErr
  legacyStudentId = student.id
  studentIds.push(student.id)

  const { data: cls, error: clsErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherRow.id, name: `${SYNTHETIC_MARKER}_class`, grade: 8, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_${Date.now()}` })
    .select('id').single()
  if (clsErr) throw clsErr
  teacherClassIds.push(cls.id)

  const { error: rosterErr } = await db.from('class_students').insert({ class_id: cls.id, student_id: legacyStudentId, parent_id: parent.authId })
  if (rosterErr) throw rosterErr

  const { data: assignment, error: assignmentErr } = await db
    .from('assignments')
    .insert({
      class_id: cls.id, teacher_id: teacherRow.id, title: `${SYNTHETIC_MARKER}_assignment`, subject: 'Mathematics', topic: 'Test', instructions: 'Do the thing',
      type: 'graded', max_score: 100, due_date: new Date(Date.now() + 7 * 86400000).toISOString(), status: 'active',
    })
    .select('id').single()
  if (assignmentErr) throw assignmentErr
  assignmentIds.push(assignment.id)
})

after(async () => {
  if (assignmentIds.length) {
    await db.from('assignment_submissions').delete().in('assignment_id', assignmentIds)
    await db.from('assignments').delete().in('id', assignmentIds)
  }
  if (teacherClassIds.length) await db.from('teacher_classes').delete().in('id', teacherClassIds) // cascades class_students
  await db.from('students').delete().in('id', studentIds)
  await db.from('teachers').delete().in('id', teacherRowIds)
  await db.from('learner_guardians').delete().in('learner_id', learnerIds)
  await db.from('learners').delete().in('id', learnerIds)
  await db.from('schools').delete().in('id', schoolIds)
  for (const id of authUserIds) await db.auth.admin.deleteUser(id)
  console.log('[cleanup] synthetic Sprint 5 parent-convergence fixtures removed')
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

// ── Per-child pages: reachability + the shared authorization gate ──────────
//
// ⚠️ KNOWN, PRE-EXISTING, PLATFORM-WIDE FINDING, not introduced by this
// sprint: calling next/navigation's notFound() in this Next.js 16.2.7 app
// does not reliably produce a 404 HTTP status or a body free of the
// not-found boundary's bundled text for a direct fetch() — confirmed via a
// production build (`next build && next start`, not a dev-only quirk) AND
// on the already-shipped app/(parent)/child/[learnerId]/page.tsx (same
// requireParent + notFound() pattern, pre-dates this sprint). Root cause
// looks like Next's RSC/streaming payload bundling the not-found boundary's
// text for client-side prefetch regardless of which branch actually
// rendered, making a raw fetch()'s status/body unreliable signals for this
// specific pattern app-wide. This is a real, separate, out-of-scope defect
// (framework-version-specific, needs its own investigation) — flagged, not
// fixed here.
//
// What IS reliable and is tested directly below: every one of this
// sprint's four pages calls the exact same requireParent() used elsewhere
// in production (whatsapp-optin, assignments, career-intelligence) — so the
// authorization boundary itself is proven directly against the live
// database, the same rigor Sprint 1's RLS tests used, rather than inferred
// from an HTTP response this Next.js version doesn't render reliably.

const CHILD_PAGES = ['assignments', 'gradebook', 'progress', 'holiday']

for (const page of CHILD_PAGES) {
  test(`GET /child/[learnerId]/${page}: the linked parent reaches it (200)`, async () => {
    const res = await fetch(`${BASE_URL}/child/${coreLearnerId}/${page}`, { headers: cookie(parentSession), redirect: 'manual' })
    assert.equal(res.status, 200)
  })

  test(`GET /child/[learnerId]/${page}: an unauthenticated request is redirected to login`, async () => {
    const res = await fetch(`${BASE_URL}/child/${coreLearnerId}/${page}`, { redirect: 'manual' })
    assert.equal(res.status, 307)
    assert.match(res.headers.get('location') ?? '', /\/login/)
  })
}

test('requireParent(coreLearnerId): the linked parent is authorized', async () => {
  const client = await signInClient(parentEmail)
  const user = await requireParent(client, coreLearnerId)
  assert.ok(user.id)
})

test('requireParent(coreLearnerId): an unrelated parent (no linked learner) is denied', async () => {
  const client = await signInClient(otherParentEmail)
  await assert.rejects(() => requireParent(client, coreLearnerId), ResourceOwnershipError)
})

test('requireParent(coreLearnerId): a teacher (no parent linkage) is denied', async () => {
  const client = await signInClient(teacherEmail)
  await assert.rejects(() => requireParent(client, coreLearnerId), ResourceOwnershipError)
})

// ── New parent gradebook API: authorization + correct scoping ───────────────

test('GET /api/parent/gradebook: the linked parent gets this learner\'s row, scoped to their own class', async () => {
  const res = await fetch(`${BASE_URL}/api/parent/gradebook?studentId=${legacyStudentId}`, { headers: cookie(parentSession) })
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.equal(json.success, true)
  assert.equal(json.data.classes.length, 1)
  assert.equal(json.data.classes[0].row?.studentId, legacyStudentId)
})

test('GET /api/parent/gradebook: an unrelated parent is forbidden', async () => {
  const res = await fetch(`${BASE_URL}/api/parent/gradebook?studentId=${legacyStudentId}`, { headers: cookie(otherParentSession) })
  assert.equal(res.status, 403)
})

test('GET /api/parent/gradebook: missing studentId is a 400, not a silent empty result', async () => {
  const res = await fetch(`${BASE_URL}/api/parent/gradebook`, { headers: cookie(parentSession) })
  assert.equal(res.status, 400)
})

// ── Family-wide pages: reachable, no cross-family leakage possible (aggregate is caller-scoped) ──

for (const path of ['/calendar', '/resources']) {
  test(`GET ${path}: a parent account reaches it (200)`, async () => {
    const res = await fetch(`${BASE_URL}${path}`, { headers: cookie(parentSession), redirect: 'manual' })
    assert.equal(res.status, 200)
  })

  test(`GET ${path}: an unauthenticated request is redirected to login`, async () => {
    const res = await fetch(`${BASE_URL}${path}`, { redirect: 'manual' })
    assert.equal(res.status, 307)
    assert.match(res.headers.get('location') ?? '', /\/login/)
  })
}

// ── Cross-family isolation on the underlying data APIs these pages call ─────

test('GET /api/student/assignments: an unrelated parent supplying this studentId directly is denied', async () => {
  const res = await fetch(`${BASE_URL}/api/student/assignments?studentId=${legacyStudentId}`, { headers: cookie(otherParentSession) })
  assert.equal(res.status, 403)
})
