// lib/core/permissions.classownership.test.ts
// Sprint 1B Batch C: every migrated app/api/teacher/classes/** route composes
// `resolveTeacher` (identity.ts) + `requireClassTeacher` (permissions.ts) in
// sequence — first "does this user have a teacher record at all" (403 if not),
// then "does this specific class belong to them" (404 or 403 depending on the
// route, per each route's preserved original convention). This is the one
// thing genuinely new across the whole batch (the individual primitives were
// already tested in Sprint 1A/Batch A) — this file tests the composition
// itself, including the two-tier distinction the migration depends on.
// Run with: npx tsx --env-file=.env.local --test lib/core/permissions.classownership.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { resolveTeacher } from '@/lib/core/identity'
import { requireClassTeacher } from '@/lib/core/permissions'
import { ResourceOwnershipError } from '@/lib/core/errors'

const SYNTHETIC_MARKER = 'SYNTHETIC_CLASSOWNERSHIP_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

let teacherAUserId: string, teacherAEmail: string, teacherAId: string
let teacherBUserId: string, teacherBEmail: string, teacherBId: string
let noTeacherUserId: string, noTeacherEmail: string
let classAId: string, classBId: string

before(async () => {
  const mkUser = async (label: string) => {
    const email = `classown-test-${label}-${Date.now()}@example.com`
    const { data } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    return { id: data!.user.id, email }
  }

  const teacherA = await mkUser('teacher-a'); teacherAUserId = teacherA.id; teacherAEmail = teacherA.email
  const teacherB = await mkUser('teacher-b'); teacherBUserId = teacherB.id; teacherBEmail = teacherB.email
  const noTeacher = await mkUser('no-teacher'); noTeacherUserId = noTeacher.id; noTeacherEmail = noTeacher.email

  const { data: rowA } = await db.from('teachers').insert({ user_id: teacherAUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherAId = rowA!.id
  const { data: rowB } = await db.from('teachers').insert({ user_id: teacherBUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherBId = rowB!.id
  // noTeacherUserId deliberately gets NO `teachers` row — simulates an
  // authenticated user (e.g. a parent/student account) hitting a teacher route.

  const { data: clsA } = await db.from('teacher_classes').insert({
    teacher_id: teacherAId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `SYNTH-A-${Date.now()}`,
  }).select('id').single()
  classAId = clsA!.id

  const { data: clsB } = await db.from('teacher_classes').insert({
    teacher_id: teacherBId, name: SYNTHETIC_MARKER, grade: 9, subject: 'English', class_code: `SYNTH-B-${Date.now()}`,
  }).select('id').single()
  classBId = clsB!.id
})

after(async () => {
  await db.from('teacher_classes').delete().in('id', [classAId, classBId])
  await db.from('teachers').delete().in('id', [teacherAId, teacherBId])
  for (const id of [teacherAUserId, teacherBUserId, noTeacherUserId]) {
    await db.auth.admin.deleteUser(id)
  }
})

test('the owning teacher passes both gates for their own class', async () => {
  const teacher = await resolveTeacher(teacherAUserId)
  assert.ok(teacher, 'resolveTeacher gate: teacher record must exist')

  const client = await signInAs(teacherAEmail)
  const user = await requireClassTeacher(client, classAId)
  assert.equal(user.id, teacherAUserId, 'requireClassTeacher gate: must resolve to the owning teacher')
})

test('a user with NO teacher record fails at the resolveTeacher gate (403 branch), not the class-ownership gate', async () => {
  const teacher = await resolveTeacher(noTeacherUserId)
  assert.equal(teacher, null, 'must fail the "does a teacher record exist" gate first')
})

test('a real teacher who does not own this specific class fails at the requireClassTeacher gate (404/403 branch, per-route), not the resolveTeacher gate', async () => {
  // Teacher B DOES have a teacher record (passes gate 1) but does not own class A.
  const teacher = await resolveTeacher(teacherBUserId)
  assert.ok(teacher, 'gate 1 (has a teacher record) must pass for teacher B')

  const client = await signInAs(teacherBEmail)
  await assert.rejects(() => requireClassTeacher(client, classAId), ResourceOwnershipError)
})

test('teacher B CAN access their own class B (sanity check — the isolation above is class-specific, not teacher B being globally denied)', async () => {
  const client = await signInAs(teacherBEmail)
  const user = await requireClassTeacher(client, classBId)
  assert.equal(user.id, teacherBUserId)
})

test('a user with no teacher record is also rejected by requireClassTeacher directly (defense in depth if a route skipped gate 1)', async () => {
  const client = await signInAs(noTeacherEmail)
  await assert.rejects(() => requireClassTeacher(client, classAId), ResourceOwnershipError)
})
