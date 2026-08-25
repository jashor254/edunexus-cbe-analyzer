// lib/testing/parentAttendanceVisibility.http.integration.test.ts
//
// Parent Portal Phase P4.5 (Attendance Visibility Convergence) — proves,
// through the real rendered Parent Home (`/child/[learnerId]`) via a live
// next dev server, that the three features P4's own closeout found dead
// (`docs/architecture/parent-portal-p4-attention-action-model.md` §16/§35)
// are now real for an authenticated, authorized parent: the "Learning
// Time" Home card shows a real percentage (not the PARENT_STATUS_LABEL
// fallback), the "Review Attendance" action appears under "What Can I
// Do?" when attendance is below the canonical 90% threshold, and the
// "Attendance has been less consistent..." item appears under "Needs
// Attention". Also proves the read boundary itself: an unrelated parent,
// a sibling's page, and a different school's child never leak this
// learner's attendance.
//
// Root cause (traced in lib/core/attendance.ts's own getLearnerAttendanceHistory):
// admin-tier-only gate never had a guardian branch. Fix: widened that one
// function's existing internal authorization check to also allow the
// learner's own registered guardian (resolveParent().coreLearnerIds),
// reusing the SAME resolver lib/core/permissions.ts's requireParent uses.
// Nothing about attendance's own calculation, threshold, or window
// changed — see lib/core/attendanceParentVisibility.test.ts for the
// authorization policy proved directly (admin/parent/unrelated/sibling/
// bogus-id), and this file for the end-to-end Home/Blueprint proof.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { createAttendanceSession, bulkRecordAttendance } from '@/lib/core/attendance'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'
import { deleteAuthUserOrThrow } from './deleteAuthUserOrThrow'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const MARKER = 'SYNTHETIC_P4_5_ATTENDANCE_HTTP'
const db = createServiceClient()

const PASSWORD = `Test!${Math.random().toString(36).slice(2, 10)}`

const authUserIds: string[] = []
const schoolIds: string[] = []
const learnerIds: string[] = []

let parentSession: SyntheticSession
let unrelatedParentSession: SyntheticSession

let learnerLowId: string    // below the 90% threshold -> Attention item + review_attendance action
let learnerHighId: string   // healthy (>= 90%) -> informational only, no concern, no action
let learnerNoDataId: string // enrolled, zero attendance records -> honest "no data", never 0%/100%
let learnerDId: string      // same parent, DIFFERENT school, its own below-threshold record -> isolation proof

