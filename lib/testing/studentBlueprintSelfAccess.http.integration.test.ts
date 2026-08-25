// lib/testing/studentBlueprintSelfAccess.http.integration.test.ts
//
// Sprint 6 (Learner Growth Experience Convergence) — proves a real,
// self-service student account can actually reach the content of their own
// canonical Blueprint page, not just a 200 status. Blocker #5's own routing
// test (studentPageRouting.http.integration.test.ts) never caught this: its
// synthetic student owns no `students` row, so `/student/blueprint` always
// short-circuits at the "no owned student" empty state before ever reaching
// `/student/blueprint/[learnerId]` — the page where the real bug lived.
//
// The bug: `/student/blueprint/[learnerId]` gated access with
// `requireSchoolStaff` (admin/headteacher/deputy/teacher only —
// `SchoolUserRole` has no `student` value, so no student ever has a
// `school_users` row). Every real student hit `PermissionDeniedError` on
// their own Blueprint. Fixed by switching to the new `requireLearnerAccess`
// (composes the existing, previously-unused `canViewLearner` with the
// existing `resolveLegacyStudentId` bridge — no new authorization pattern).
//
// This file tests both layers: the permission function directly against the
// live database (reliable, per the known Next.js notFound()/streaming quirk
// documented in parentExperienceConvergence.http.integration.test.ts), and
// the actual page body for the two distinguishable states.
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --test lib/testing/studentBlueprintSelfAccess.http.integration.test.ts
// (requires `next dev -p 3939 &` already running)

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { canViewLearnerRecord, requireLearnerAccess } from '@/lib/core/permissions'
import { ResourceOwnershipError } from '@/lib/core/errors'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'
import { asLearnerId } from '@/lib/core/identityTypes'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { ensureBridgedClass, ensureBridgedLearner } from '@/lib/core/academicBridge'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const SYNTHETIC_MARKER = 'SYNTHETIC_SPRINT6_BLUEPRINT_SELF_ACCESS_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 10)}`

const authUserIds: string[] = []
const schoolIds: string[] = []
const learnerIds: string[] = []
const studentIds: string[] = []

let studentSession: SyntheticSession
let otherStudentSession: SyntheticSession
let studentEmail: string
let otherStudentEmail: string
let coreLearnerId: string
let legacyStudentId: string

async function createUser(label: string, profileRole?: 'student' | 'teacher'): Promise<{ authId: string; session: SyntheticSession; email: string }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  if (profileRole) {
    const { error: profileErr } = await db.from('profiles').upsert({ id: data.user.id, role: profileRole })
    if (profileErr) throw profileErr
  }
  const session = await signInForHttpTest(email, PASSWORD)
  return { authId: data.user.id, session, email }
}

async function signInClient(email: string) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

