// lib/repositories/findSchoolIdByTeacherId.integration.test.ts
//
// Sprint 4G (docs/engineering/sprint-4f-teacher-school-identity-audit.md,
// docs/engineering/implementation-log.md): validates
// SchoolRepository::findSchoolIdByTeacherId — the reverse teacher→school
// identity lookup — against real, synthetic (throwaway) data built with the
// exact same linkage pattern the Reference School fixture's legacy bridge
// (scripts/reference-school/06-seed-legacy-bridge.ts) uses: a legacy
// `teachers` row and a Core `school_users` row sharing the same
// `auth.users.id`. The actual "Mwatate Ridge Senior School" reference
// fixture is not seeded in every environment this test may run in (it
// wasn't seeded in the environment this sprint was implemented in — confirmed
// via a live query before writing this test, not assumed) — this test
// proves the identical query path (teachers.user_id → school_users.user_id
// → school_id) against real Supabase writes instead, which is what the
// method actually executes regardless of which teacher/school pair it's
// pointed at.
//
// ⚠️ Creates real (throwaway) auth.users accounts, a school, a school_users
// row, and legacy teachers rows — all deleted in `after()`, including on
// failure.
//
// Run: npx tsx --env-file=.env.local --test lib/repositories/findSchoolIdByTeacherId.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_4G_IDENTITY_TEST'
const db = createServiceClient()

let bridgedAuthUserId: string
let unbridgedAuthUserId: string
let schoolId: string
let bridgedTeacherId: string
let unbridgedTeacherId: string

before(async () => {
  const { data: bridgedAuth, error: bridgedAuthErr } = await db.auth.admin.createUser({
    email: `sprint4g-bridged-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (bridgedAuthErr) throw bridgedAuthErr
  bridgedAuthUserId = bridgedAuth.user.id

  const { data: unbridgedAuth, error: unbridgedAuthErr } = await db.auth.admin.createUser({
    email: `sprint4g-unbridged-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (unbridgedAuthErr) throw unbridgedAuthErr
  unbridgedAuthUserId = unbridgedAuth.user.id

  const school = await repos.schools.create({ school_name: SYNTHETIC_MARKER }, bridgedAuthUserId)
  schoolId = school.id

  // The bridge: same auth.users.id on both a Core school_users row and a
  // legacy teachers row — exactly the pattern 06-seed-legacy-bridge.ts uses.
  await repos.schools.addSchoolUser(schoolId, bridgedAuthUserId, 'teacher')

  const { data: bridgedTeacher, error: bridgedTeacherErr } = await db
    .from('teachers')
    .insert({ user_id: bridgedAuthUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (bridgedTeacherErr) throw bridgedTeacherErr
  bridgedTeacherId = bridgedTeacher.id

  // Deliberately NOT added to school_users — proves the negative case.
  const { data: unbridgedTeacher, error: unbridgedTeacherErr } = await db
    .from('teachers')
    .insert({ user_id: unbridgedAuthUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (unbridgedTeacherErr) throw unbridgedTeacherErr
  unbridgedTeacherId = unbridgedTeacher.id
})

after(async () => {
  await db.from('teachers').delete().eq('user_id', bridgedAuthUserId)
  await db.from('teachers').delete().eq('user_id', unbridgedAuthUserId)
  // school_users row cascades on school delete (ON DELETE CASCADE per
  // supabase/migrations/20260629_core_foundation.sql)
  if (schoolId) await db.from('schools').delete().eq('id', schoolId)
  if (bridgedAuthUserId) await deleteAuthUserOrThrow(db, bridgedAuthUserId)
  if (unbridgedAuthUserId) await deleteAuthUserOrThrow(db, unbridgedAuthUserId)
})

test('teacherId → teacher.user_id → school_users.user_id → schoolId resolves correctly for a bridged teacher', async () => {
  const resolved = await repos.schools.findSchoolIdByTeacherId(bridgedTeacherId)
  assert.equal(resolved, schoolId)
})

test('returns null for a teacher with no school_users row (the common, unbridged case)', async () => {
  const resolved = await repos.schools.findSchoolIdByTeacherId(unbridgedTeacherId)
  assert.equal(resolved, null)
})

test('returns null for a teacherId that does not exist at all', async () => {
  const resolved = await repos.schools.findSchoolIdByTeacherId('00000000-0000-0000-0000-000000000000')
  assert.equal(resolved, null)
})