async function createUser(label: string): Promise<{ authId: string; session: SyntheticSession }> {
  const email = `${MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  const session = await signInForHttpTest(email, PASSWORD)
  return { authId: data.user.id, session }
}

async function setUpSchool(label: string) {
  const admin = await createUser(`admin-${label}`)
  const school = await repos.schools.create({ school_name: `${MARKER}_school_${label}` }, admin.authId)
  schoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.authId, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`activateSchool failed for ${label}`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)

  return {
    schoolId: school.id as string,
    adminAuthId: admin.authId,
    classId: classes![0].id as string,
    academicYearId: classes![0].academic_year_id as string,
    termId: terms![0].id as string,
  }
}

async function enrollLearner(school: Awaited<ReturnType<typeof setUpSchool>>, first: string, admissionSuffix: string, parentAuthId: string) {
  const result = await onboardLearner(school.schoolId, {
    admission_number: `${MARKER}-${admissionSuffix}-${Date.now()}`,
    first_name: first, last_name: 'Learner',
    class_id: school.classId, term_id: school.termId, academic_year_id: school.academicYearId,
  })
  if (result.status !== 'complete' || !result.learnerId) throw new Error(`onboardLearner failed for ${first}`)
  learnerIds.push(result.learnerId)

  const { error: guardianErr } = await db.from('learner_guardians').insert({
    learner_id: result.learnerId, school_id: school.schoolId, user_id: parentAuthId,
    relationship: 'mother', full_name: MARKER, phone: `07${Math.floor(Math.random() * 100_000_000)}`,
  })
  if (guardianErr) throw guardianErr

  return result.learnerId
}

// Sessions are unique per (school, class, date, session_type) — when
// several learners share the same class (Low/High/NoData all do, same
// school), their attendance must be recorded into the SAME session per
// day rather than one session per learner, exactly as a real teacher
// marking a whole class would. `perLearnerStatuses` maps learnerId -> its
// status for each day index; a learner with fewer entries than another
// simply has fewer days recorded (this is how "NoData" ends up with zero
// records without needing a separate class).
async function seedAttendance(
  school: Awaited<ReturnType<typeof setUpSchool>>,
  dateOffset: number,
  perLearnerStatuses: Record<string, Array<'present' | 'absent' | 'late' | 'excused'>>,
) {
  const dayCount = Math.max(0, ...Object.values(perLearnerStatuses).map(s => s.length))
  for (let i = 0; i < dayCount; i++) {
    const session = await createAttendanceSession(school.adminAuthId, {
      school_id: school.schoolId, academic_year_id: school.academicYearId, term_id: school.termId, class_id: school.classId,
      attendance_date: `2026-04-${String(dateOffset + i + 1).padStart(2, '0')}`,
    })
    const records = Object.entries(perLearnerStatuses)
      .filter(([, statuses]) => statuses[i] !== undefined)
      .map(([learnerId, statuses]) => ({ learner_id: learnerId, status: statuses[i] }))
    if (records.length > 0) await bulkRecordAttendance(school.adminAuthId, school.schoolId, session.id, records)
  }
}

before(async () => {
  const schoolA = await setUpSchool('A')
  const parent = await createUser('parent')
  parentSession = parent.session

  learnerLowId = await enrollLearner(schoolA, 'Low', 'low', parent.authId)
  learnerHighId = await enrollLearner(schoolA, 'High', 'high', parent.authId)
  learnerNoDataId = await enrollLearner(schoolA, 'NoData', 'nodata', parent.authId)

  // Low: 7 present, 3 absent -> 70% (below the canonical 90% threshold).
  // High: 10 present -> 100% (healthy).
  // NoData: enrolled, zero sessions recorded (never appears in the map).
  await seedAttendance(schoolA, 0, {
    [learnerLowId]: ['present', 'present', 'present', 'present', 'present', 'present', 'present', 'absent', 'absent', 'absent'],
    [learnerHighId]: Array(10).fill('present'),
  })

  const schoolD = await setUpSchool('D')
  learnerDId = await enrollLearner(schoolD, 'DifferentSchool', 'd', parent.authId)
  await seedAttendance(schoolD, 0, { [learnerDId]: ['present', 'present', 'absent', 'absent', 'absent'] }) // 40%, below threshold

  const unrelated = await createUser('unrelated-parent')
  unrelatedParentSession = unrelated.session
})

after(async () => {
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort */ } }
  for (const id of schoolIds) await safely(() => db.from('schools').delete().eq('id', id)) // cascades classes/terms/attendance/learners/learner_guardians
  for (const id of authUserIds) await safely(() => deleteAuthUserOrThrow(db, id))
})

// ── The Learning Time card now shows real data, not the fallback ────────

test('GET /child/[Low]: Learning Time card shows the real 70% (below threshold), not the "Not Enough Information Yet" fallback', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerLowId}`, { headers: { Cookie: parentSession.cookieHeader }, redirect: 'manual' })
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.ok(html.includes('70% this term'), 'Learning Time must show the real percentage — proves the admin-only-gate fallback no longer applies to Attendance for a real parent (other unrelated sections, e.g. Career/Compass, are not seeded by this fixture and may legitimately still show their own "Not Enough Information Yet" fallback elsewhere on the same page)')
})

