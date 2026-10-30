// lib/core/studentsBridgeIntegrity.integration.test.ts
//
// Security audit 2026-10-30, F-04 / F-09, against a real database:
//   - a signed-in client can no longer write the bridge, ownership or
//     computed fields of a students row (fn_guard_students_server_fields,
//     supabase/migrations/20261030122000_students_guard_server_fields.sql),
//     while the client writes the app actually makes still succeed;
//   - the service role (every legitimate writer of those fields) still can;
//   - a user-owned row carrying a learner's external_id — one planted before
//     the guard existed — is never resolved as that learner's bridge.
//
// The trigger-dependent negative tests below SUCCEEDED (i.e. failed as
// tests) against the pre-migration schema.
//
// Run with: npm run test:deep (TEST_SUPABASE_* pointed at a disposable stack)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createTestServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { resolveLegacyStudentId } from '@/lib/core/identity'
import { asLearnerId } from '@/lib/core/identityTypes'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const MARKER = 'SYNTHETIC_BRIDGE_INTEGRITY'
const db = createTestServiceClient()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function signIn(email: string, password: string) {
  const c = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn: ${error.message}`)
  return c
}

let userId: string
let client: Awaited<ReturnType<typeof signIn>>
let ownStudentId: string
let teacherRowId: string

before(async () => {
  const email = `bridge-${Date.now()}-${randomBytes(3).toString('hex')}-synthetic@example.com`
  const password = `Test!${randomBytes(8).toString('hex')}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`user: ${error?.message}`)
  userId = data.user.id
  client = await signIn(email, password)

  const { data: teacher, error: tErr } = await db.from('teachers').insert({ user_id: userId, full_name: `${MARKER} teacher`, school: MARKER }).select('id').single()
  if (tErr || !teacher) throw new Error(`teacher: ${tErr?.message}`)
  teacherRowId = teacher.id
})

after(async () => {
  // Every fixture row carries school = MARKER.
  const del = await db.from('students').delete().eq('school', MARKER)
  if (del.error) throw new Error(`cleanup students: ${del.error.message}`)
  const t = await db.from('teachers').delete().eq('id', teacherRowId)
  if (t.error) throw new Error(`cleanup teachers: ${t.error.message}`)
  if (userId) await deleteAuthUserOrThrow(db, userId)
})

test('a parent can still create their own learner the ordinary way', async () => {
  const { data, error } = await client.from('students')
    .insert({ user_id: userId, name: `${MARKER} own`, grade: 8, school: MARKER })
    .select('id').single()
  assert.equal(error, null)
  ownStudentId = data!.id
})

for (const [field, value] of [
  ['external_id', () => randomUUID()],
  ['added_by', () => 'teacher'],
  ['teacher_id', () => teacherRowId],
  ['parent_user_id', () => userId],
  ['capability_profile', () => ({ forged: true })],
] as const) {
  test(`a client cannot insert a learner with ${field} set`, async () => {
    const { error } = await client.from('students')
      .insert({ user_id: userId, name: `${MARKER} forged ${field}`, grade: 8, school: MARKER, [field]: value() })
    assert.ok(error, `${field} insert was accepted`)
  })
}

test('a client cannot change bridge or ownership fields on its own learner', async () => {
  for (const patch of [{ external_id: randomUUID() }, { teacher_id: teacherRowId }, { added_by: 'teacher' }, { parent_user_id: userId }]) {
    const { error } = await client.from('students').update(patch).eq('id', ownStudentId)
    assert.ok(error, `update ${Object.keys(patch)[0]} was accepted`)
  }
  const { data } = await db.from('students').select('external_id, teacher_id, added_by, parent_user_id').eq('id', ownStudentId).single()
  assert.deepEqual(data, { external_id: null, teacher_id: null, added_by: 'parent', parent_user_id: null })
})

test("the client update the app makes (clinic page: curriculum_type, year_level) still succeeds", async () => {
  const { error } = await client.from('students').update({ curriculum_type: 'cbc', year_level: 'Grade 8' }).eq('id', ownStudentId)
  assert.equal(error, null)
})

test('the service role (every legitimate writer) can still set bridge fields', async () => {
  const { error } = await db.from('students')
    .insert({ name: `${MARKER} bridge`, grade: 8, school: MARKER, added_by: 'system', teacher_id: teacherRowId, external_id: randomUUID() })
  assert.equal(error, null)
})

test("a user-owned row carrying a learner's external_id is never resolved as that learner's bridge", async () => {
  const plantedLearner = randomUUID()
  const genuineLearner = randomUUID()
  // Simulates a row planted BEFORE the guard existed (written here with the
  // service role, since a client can no longer create one).
  const planted = await db.from('students')
    .insert({ user_id: userId, name: `${MARKER} planted`, grade: 8, school: MARKER, external_id: plantedLearner })
    .select('id').single()
  if (planted.error) throw new Error(planted.error.message)
  const genuine = await db.from('students')
    .insert({ name: `${MARKER} genuine`, grade: 8, school: MARKER, added_by: 'system', teacher_id: teacherRowId, external_id: genuineLearner })
    .select('id').single()
  if (genuine.error) throw new Error(genuine.error.message)

  assert.equal(await repos.teachers.findLegacyStudentByExternalId(plantedLearner), null)
  assert.equal(await resolveLegacyStudentId(asLearnerId(plantedLearner)), null)
  const batch = await repos.teachers.findLegacyStudentsByExternalIds([plantedLearner, genuineLearner])
  assert.deepEqual(batch.map(r => r.id), [genuine.data.id])

  // The existing, genuine bridge still resolves.
  assert.deepEqual(await repos.teachers.findLegacyStudentByExternalId(genuineLearner), { id: genuine.data.id })
})
