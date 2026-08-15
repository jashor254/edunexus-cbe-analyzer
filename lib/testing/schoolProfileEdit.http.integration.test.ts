// lib/testing/schoolProfileEdit.http.integration.test.ts
//
// Phase 1 self-serve onboarding, Task 2 — proves the reused (unchanged)
// PATCH /api/core/school route behind the new School Profile edit form:
// admin update succeeds, non-admin update fails, cross-school update fails,
// sparse optional values are accepted, and persisted values reload
// correctly on a fresh GET (proving the write actually landed, not just
// that the response echoed back what was sent).
//
// Run: LMS_TEST_BASE_URL=http://localhost:3939 npx tsx --env-file=.env.local --test lib/testing/schoolProfileEdit.http.integration.test.ts
// (requires `next dev -p 3939 &` already running)

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const SYNTHETIC_MARKER = 'SYNTHETIC_PHASE1_PROFILE_EDIT_TEST'
const db = createServiceClient()

const authUserIds: string[] = []
const schoolIds: string[] = []

let schoolId: string
let adminSession: SyntheticSession
let teacherSession: SyntheticSession   // active teacher-tier member of the SAME school
let outsiderAdminSchoolId: string
let outsiderAdminSession: SyntheticSession // school_admin of a DIFFERENT school

async function mkAuthUser(label: string) {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  return { id: data.user.id, email, password }
}

before(async () => {
  const admin = await mkAuthUser('admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, admin.id)
  schoolId = school.id
  schoolIds.push(schoolId)
  await db.from('school_users').insert({ school_id: schoolId, user_id: admin.id, role: 'school_admin', is_active: true })
  adminSession = await signInForHttpTest(admin.email, admin.password)

  const teacher = await mkAuthUser('teacher')
  await db.from('school_users').insert({ school_id: schoolId, user_id: teacher.id, role: 'teacher', is_active: true })
  teacherSession = await signInForHttpTest(teacher.email, teacher.password)

  const outsiderAdmin = await mkAuthUser('outsider-admin')
  const otherSchool = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-other-school` }, outsiderAdmin.id)
  outsiderAdminSchoolId = otherSchool.id
  schoolIds.push(outsiderAdminSchoolId)
  await db.from('school_users').insert({ school_id: outsiderAdminSchoolId, user_id: outsiderAdmin.id, role: 'school_admin', is_active: true })
  outsiderAdminSession = await signInForHttpTest(outsiderAdmin.email, outsiderAdmin.password)
})

after(async () => {
  for (const id of schoolIds) {
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of authUserIds) await db.auth.admin.deleteUser(id)
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

async function patchSchool(session: SyntheticSession, body: Record<string, unknown>) {
  return fetch(`${BASE_URL}/api/core/school`, {
    method: 'PATCH',
    headers: { ...cookie(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test('a school_admin can update their own school profile', async () => {
  const res = await patchSchool(adminSession, {
    schoolId,
    county: 'Kirinyaga',
    contact_phone: '0712345678',
    motto: 'Excellence through learning',
  })
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.equal(json.data.county, 'Kirinyaga')
  assert.equal(json.data.contact_phone, '0712345678')
  assert.equal(json.data.motto, 'Excellence through learning')
})

test('a plain teacher (non-admin-tier) cannot update the school profile', async () => {
  const res = await patchSchool(teacherSession, { schoolId, county: 'Nairobi' })
  assert.equal(res.status, 403)
})

test('a school_admin of a different school cannot update this school', async () => {
  const res = await patchSchool(outsiderAdminSession, { schoolId, county: 'Nairobi' })
  assert.equal(res.status, 403)
})

test('sparse optional values work — updating one field leaves the rest untouched', async () => {
  const before = await fetch(`${BASE_URL}/api/core/school?schoolId=${schoolId}`, { headers: cookie(adminSession) })
  const beforeJson = await before.json()
  assert.equal(beforeJson.data.school.county, 'Kirinyaga') // from the earlier test

  const res = await patchSchool(adminSession, { schoolId, ward: 'Kerugoya' })
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.equal(json.data.ward, 'Kerugoya')
  assert.equal(json.data.county, 'Kirinyaga', 'an unrelated field sent later must not clobber an earlier one')
})

test('persisted values reload correctly on a fresh GET', async () => {
  const res = await fetch(`${BASE_URL}/api/core/school?schoolId=${schoolId}`, { headers: cookie(adminSession) })
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.equal(json.data.school.county, 'Kirinyaga')
  assert.equal(json.data.school.ward, 'Kerugoya')
  assert.equal(json.data.school.contact_phone, '0712345678')
  assert.equal(json.data.school.motto, 'Excellence through learning')
})

test('an empty school_name is rejected by the existing schema (min length 1), unchanged', async () => {
  const res = await patchSchool(adminSession, { schoolId, school_name: '' })
  assert.equal(res.status, 422)
})
