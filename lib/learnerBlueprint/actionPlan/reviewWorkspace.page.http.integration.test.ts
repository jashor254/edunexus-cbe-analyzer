// lib/learnerBlueprint/actionPlan/reviewWorkspace.page.http.integration.test.ts
//
// Phase 2E — HTTP-level proof of the actual page
// (app/teacher/learners/[learnerId]/blueprint/review/page.tsx), over a
// real running `next dev` server. The underlying read model's
// authorization matrix is exhaustively covered at the lib level in
// reviewWorkspace.integration.test.ts (no server required there) — this
// file proves the page itself wires that matrix correctly into real HTTP
// responses (redirect/permission-denied/200), which no prior phase in this
// codebase had a test precedent for (this repo has no other page-level
// HTTP test), so it's added deliberately rather than assumed safe.
//
// Requires a server already running at LMS_TEST_BASE_URL (default
// http://localhost:3939).
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --test lib/learnerBlueprint/actionPlan/reviewWorkspace.page.http.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'
import { EVIDENCE_BASIS_EMPTY } from './types'
import { asLearnerId } from '@/lib/core/identityTypes'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const SYNTHETIC_MARKER = 'SYNTHETIC_BLUEPRINT_REVIEW_WORKSPACE_PAGE_HTTP_TEST'
const db = createServiceClient()

let schoolId: string
let coreLearnerId: string, legacyStudentId: string
let classId: string, teacherId: string
let teacherAuthId: string, teacherSession: SyntheticSession
let unrelatedTeacherAuthId: string, unrelatedTeacherSession: SyntheticSession
let parentAuthId: string, parentSession: SyntheticSession

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

async function createSyntheticUser(label: string) {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data } = await retryAsync(async () => {
    const res = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (res.error) throw res.error
    return res
  })
  const session = await retryAsync(() => signInForHttpTest(email, password))
  return { authId: data.user.id, session }
}

