// lib/repositories/schoolRepository.multiMembership.test.ts
//
// Phase 1 self-serve onboarding, Task 4 — proves findSchoolUserByUserId()
// degrades gracefully instead of throwing when a user holds more than one
// active school_users row (the exact shape app/admin/core-schools/new's
// founder-as-repeat-creator workflow legitimately produces). Also proves
// the properly schoolId-scoped authorization path (requireSchoolAdmin, via
// getSchoolUser) is completely unaffected by a second membership elsewhere
// — the regression this task explicitly asked to guard: a second
// membership must not brick access to a KNOWN school.
//
// Run: npx tsx --env-file=.env.local --test lib/repositories/schoolRepository.multiMembership.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { resolveMembership } from '@/lib/core/identity'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_PHASE1_MULTI_MEMBERSHIP_TEST'
const db = createServiceClient()

let multiUserId: string
let schoolAId: string
let schoolBId: string

before(async () => {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${Date.now()}@example.com`
  const { data } = await db.auth.admin.createUser({ email, password: 'Test!12345678', email_confirm: true })
  multiUserId = data!.user.id

  const schoolA = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-A` }, multiUserId)
  const schoolB = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-B` }, multiUserId)
  schoolAId = schoolA.id
  schoolBId = schoolB.id

  // Mirrors exactly what app/admin/core-schools/new produces: the same
  // founder becomes school_admin of two different schools, both active.
  await db.from('school_users').insert([
    { school_id: schoolAId, user_id: multiUserId, role: 'school_admin', is_active: true },
    { school_id: schoolBId, user_id: multiUserId, role: 'school_admin', is_active: true },
  ])
})

after(async () => {
  for (const schoolId of [schoolAId, schoolBId]) {
    await db.from('school_users').delete().eq('school_id', schoolId)
    await db.from('schools').delete().eq('id', schoolId)
  }
  await deleteAuthUserOrThrow(db, multiUserId)
})

test('findSchoolUserByUserId does not throw for a user with two active memberships', async () => {
  const membership = await repos.schools.findSchoolUserByUserId(multiUserId)
  assert.ok(membership, 'expected a membership to be returned, not an exception')
  assert.ok([schoolAId, schoolBId].includes(membership!.school_id))
})

test('findSchoolUserByUserId is deterministic — repeated calls return the same membership', async () => {
  const first = await repos.schools.findSchoolUserByUserId(multiUserId)
  const second = await repos.schools.findSchoolUserByUserId(multiUserId)
  assert.equal(first!.school_id, second!.school_id)
  assert.equal(first!.id, second!.id)
})

test('a second membership elsewhere does not brick admin access to a KNOWN school (the scoped authorization path)', async () => {
  // resolveMembership(userId, schoolId) -> getSchoolUser is exactly what
  // requireSchoolMembership/requireSchoolAdmin call once a route already
  // knows which school it's acting on — unlike findSchoolUserByUserId
  // above, it takes schoolId directly and was never affected by this bug.
  const membershipA = await resolveMembership(multiUserId, schoolAId)
  const membershipB = await resolveMembership(multiUserId, schoolBId)
  assert.ok(membershipA, 'access to school A must resolve even though the user also has an active membership at school B')
  assert.equal(membershipA!.schoolId, schoolAId)
  assert.ok(membershipB, 'access to school B must resolve even though the user also has an active membership at school A')
  assert.equal(membershipB!.schoolId, schoolBId)
})
