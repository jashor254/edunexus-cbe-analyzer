// lib/core/schoolCreation.test.ts
//
// DR-06 (Phase 10 rehearsal finding) — a double-submitted "Create School"
// request used to create a second, fully-activated school for the same
// principal. Proves createSchool() (lib/core/school.ts) now collapses a
// same-creator, same-name, within-window retry into the existing school,
// while a genuinely different school (different name, or a different
// creator) is still created normally.
//
// Run: npx tsx --env-file=.env.local --test lib/core/schoolCreation.test.ts

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { createSchool } from '@/lib/core/school'

const SYNTHETIC_MARKER = 'SYNTHETIC_DR06_SCHOOL_CREATION_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string) {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: 'Test!12345678', email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

after(async () => {
  for (const id of createdSchoolIds) {
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdAuthUserIds) await db.auth.admin.deleteUser(id)
})

test('a same-name retry for the same creator returns the SAME school, not a duplicate', async () => {
  const admin = await mkAuthUser('retry')
  const name = `${SYNTHETIC_MARKER}-Retry-School-${Date.now()}`

  const first = await createSchool({ school_name: name }, admin.id)
  createdSchoolIds.push(first.school.id)

  const second = await createSchool({ school_name: name }, admin.id)
  if (second.school.id !== first.school.id) createdSchoolIds.push(second.school.id)

  assert.equal(second.school.id, first.school.id, 'the retry resolved to the original school, not a new one')
  assert.equal(second.schoolUser.id, first.schoolUser.id, 'same admin membership, not a second one')

  const { count } = await db.from('schools').select('id', { count: 'exact', head: true }).eq('created_by', admin.id).eq('school_name', name)
  assert.equal(count, 1, 'exactly one school row exists for this creator+name')
})

test('a genuinely different school name for the same creator is NOT collapsed — a founder can create a second real institution', async () => {
  const admin = await mkAuthUser('second-real')
  const firstName = `${SYNTHETIC_MARKER}-First-${Date.now()}`
  const secondName = `${SYNTHETIC_MARKER}-Second-${Date.now()}`

  const first = await createSchool({ school_name: firstName }, admin.id)
  createdSchoolIds.push(first.school.id)
  const second = await createSchool({ school_name: secondName }, admin.id)
  createdSchoolIds.push(second.school.id)

  assert.notEqual(second.school.id, first.school.id, 'a different school name creates a real second school')
})

test('the same school name from a DIFFERENT creator is not collapsed into someone else\'s school', async () => {
  const adminA = await mkAuthUser('name-clash-a')
  const adminB = await mkAuthUser('name-clash-b')
  const sharedName = `${SYNTHETIC_MARKER}-Shared-Name-${Date.now()}`

  const first = await createSchool({ school_name: sharedName }, adminA.id)
  createdSchoolIds.push(first.school.id)
  const second = await createSchool({ school_name: sharedName }, adminB.id)
  createdSchoolIds.push(second.school.id)

  assert.notEqual(second.school.id, first.school.id, 'a different creator gets their own school even with a matching name')
  assert.equal(second.schoolUser.user_id, adminB.id)
})