before(async () => {
  const student = await createUser('student', 'student')
  const otherStudent = await createUser('other-student', 'student')
  studentSession = student.session
  otherStudentSession = otherStudent.session
  studentEmail = student.email
  otherStudentEmail = otherStudent.email

  // H1D-3B: rebuilt via the real production onboarding/bridge pipeline
  // (the same one composeBlueprint.integration.test.ts's "resolves a real
  // bridged legacy identity" test proves works), replacing the original
  // raw-table-insert fixture. The raw inserts skipped activateSchool's own
  // academic_years/terms/classes/class_subjects setup entirely, so
  // composeBlueprintWithCoherence threw before ever reaching the page's
  // real content — the page's own catch swallowed the error into an
  // "unavailable" state message, which is what looked like a
  // content-render bug (H1D-2/H1D-3) but was actually an insufficient
  // fixture. See docs H1D-3B closeout for the isolation trail.
  const admin = await createUser('admin')
  const { data: school, error: schoolErr } = await db
    .from('schools').insert({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}`, created_by: admin.authId }).select('id').single()
  if (schoolErr) throw schoolErr
  schoolIds.push(school.id)
  await db.from('school_users').insert({ school_id: school.id, user_id: admin.authId, role: 'school_admin', is_active: true })

  const activation = await activateSchool(school.id, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`activateSchool failed: ${JSON.stringify(activation)}`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)
  const classId = classes![0].id
  const termId = terms![0].id
  const academicYearId = classes![0].academic_year_id

  const enroll = await onboardLearner(school.id, {
    admission_number: `${SYNTHETIC_MARKER}-${Date.now()}`,
    first_name: 'Test', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
    guardian: { full_name: 'Synthetic Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'father' },
  })
  if (enroll.status !== 'complete' || !enroll.learnerId) throw new Error(`onboardLearner failed: ${JSON.stringify(enroll)}`)
  coreLearnerId = enroll.learnerId
  learnerIds.push(coreLearnerId)

  const teacherUser = await createUser('teacher')
  const invite = await inviteTeacher(school.id, teacherUser.email, admin.authId)
  if (invite.status !== 'invited') throw new Error(`inviteTeacher failed: ${JSON.stringify(invite)}`)
  const accept = await acceptTeacherInvitation(teacherUser.authId, school.id, { full_name: SYNTHETIC_MARKER })
  if (accept.status !== 'accepted') throw new Error(`acceptTeacherInvitation failed: ${JSON.stringify(accept)}`)

  const bridgedClass = await ensureBridgedClass(school.id, classId, teacherUser.authId)
  const { legacyStudentId: bridgedStudentId } = await ensureBridgedLearner(school.id, asLearnerId(coreLearnerId), bridgedClass)
  legacyStudentId = bridgedStudentId
  studentIds.push(legacyStudentId)

  // Self-service bridge: the student's OWN auth account now owns this
  // legacy student row, matching production self-service signup shape —
  // required for requireLearnerAccess's self-branch (canViewLearner) to
  // recognize `student` as this learner themself, not just any student.
  const { error: bindErr } = await db.from('students').update({ user_id: student.authId }).eq('id', legacyStudentId)
  if (bindErr) throw bindErr
})

after(async () => {
  // Same order/reasoning as composeBlueprint.integration.test.ts's after():
  // legacy bridge rows aren't FK'd to schools, so they don't cascade from
  // the school delete below and must be cleared explicitly first.
  if (studentIds.length) {
    const { data: evidenceRows } = await db.from('learner_evidence').select('id').in('learner_id', studentIds)
    const evidenceIds = (evidenceRows ?? []).map(e => e.id)
    if (evidenceIds.length) {
      await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
      await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
    }
    await db.from('learner_evidence').delete().in('learner_id', studentIds)
    await db.from('learner_projections').delete().in('learner_id', studentIds)
    await db.from('learner_marks').delete().in('student_id', studentIds)
    await db.from('students').delete().in('id', studentIds)
  }
  await db.from('learners').delete().in('id', learnerIds)
  await db.from('schools').delete().in('id', schoolIds)
  for (const id of authUserIds) {
    // H1E-A: inviteTeacher's notification side effect leaves a
    // notification_log row referencing the admin; deleteUser silently
    // fails against that FK unless cleared first (found by the DEEP_PR/
    // HTTP_PR cleanup gate — same class of leak as teacherLifecycle.test.ts).
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    const { error } = await db.auth.admin.deleteUser(id)
    if (error) console.error(`[cleanup] auth user ${id} not deleted: ${error.message}`)
  }
  console.log('[cleanup] synthetic Sprint 6 Blueprint self-access fixtures removed')
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

// ── The permission function itself, against the live database ──────────────

test('canViewLearnerRecord(coreLearnerId): the learner\'s own account is allowed', async () => {
  const client = await signInClient(studentEmail)
  const allowed = await canViewLearnerRecord(client, schoolIds[0], asLearnerId(coreLearnerId))
  assert.equal(allowed, true)
})

test('requireLearnerAccess(coreLearnerId): the learner\'s own account does not throw', async () => {
  const client = await signInClient(studentEmail)
  const user = await requireLearnerAccess(client, schoolIds[0], asLearnerId(coreLearnerId))
  assert.ok(user.id)
})

test('requireLearnerAccess(coreLearnerId): an unrelated student account is denied', async () => {
  const client = await signInClient(otherStudentEmail)
  await assert.rejects(() => requireLearnerAccess(client, schoolIds[0], asLearnerId(coreLearnerId)), ResourceOwnershipError)
})

// ── The actual page, over real HTTP ──────────────────────────────────────────
//
// Status alone can't distinguish these two cases in this Next.js version
// (both render as a real 200 page — no notFound() is involved in either
// branch), so this asserts on the distinguishing body text instead.

test('GET /student/blueprint/[learnerId]: the learner\'s own account sees the real Blueprint, not the denial screen', async () => {
  const res = await fetch(`${BASE_URL}/student/blueprint/${coreLearnerId}`, { headers: cookie(studentSession), redirect: 'manual' })
  assert.equal(res.status, 200)
  const body = await res.text()
  assert.ok(!body.includes('You do not have access to this Blueprint'), 'the learner\'s own Blueprint must not show the permission-denied screen')
  // H1D-3B: components/blueprint/BlueprintView.tsx's DOCUMENT_NAME was
  // renamed from 'Learner Blueprint' to 'Learner Progress Report' at some
  // point after this assertion was written; the assertion was stale, not
  // the render. Confirmed by inspecting the component's current literal
  // constant, not by guessing from the failure.
  assert.ok(body.includes('Learner Progress Report'), 'the real Blueprint heading must render')
  // Sprint 6 — Portfolio/Achievement were fully built and tested
  // (lib/learnerPortfolio, lib/learnerAchievement) but never rendered by
  // any Blueprint view; this proves the section titles now actually reach
  // the page, not just composeBlueprint()'s in-memory result.
  assert.ok(body.includes('Portfolio'), 'the Portfolio section must render')
  assert.ok(body.includes('Achievements'), 'the Achievements section must render')
})

test('GET /student/blueprint/[learnerId]: an unrelated student account sees the denial screen, not the real Blueprint', async () => {
  const res = await fetch(`${BASE_URL}/student/blueprint/${coreLearnerId}`, { headers: cookie(otherStudentSession), redirect: 'manual' })
  assert.equal(res.status, 200)
  const body = await res.text()
  assert.ok(body.includes('You do not have access to this Blueprint'))
})
