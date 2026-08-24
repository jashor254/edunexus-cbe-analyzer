// lib/testing/parentChildContextConvergence.http.integration.test.ts
//
// Parent Portal Phase P3.5 — proves P3's own named limitation is closed:
// "Step 33's HTTP regression harness was also not stood up... no HTTP-level
// fixture proves the new `viewerRole` field or the `ChildContextHeader`
// ownership behavior end-to-end" (docs/architecture/
// parent-portal-p3-home-child-context-convergence.md §25/§30). This exercises
// the real rendered pages through a live next dev server via the new parent
// HTTP harness — semantic content of the raw HTML, not styling.
//
// Fixture: ONE parent guardian of TWO Core children (A, B) at the same
// school, bridged to legacy `students` rows the way real enrolled learners
// are (external_id -> learners.id, same pattern P1/P2 already use) so every
// `/child/[learnerId]/*` subpage's own legacy-bridge lookup succeeds. A
// third child (C) belongs to an UNRELATED parent — used to prove the
// multi-child switcher never leaks a stranger's child into the list.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'
import { deleteAuthUserOrThrow } from './deleteAuthUserOrThrow'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const MARKER = 'SYNTHETIC_P35_CHILD_CONTEXT_HTTP'
const db = createServiceClient()

const authUserIds: string[] = []
const schoolIds: string[] = []
const learnerIds: string[] = []
const studentIds: string[] = []
const teacherRowIds: string[] = []

const PASSWORD = `Test!${Math.random().toString(36).slice(2, 10)}`

let parentSession: SyntheticSession
let unrelatedParentSession: SyntheticSession

// Deliberately NOT marker-prefixed — these are the literal names asserted
// against rendered HTML. A shared MARKER prefix on all three would make
// every "must not appear" assertion vacuously pass/fail (every child's name
// would share the same substring). Cleanup tracks rows by id (studentIds/
// learnerIds arrays), not by scanning for a marker in the name field.
const CHILD_A_FIRST = 'Aisha'
const CHILD_A_LAST = 'Wanjiru'
const CHILD_B_FIRST = 'Brian'
const CHILD_B_LAST = 'Otieno'
const CHILD_C_FIRST = 'Carla'
const CHILD_C_LAST = 'Kimani'

let learnerAId: string
let learnerBId: string
let learnerCId: string

