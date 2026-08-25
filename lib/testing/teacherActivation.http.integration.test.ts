// lib/testing/teacherActivation.http.integration.test.ts
//
// Phase 2 (admin-provisioned teacher activation) — the ROUTE-level security
// proofs that a pure lib-level test can't fully cover: GET ?mine=true's
// self-scoping through a real authenticated HTTP session (never a param a
// caller controls), and that POST action:'accept' ignores a client-
// supplied role and uses the server-written invitation's role instead —
// exercised through the real Zod-validated route, not by calling the lib
// function directly.
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --test lib/testing/teacherActivation.http.integration.test.ts
// (requires a real dev server already running)

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { inviteSchoolMember } from '@/lib/core/teacherOnboarding'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const SYNTHETIC_MARKER = 'SYNTHETIC_PHASE2_ACTIVATION_HTTP_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

let schoolId: string
let adminId: string
let teacherAEmail: string
let teacherAId: string
let teacherASession: SyntheticSession
let teacherBSession: SyntheticSession // has NO invitation anywhere

async function mkAuthUser(label: string) {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email, password }
}

before(async () => {
  const admin = await mkAuthUser('admin')
  adminId = admin.id
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, adminId)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  await repos.schools.addSchoolUser(schoolId, adminId, 'school_admin')

  const teacherA = await mkAuthUser('teacher-a')
  teacherAId = teacherA.id
  teacherAEmail = teacherA.email
  const invite = await inviteSchoolMember(schoolId, teacherAEmail, 'teacher', adminId)
  if (invite.status !== 'invited') throw new Error(`fixture invite failed: ${invite.status}`)
  teacherASession = await signInForHttpTest(teacherA.email, teacherA.password)

  const teacherB = await mkAuthUser('teacher-b')
  teacherBSession = await signInForHttpTest(teacherB.email, teacherB.password)
})

after(async () => {
  for (const id of createdSchoolIds) {
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdAuthUserIds) {
    // H1E-B: same notification_log FK leak class as schoolHandoff/
    // teacherLifecycle/studentBlueprintSelfAccess.
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    const { error } = await db.auth.admin.deleteUser(id)
    if (error) console.error(`[cleanup] auth user ${id} not deleted: ${error.message}`)
  }
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

test('GET /api/core/teachers?mine=true: the invited teacher sees their own pending invitation', async () => {
  const res = await fetch(`${BASE_URL}/api/core/teachers?mine=true`, { headers: cookie(teacherASession) })
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.equal(json.data.length, 1)
  assert.equal(json.data[0].schoolId, schoolId)
  assert.equal(json.data[0].role, 'teacher')
})

test('GET /api/core/teachers?mine=true: an uninvited user sees no invitations, not teacherA\'s', async () => {
  const res = await fetch(`${BASE_URL}/api/core/teachers?mine=true`, { headers: cookie(teacherBSession) })
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.deepEqual(json.data, [])
})

test('GET /api/core/teachers?mine=true: unauthenticated request is rejected, not given an empty-but-200 bypass', async () => {
  const res = await fetch(`${BASE_URL}/api/core/teachers?mine=true`)
  assert.equal(res.status, 401)
})

test('POST accept: teacherB (no invitation at this school) cannot accept teacherA\'s invitation by supplying schoolId — identity binding via auth session, not request body', async () => {
  const res = await fetch(`${BASE_URL}/api/core/teachers`, {
    method: 'POST',
    headers: { ...cookie(teacherBSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'accept', schoolId, full_name: 'Impersonator' }),
  })
  assert.equal(res.status, 404)
})

test('POST accept: a client-supplied role field is silently ignored — the accepted role is the server-written invitation role, not "school_admin"', async () => {
  const res = await fetch(`${BASE_URL}/api/core/teachers`, {
    method: 'POST',
    headers: { ...cookie(teacherASession), 'Content-Type': 'application/json' },
    // AcceptSchema has no `role` field at all — this proves the extra key
    // is inert, not merely untyped, by checking the resulting DB row.
    body: JSON.stringify({ action: 'accept', schoolId, full_name: 'Teacher A', role: 'school_admin' }),
  })
  assert.equal(res.status, 200)

  const { data: schoolUser } = await db.from('school_users').select('role, is_active').eq('school_id', schoolId).eq('user_id', teacherAId).single()
  assert.equal(schoolUser!.role, 'teacher', 'must remain the role the admin actually invited, ignoring the injected field')
  assert.equal(schoolUser!.is_active, true)
})

test('after accepting as a plain teacher, the account does NOT gain admin-tier institutional access', async () => {
  const res = await fetch(`${BASE_URL}/teacher/core-team`, { headers: cookie(teacherASession), redirect: 'manual' })
  // A plain teacher IS admitted to /teacher/core-team by the ordinary
  // teacher-role gate (they can view it, read-only per Phase 1's own
  // client-side isAdminTier check) — the real proof is server-side: they
  // must not hold an admin-tier membership.
  assert.equal(res.status, 200)
  const { data: membership } = await db.from('school_users').select('role').eq('school_id', schoolId).eq('user_id', teacherAId).single()
  assert.equal(['school_admin', 'headteacher', 'deputy_headteacher'].includes(membership!.role), false)
})