test('GET /child/[High]: Learning Time card shows the real 100%, no concern surfaced', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerHighId}`, { headers: { Cookie: parentSession.cookieHeader }, redirect: 'manual' })
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.ok(html.includes('100% this term'), 'Learning Time must show the real healthy percentage')
  assert.ok(!html.includes('Attendance has been less consistent'), 'healthy attendance must never render as a concern')
  assert.ok(!html.includes('Review Attendance'), '"Review Attendance" is priority=completed when healthy — filtered out of What Can I Do?')
})

test('GET /child/[NoData]: honest no-data state, never a fabricated 0% or 100%', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerNoDataId}`, { headers: { Cookie: parentSession.cookieHeader }, redirect: 'manual' })
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.ok(!html.includes('0% this term'), 'zero sessions must never render as 0%')
  assert.ok(!html.includes('100% this term'), 'zero sessions must never render as 100%')
  assert.ok(!html.includes('Attendance has been less consistent'), 'no data is not a concern, never fabricated into one')
})

// ── review_attendance / Needs Attention now fire for real ────────────────

test('GET /child/[Low]: "Review Attendance" renders under "What Can I Do?" with the existing critical copy', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerLowId}`, { headers: { Cookie: parentSession.cookieHeader }, redirect: 'manual' })
  const html = await res.text()
  assert.ok(html.includes('What Can I Do?'), 'Actions section must render')
  assert.ok(html.includes('Review Attendance'), 'review_attendance must now be produced by composeParentActions() for a real parent')
  assert.ok(html.includes('Learning Time is at 70% this term'), 'the existing critical copy must use the real percentage')
})

test('GET /child/[Low]: "Attendance has been less consistent..." renders under "Needs Attention" (P4\'s attendance source, now live)', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerLowId}`, { headers: { Cookie: parentSession.cookieHeader }, redirect: 'manual' })
  const html = await res.text()
  assert.ok(html.includes('Needs Attention'), 'Attention section must render')
  assert.ok(html.includes('Attendance has been less consistent recently'), 'P4\'s attendance Attention item, previously permanently inert, must now render')
  assert.ok(html.includes('70% this term'), 'the Attention item must show the real percentage')
})

// ── Read boundary: unrelated parent, sibling isolation, multi-school ─────

test('An unrelated parent never sees Child Low\'s attendance percentage or name', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerLowId}`, { headers: { Cookie: unrelatedParentSession.cookieHeader }, redirect: 'manual' })
  assert.notEqual(res.status, 500)
  const html = await res.text()
  assert.ok(!html.includes('70% this term'), 'an unrelated parent must never see this attendance percentage')
  assert.ok(!html.includes('Low Learner'), 'an unrelated parent must never see the child\'s name')
})

test('Sibling isolation: Child Low\'s 70% attendance never appears on Child High\'s Home (same parent, same school)', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerHighId}`, { headers: { Cookie: parentSession.cookieHeader }, redirect: 'manual' })
  const html = await res.text()
  assert.ok(!html.includes('70% this term'), 'Child Low\'s attendance must never leak onto Child High\'s Home')
})

test('Multi-school isolation: Child Low\'s Home shows only its OWN 70%, never Child D\'s 40% from a different school', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerLowId}`, { headers: { Cookie: parentSession.cookieHeader }, redirect: 'manual' })
  const html = await res.text()
  assert.ok(html.includes('70% this term'))
  assert.ok(!html.includes('40% this term'), 'Child D\'s (different school) attendance must never appear on Child Low\'s Home')
})

test('IDOR: an unrelated parent directly requesting a manipulated learnerId gets a clean denial, never a partial attendance payload', async () => {
  const res = await fetch(`${BASE_URL}/child/${learnerHighId}`, { headers: { Cookie: unrelatedParentSession.cookieHeader }, redirect: 'manual' })
  assert.notEqual(res.status, 500)
  const html = await res.text()
  assert.ok(!html.includes('100% this term'), 'an unrelated parent must never receive even a healthy percentage for a child that is not theirs')
})
