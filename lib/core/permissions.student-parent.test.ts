// lib/core/permissions.student-parent.test.ts
// Sprint 1B Batch B: tests for `requireStudent`/`requireParent`, the two
// permission functions app/api/assessments/create and
// app/api/reports/report-card now rely on — untested until this batch
// actually exercised them (Sprint 1A's suite only covered the school-scoped
// functions). Integration tests against real synthetic rows, following the
// lib/holiday/notify.test.ts convention.
// Run with: npx tsx --env-file=.env.local --test lib/core/permissions.student-parent.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { requireStudent, requireParent } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { asStudentId } from '@/lib/core/identityTypes'

const SYNTHETIC_MARKER = 'SYNTHETIC_STUDENT_PARENT_PERM_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

// Two families (student + parent), each with their own child, to prove
// cross-family isolation, not just "isn't linked to anyone."
let studentAUserId: string, studentAEmail: string, studentAId: string
let parentAUserId: string, parentAEmail: string
let studentBUserId: string, studentBEmail: string, studentBId: string
let parentBUserId: string, parentBEmail: string
let outsiderUserId: string, outsiderEmail: string

before(async () => {
  const mkUser = async (label: string) => {
    const email = `stparent-test-${label}-${Date.now()}@example.com`
    const { data } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    return { id: data!.user.id, email }
  }

  const studentA = await mkUser('student-a'); studentAUserId = studentA.id; studentAEmail = studentA.email
  const parentA = await mkUser('parent-a'); parentAUserId = parentA.id; parentAEmail = parentA.email
  const studentB = await mkUser('student-b'); studentBUserId = studentB.id; studentBEmail = studentB.email
  const parentB = await mkUser('parent-b'); parentBUserId = parentB.id; parentBEmail = parentB.email
  const outsider = await mkUser('outsider'); outsiderUserId = outsider.id; outsiderEmail = outsider.email

  const { data: rowA } = await db.from('students').insert({
    user_id: studentAUserId, parent_user_id: parentAUserId, name: SYNTHETIC_MARKER,
    grade: 8, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'parent',
  }).select('id').single()
  studentAId = rowA!.id

  const { data: rowB } = await db.from('students').insert({
    user_id: studentBUserId, parent_user_id: parentBUserId, name: SYNTHETIC_MARKER,
    grade: 8, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'parent',
  }).select('id').single()
  studentBId = rowB!.id
})

after(async () => {
  await db.from('students').delete().in('id', [studentAId, studentBId])
  for (const id of [studentAUserId, parentAUserId, studentBUserId, parentBUserId, outsiderUserId]) {
    await db.auth.admin.deleteUser(id)
  }
})

test('requireStudent resolves for the learner\'s own record', async () => {
  const client = await signInAs(studentAEmail)
  const user = await requireStudent(client, studentAId)
  assert.equal(user.id, studentAUserId)
})

test('requireStudent throws ResourceOwnershipError when a student tries to access another learner\'s record', async () => {
  const client = await signInAs(studentAEmail)
  await assert.rejects(() => requireStudent(client, studentBId), ResourceOwnershipError)
})

test('requireStudent throws UnauthorizedError for no session', async () => {
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await assert.rejects(() => requireStudent(anon, studentAId), UnauthorizedError)
})

test('requireParent resolves for the registered guardian', async () => {
  const client = await signInAs(parentAEmail)
  const user = await requireParent(client, asStudentId(studentAId))
  assert.equal(user.id, parentAUserId)
})

test('requireParent throws ResourceOwnershipError for cross-parent access (parent B cannot view student A)', async () => {
  const client = await signInAs(parentBEmail)
  await assert.rejects(() => requireParent(client, asStudentId(studentAId)), ResourceOwnershipError)
})

test('requireParent throws ResourceOwnershipError for a user linked to no learner at all', async () => {
  const client = await signInAs(outsiderEmail)
  await assert.rejects(() => requireParent(client, asStudentId(studentAId)), ResourceOwnershipError)
})

test('parent B CAN access their own child (sanity check the isolation test isn\'t just "always false")', async () => {
  const client = await signInAs(parentBEmail)
  const user = await requireParent(client, asStudentId(studentBId))
  assert.equal(user.id, parentBUserId)
})
