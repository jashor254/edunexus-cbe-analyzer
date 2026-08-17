// lib/core/resolveTeacherGradeBoundaries.integration.test.ts
//
// Sprint 4I (docs/engineering/sprint-4f-teacher-school-identity-audit.md,
// docs/engineering/implementation-log.md): validates
// resolveTeacherGradeBoundaries — the glue connecting Sprint 4G's
// findSchoolIdByTeacherId to school_settings.grade_boundaries, now used by
// both app/api/teacher/analytics/route.ts and
// app/api/teacher/cohort/[grade]/route.ts — against real, throwaway
// Supabase data, extending Sprint 4G's own bridge-creation pattern with a
// school_settings row.
//
// ⚠️ Creates real (throwaway) auth.users accounts, a school, a
// school_settings row, a school_users row, and legacy teachers rows — all
// deleted in `after()`, including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/core/resolveTeacherGradeBoundaries.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { resolveTeacherGradeBoundaries } from '@/lib/core/school'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_4I_BOUNDARY_TEST'
const db = createServiceClient()

const CUSTOM_BOUNDARIES = { EE: { min: 82 }, ME: { min: 62 }, AE: { min: 42 } }

let bridgedAuthUserId: string
let unbridgedAuthUserId: string
let schoolId: string
let bridgedTeacherId: string
let unbridgedTeacherId: string

before(async () => {
  const { data: bridgedAuth, error: bridgedAuthErr } = await db.auth.admin.createUser({
    email: `sprint4i-bridged-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (bridgedAuthErr) throw bridgedAuthErr
  bridgedAuthUserId = bridgedAuth.user.id

  const { data: unbridgedAuth, error: unbridgedAuthErr } = await db.auth.admin.createUser({
    email: `sprint4i-unbridged-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (unbridgedAuthErr) throw unbridgedAuthErr
  unbridgedAuthUserId = unbridgedAuth.user.id

  const school = await repos.schools.create({ school_name: SYNTHETIC_MARKER }, bridgedAuthUserId)
  schoolId = school.id

  await repos.schools.addSchoolUser(schoolId, bridgedAuthUserId, 'teacher')
  await repos.schools.upsertSettings(schoolId, { grade_boundaries: CUSTOM_BOUNDARIES })

  const { data: bridgedTeacher, error: bridgedTeacherErr } = await db
    .from('teachers')
    .insert({ user_id: bridgedAuthUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (bridgedTeacherErr) throw bridgedTeacherErr
  bridgedTeacherId = bridgedTeacher.id

  // Deliberately NOT added to school_users — the common, unbridged case.
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
  // school_settings and school_users both cascade on school delete
  // (ON DELETE CASCADE per supabase/migrations/20260629_core_foundation.sql)
  if (schoolId) await db.from('schools').delete().eq('id', schoolId)
  if (bridgedAuthUserId) await deleteAuthUserOrThrow(db, bridgedAuthUserId)
  if (unbridgedAuthUserId) await deleteAuthUserOrThrow(db, unbridgedAuthUserId)
})

test('BRIDGED: a teacher linked to a school with custom grade_boundaries resolves those exact boundaries', async () => {
  const resolved = await resolveTeacherGradeBoundaries(bridgedTeacherId)
  assert.deepEqual(resolved, CUSTOM_BOUNDARIES)
})

test('UNBRIDGED: a teacher with no school_users row resolves to {} (the default-boundary fallback)', async () => {
  const resolved = await resolveTeacherGradeBoundaries(unbridgedTeacherId)
  assert.deepEqual(resolved, {})
})

test('NONEXISTENT: a teacherId that does not exist at all resolves to {} (no crash)', async () => {
  const resolved = await resolveTeacherGradeBoundaries('00000000-0000-0000-0000-000000000000')
  assert.deepEqual(resolved, {})
})
