// lib/curriculum/pathwayContract.integration.test.ts
//
// Learner Pathway Contract Fix — the shared regression test for the core
// invariant this fix restores:
//
//   A learner pathway accepted by EduNexus application validation must be
//   accepted by the database.
//
// `SENIOR_PATHWAYS` (this file's import) is the single source of truth every
// pathway-accepting route/validator (app/api/students/create,
// app/api/teacher/classes/[classId]/students, lib/career/careerEngine.ts,
// lib/validation/helpers.ts) now reuses instead of a locally hardcoded array.
// This test proves every one of its values round-trips through the real
// `students.current_pathway` column (live `students_current_pathway_check`
// CHECK constraint), and that a value NOT in the contract is rejected by the
// DB — so future drift between the app-layer contract and the DB constraint
// is caught here automatically, without needing to know which route broke it.
//
// Run with: npx tsx --env-file=.env.local --test lib/curriculum/pathwayContract.integration.test.ts
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { SENIOR_PATHWAYS } from '@/lib/curriculum/subjects'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_PATHWAY_CONTRACT_TEST'
const db = createServiceClient()

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

const createdUserIds: string[] = []
const createdStudentIds: string[] = []

after(async () => {
  if (createdStudentIds.length) await db.from('students').delete().in('id', createdStudentIds)
  for (const id of createdUserIds) await deleteAuthUserOrThrow(db, id)
})

test('every SENIOR_PATHWAYS value can be inserted directly into students.current_pathway', async () => {
  for (const pathway of SENIOR_PATHWAYS) {
    const email = `${SYNTHETIC_MARKER.toLowerCase()}-${pathway.replace(/\W+/g, '-')}-${Date.now()}@example.com`
    const { data: authUser } = await retryAsync(async () => {
      const res = await db.auth.admin.createUser({ email, password: 'Test!12345678', email_confirm: true })
      if (res.error) throw res.error
      return res
    })
    createdUserIds.push(authUser.user.id)

    const { data: student, error } = await db
      .from('students')
      .insert({ user_id: authUser.user.id, name: `${SYNTHETIC_MARKER} Learner`, grade: 11, current_pathway: pathway })
      .select('id, current_pathway')
      .single()

    assert.equal(error, null, `"${pathway}" (a value application validation accepts) must also be accepted by the DB CHECK constraint — got: ${error?.message}`)
    assert.equal(student?.current_pathway, pathway)
    createdStudentIds.push(student!.id)
  }
})

test('a non-canonical pathway value is rejected by the live students_current_pathway_check constraint', async () => {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-invalid-${Date.now()}@example.com`
  const { data: authUser } = await retryAsync(async () => {
    const res = await db.auth.admin.createUser({ email, password: 'Test!12345678', email_confirm: true })
    if (res.error) throw res.error
    return res
  })
  createdUserIds.push(authUser.user.id)

  const { data, error } = await db
    .from('students')
    .insert({ user_id: authUser.user.id, name: `${SYNTHETIC_MARKER} Learner`, grade: 11, current_pathway: 'Not A Real Pathway' })
    .select('id')
    .single()

  assert.ok(error, 'a non-canonical pathway value must be rejected by the DB, not silently accepted')
  assert.equal(error?.code, '23514', 'expected a CHECK constraint violation (23514)')
  assert.equal(data, null)
})

test('the previously-broken "Arts & Sports Science" value specifically now succeeds (the confirmed bug)', async () => {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-artsci-${Date.now()}@example.com`
  const { data: authUser } = await retryAsync(async () => {
    const res = await db.auth.admin.createUser({ email, password: 'Test!12345678', email_confirm: true })
    if (res.error) throw res.error
    return res
  })
  createdUserIds.push(authUser.user.id)

  const { data: student, error } = await db
    .from('students')
    .insert({ user_id: authUser.user.id, name: `${SYNTHETIC_MARKER} Learner`, grade: 11, current_pathway: 'Arts & Sports Science' })
    .select('id')
    .single()

  assert.equal(error, null)
  createdStudentIds.push(student!.id)
})

test('no existing students row retains the old short-form "Arts & Sports" value (legacy data correctly normalized/absent)', async () => {
  const { data, error } = await db.from('students').select('id').eq('current_pathway', 'Arts & Sports')
  assert.equal(error, null)
  assert.equal(data?.length, 0, 'no row should carry the old pre-fix pathway value after the migration')
})