async function createUser(label: string): Promise<{ authId: string; session: SyntheticSession }> {
  const email = `${MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  const session = await signInForHttpTest(email, PASSWORD)
  return { authId: data.user.id, session }
}

async function createBridgedChild(schoolId: string, teacherId: string, firstName: string, lastName: string, admissionSuffix: string) {
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

  return { learnerId: learner.id as string, studentId: student.id as string }
}

before(async () => {
  const teacherUser = await createUser('teacher')
  const { data: teacherRow, error: teacherErr } = await db.from('teachers')
    .insert({ user_id: teacherUser.authId, full_name: MARKER, school: MARKER })
    .select('id').single()
  if (teacherErr) throw teacherErr
  teacherRowIds.push(teacherRow.id)

  const { data: school, error: schoolErr } = await db.from('schools').insert({ school_name: `${MARKER}_school` }).select('id').single()
  if (schoolErr) throw schoolErr
  schoolIds.push(school.id)

  const parent = await createUser('parent')
  parentSession = parent.session

  const a = await createBridgedChild(school.id, teacherRow.id, CHILD_A_FIRST, CHILD_A_LAST, 'A')
  const b = await createBridgedChild(school.id, teacherRow.id, CHILD_B_FIRST, CHILD_B_LAST, 'B')
  learnerAId = a.learnerId
  learnerBId = b.learnerId

  const { error: guardianErrA } = await db.from('learner_guardians')
    .insert({ learner_id: learnerAId, school_id: school.id, user_id: parent.authId, relationship: 'mother', full_name: MARKER, phone: '0700000010' })
  if (guardianErrA) throw guardianErrA
  const { error: guardianErrB } = await db.from('learner_guardians')
    .insert({ learner_id: learnerBId, school_id: school.id, user_id: parent.authId, relationship: 'mother', full_name: MARKER, phone: '0700000010' })
  if (guardianErrB) throw guardianErrB

  // ── Unrelated parent + unrelated child C ────────────────────────────────
  const unrelatedParent = await createUser('unrelated-parent')
  unrelatedParentSession = unrelatedParent.session

  const c = await createBridgedChild(school.id, teacherRow.id, CHILD_C_FIRST, CHILD_C_LAST, 'C')
  learnerCId = c.learnerId
  const { error: guardianErrC } = await db.from('learner_guardians')
    .insert({ learner_id: learnerCId, school_id: school.id, user_id: unrelatedParent.authId, relationship: 'father', full_name: MARKER, phone: '0700000011' })
  if (guardianErrC) throw guardianErrC
})

after(async () => {
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort */ } }
  for (const id of studentIds) await safely(() => db.from('students').delete().eq('id', id))
  for (const id of learnerIds) {
    await safely(() => db.from('learner_guardians').delete().eq('learner_id', id))
    await safely(() => db.from('learners').delete().eq('id', id))
  }
  for (const id of schoolIds) await safely(() => db.from('schools').delete().eq('id', id))
  for (const id of teacherRowIds) await safely(() => db.from('teachers').delete().eq('id', id))
  for (const u of authUserIds) await safely(() => deleteAuthUserOrThrow(db, u))
})

const SUBPAGES = ['assignments', 'gradebook', 'progress', 'holiday', 'journey', 'history'] as const

// ── Single-child reachability + name rendering (Steps 15-16) ───────────────

for (const page of SUBPAGES) {
  test(`GET /child/[A]/${page}: 200, response contains Child A's name (child-context header rendered)`, async () => {
    const res = await fetch(`${BASE_URL}/child/${learnerAId}/${page}`, {
      headers: { Cookie: parentSession.cookieHeader },
      redirect: 'manual',
    })
    assert.equal(res.status, 200)
    const html = await res.text()
    assert.ok(html.includes(CHILD_A_FIRST), `expected ${page} page HTML to render Child A's name`)
  })

  // Known, pre-existing, documented framework quirk (see
  // lib/testing/parentPortalP1Convergence.http.integration.test.ts's own
  // "IDOR" section comment): next/navigation's notFound() does not reliably
  // surface as a raw HTTP 404 to a non-JS fetch() client in this Next.js
  // version — the response is a 200 whose streamed RSC payload carries the
  // NEXT_HTTP_ERROR_FALLBACK/not-found marker a real browser's React runtime
  // would act on. The reliable, semantically equivalent proof (and what this
  // mission step actually cares about — "does not reveal child context") is
  // asserted directly: the child's name/identity is never present in the body
  // an unrelated parent receives, whatever the transport-level status code.
  test(`GET /child/[A]/${page}: an unrelated parent never receives this child's identity in the response`, async () => {
    const res = await fetch(`${BASE_URL}/child/${learnerAId}/${page}`, {
      headers: { Cookie: unrelatedParentSession.cookieHeader },
      redirect: 'manual',
    })
    assert.notEqual(res.status, 500)
    const html = await res.text()
    assert.ok(!html.includes(CHILD_A_FIRST), 'an unrelated parent must never see the child\'s name')
    assert.ok(!html.includes(CHILD_A_LAST), 'an unrelated parent must never see the child\'s name')
  })
}

// ── Multi-child switcher (Step 16) ──────────────────────────────────────────

test('GET /child/[A]/gradebook: multi-child parent sees Child A identity + switcher + Child B link, never Child C', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerAId}/gradebook`, {
    headers: { Cookie: parentSession.cookieHeader },
    redirect: 'manual',
  })
  assert.equal(res.status, 200)
  const html = await res.text()

  assert.ok(html.includes(CHILD_A_FIRST), 'Child A\'s own identity must render')
  assert.ok(html.includes('Switch child'), 'a 2+ Core-child parent must see the switcher affordance, not the single-child link')
  assert.ok(html.includes(`/child/${learnerBId}`), 'Child B\'s destination link must be present in the switcher')
  assert.ok(html.includes(CHILD_B_FIRST), 'Child B\'s name must be listed in the switcher')
  assert.ok(!html.includes(CHILD_C_FIRST), 'an unrelated Child C must never appear in this parent\'s switcher')
  assert.ok(!html.includes(`/child/${learnerCId}`), 'Child C\'s id must never appear as a switcher link')
})

// Same documented notFound()-under-fetch() quirk as above — proof is body
// content (no Child C identity leaked to this parent), not the raw status.
test('GET /child/[C]/gradebook (unrelated to this parent): Child C\'s identity is never revealed', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerCId}/gradebook`, {
    headers: { Cookie: parentSession.cookieHeader },
    redirect: 'manual',
  })
  assert.notEqual(res.status, 500)
  const html = await res.text()
  assert.ok(!html.includes(CHILD_C_FIRST), 'a parent unrelated to Child C must never see Child C\'s name')
  assert.ok(!html.includes(CHILD_C_LAST), 'a parent unrelated to Child C must never see Child C\'s name')
})
