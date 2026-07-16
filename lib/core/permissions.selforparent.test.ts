// lib/core/permissions.selforparent.test.ts
// Sprint 1B Batch F: app/api/parent/assessments/process and
// app/api/parent/whatsapp-optin both compose `requireStudent` OR
// `requireParent` locally (route-level, not a new lib/core function, per
// this sprint's "do not invent architecture" rule) to reproduce their
// original `student.user_id === user.id || student.parent_user_id === user.id`
// check. Both primitives are individually tested elsewhere (Batch B) — this
// file tests the one thing genuinely new: the UNION of the two, which no
// prior batch exercised together (a learner accessing their own record via
// this specific "self-or-parent" shape hadn't been tested before).
// Run with: npx tsx --env-file=.env.local --test lib/core/permissions.selforparent.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { requireStudent, requireParent } from '@/lib/core/permissions'

const SYNTHETIC_MARKER = 'SYNTHETIC_SELF_OR_PARENT_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

// Mirrors the exact composition used in the two migrated routes.
async function isSelfOrParentOf(client: SupabaseClient, studentId: string): Promise<boolean> {
  try { await requireStudent(client, studentId); return true } catch { /* fall through */ }
  try { await requireParent(client, studentId); return true } catch { return false }
}

let studentUserId: string, studentEmail: string, studentId: string
let parentUserId: string, parentEmail: string
let unrelatedUserId: string, unrelatedEmail: string

before(async () => {
  const mkUser = async (label: string) => {
    const email = `selforparent-test-${label}-${Date.now()}@example.com`
    const { data } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    return { id: data!.user.id, email }
  }

  const student = await mkUser('student'); studentUserId = student.id; studentEmail = student.email
  const parent = await mkUser('parent'); parentUserId = parent.id; parentEmail = parent.email
  const unrelated = await mkUser('unrelated'); unrelatedUserId = unrelated.id; unrelatedEmail = unrelated.email

  const { data: row } = await db.from('students').insert({
    user_id: studentUserId, parent_user_id: parentUserId, name: SYNTHETIC_MARKER,
    grade: 8, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'parent',
  }).select('id').single()
  studentId = row!.id
})

after(async () => {
  await db.from('students').delete().eq('id', studentId)
  for (const id of [studentUserId, parentUserId, unrelatedUserId]) {
    await db.auth.admin.deleteUser(id)
  }
})

test('isSelfOrParentOf is true when the caller IS the learner (self-access branch — previously untested in this exact union shape)', async () => {
  const client = await signInAs(studentEmail)
  assert.equal(await isSelfOrParentOf(client, studentId), true)
})

test('isSelfOrParentOf is true when the caller is the registered parent', async () => {
  const client = await signInAs(parentEmail)
  assert.equal(await isSelfOrParentOf(client, studentId), true)
})

test('isSelfOrParentOf is false for an unrelated account (neither the learner nor a registered parent)', async () => {
  const client = await signInAs(unrelatedEmail)
  assert.equal(await isSelfOrParentOf(client, studentId), false)
})

test('isSelfOrParentOf is false for an unauthenticated client', async () => {
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  assert.equal(await isSelfOrParentOf(anon, studentId), false)
})