before(async () => {
  const teacher = await createSyntheticUser('teacher')
  teacherAuthId = teacher.authId; teacherSession = teacher.session
  const unrelatedTeacher = await createSyntheticUser('unrelated-teacher')
  unrelatedTeacherAuthId = unrelatedTeacher.authId; unrelatedTeacherSession = unrelatedTeacher.session
  const parent = await createSyntheticUser('parent')
  parentAuthId = parent.authId; parentSession = parent.session

  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, teacherAuthId)
  schoolId = school.id
  await db.from('school_users').insert([
    { school_id: schoolId, user_id: teacherAuthId, role: 'teacher', is_active: true },
    { school_id: schoolId, user_id: unrelatedTeacherAuthId, role: 'teacher', is_active: true },
    { school_id: schoolId, user_id: parentAuthId, role: 'parent', is_active: true },
  ])

  const { data: teacherRow } = await db.from('teachers')
    .insert({ user_id: teacherAuthId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherId = teacherRow!.id

  // app/teacher/layout.tsx gates every /teacher/** page on getUserRoles()
  // (profiles.role / a `teachers` row), NOT on `school_users.role` alone —
  // a `school_users` "teacher" row with no `teachers` row falls through to
  // that layout's own "/teacher/setup" allowance and never reaches this
  // page's own authorization at all. The unrelated teacher needs a real
  // `teachers` row so the request actually reaches
  // listReviewableBlueprintActionsForLearner()'s ResourceOwnershipError —
  // otherwise this test would silently prove nothing.
  await db.from('teachers').insert({ user_id: unrelatedTeacherAuthId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })

  const { data: classRow } = await db.from('teacher_classes')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'English', class_code: `SYNTH-${Date.now()}-PG` })
    .select('id').single()
  classId = classRow!.id

  const { data: learnerRow } = await db.from('learners')
    .insert({ school_id: schoolId, admission_number: `${SYNTHETIC_MARKER}-001`, first_name: 'Amani', last_name: 'PageTest' })
    .select('id').single()
  coreLearnerId = learnerRow!.id

  const { data: studentRow } = await db.from('students')
    .insert({ name: 'Amani PageTest', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', external_id: coreLearnerId })
    .select('id').single()
  legacyStudentId = studentRow!.id
  await db.from('class_students').insert({ class_id: classId, student_id: legacyStudentId })

  await repos.blueprintActionItems.insert({
    learner_id: asLearnerId(coreLearnerId), school_id: schoolId, academic_year_id: null, term_id: null, blueprint_snapshot_id: null,
    context: 'current_term', priority: 'medium', visibility: 'teacher_only',
    title: 'Page Test Action', rationale: 'r', intended_outcome: 'Reach the outcome.',
    learner_action: null, teacher_action: null, parent_support: null, school_support: null,
    success_indicator: 'Success looks like this.',
    sub_strand_id: null, target_capability: null, review_date: null, teacher_notes: null,
    proposal_source: 'teacher', source_generator: null, evidence_basis: EVIDENCE_BASIS_EMPTY, proposed_by: null,
  }).then(row => repos.blueprintActionItems.recordDecision(row.id, {
    status: 'approved', reviewed_by: null, reviewed_at: new Date().toISOString(), decision_reason: null, review_date: null,
  }))
})

after(async () => {
  // blueprint_action_items is immutable once approved — left as accepted
  // test debt, matching every other Blueprint phase's own tests.
  await db.from('class_students').delete().eq('class_id', classId)
  await db.from('students').delete().eq('id', legacyStudentId)
  await db.from('teacher_classes').delete().eq('id', classId)
  await db.from('teachers').delete().eq('id', teacherId)
  await db.from('teachers').delete().eq('user_id', unrelatedTeacherAuthId)
  await db.from('school_users').delete().eq('school_id', schoolId)
  await db.from('learners').delete().eq('id', coreLearnerId)
  await db.from('schools').delete().eq('id', schoolId)
  for (const id of [teacherAuthId, unrelatedTeacherAuthId, parentAuthId]) await db.auth.admin.deleteUser(id)
})

function pageUrl(learnerId: string) {
  return `${BASE_URL}/teacher/learners/${learnerId}/blueprint/review`
}

test('unauthenticated request is redirected to /login', async () => {
  const res = await fetch(pageUrl(coreLearnerId), { redirect: 'manual' })
  assert.ok([307, 302].includes(res.status), `expected a redirect, got ${res.status}`)
  const location = res.headers.get('location') ?? ''
  assert.match(location, /\/login/)
})

test('an unrelated same-school teacher gets a 200 permission-denied page, not a crash', async () => {
  const res = await fetch(pageUrl(coreLearnerId), { headers: { Cookie: unrelatedTeacherSession.cookieHeader } })
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.match(html, /do not have (access|permission)/i)
})

test('a parent is denied — this is a teacher-only workspace, gated before this page\'s own code ever runs', async () => {
  // A parent never has a `teachers` row, so app/teacher/layout.tsx's own
  // pre-existing, page-agnostic gate (getUserRoles().primary !== 'teacher'
  // and no admin-tier membership) redirects them away from every
  // /teacher/** route, including this one, before
  // listReviewableBlueprintActionsForLearner() is ever called. This is
  // real, correct, already-proven platform behavior — not something Phase
  // 2E added — so this test proves the workspace sits behind that existing
  // gate rather than re-asserting the lib-level denial already covered by
  // reviewWorkspace.integration.test.ts.
  const res = await fetch(pageUrl(coreLearnerId), { headers: { Cookie: parentSession.cookieHeader }, redirect: 'manual' })
  assert.ok([307, 302].includes(res.status), `expected a redirect, got ${res.status}`)
})

test('the authorized teacher sees the workspace with the learner\'s action title rendered', async () => {
  const res = await fetch(pageUrl(coreLearnerId), { headers: { Cookie: teacherSession.cookieHeader } })
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.match(html, /Page Test Action/)
  assert.match(html, /Teacher Review Workspace/)
})

test('a non-existent learner id renders the not-found page, not a raw server error', async () => {
  // This route has a loading.tsx sibling, so Next's App Router streams the
  // response — the HTTP status is committed to 200 before notFound()
  // resolves deeper in the stream (confirmed empirically against this
  // exact route: the response body genuinely contains the app's
  // `app/not-found.tsx` content at status 200, never a raw error stack).
  // Content, not status code, is the honest signal here.
  const res = await fetch(pageUrl('00000000-0000-0000-0000-000000000000'), { headers: { Cookie: teacherSession.cookieHeader } })
  const html = await res.text()
  assert.match(html, /Lost in the Pathway/)
  assert.doesNotMatch(html, /Unhandled Runtime Error|Learner .* not found/) // no raw error message/stack leaked to the browser
})
