// lib/core/permissions.assessmentbatch.test.ts
// Sprint 1B Batch D: every migrated app/api/teacher/assessments/** route
// composes the same two gates already fully tested in Batch A-C's suites
// (`resolveTeacher`, `requireClassTeacher`) — this file does not re-test
// those primitives. It tests the one thing genuinely new to this batch:
// `process/route.ts` now sources the teacher's display name from
// `resolveTeacher().fullName` instead of a raw `teachers.full_name` query —
// a silent regression here would degrade the WhatsApp/report-generation
// teacher-name business logic to its "Your Teacher" fallback without any
// test failure elsewhere, since no other suite exercises that field in this
// exact composed shape (teacher lookup + class ownership, as every one of
// this batch's 8 routes now performs it).
// Run with: npx tsx --env-file=.env.local --test lib/core/permissions.assessmentbatch.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { resolveTeacher } from '@/lib/core/identity'
import { requireClassTeacher } from '@/lib/core/permissions'
import { ResourceOwnershipError } from '@/lib/core/errors'

const SYNTHETIC_MARKER = 'SYNTHETIC_ASSESSMENT_BATCH_TEST'
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
let classAId: string

before(async () => {
  const mkUser = async (label: string) => {
    const email = `assess-batch-test-${label}-${Date.now()}@example.com`
    const { data } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    return { id: data!.user.id, email }
  }

  const teacherA = await mkUser('teacher-a'); teacherAUserId = teacherA.id; teacherAEmail = teacherA.email
  const teacherB = await mkUser('teacher-b'); teacherBUserId = teacherB.id; teacherBEmail = teacherB.email

  const { data: rowA } = await db.from('teachers').insert({
    user_id: teacherAUserId, full_name: `${SYNTHETIC_MARKER}_Teacher_A_Name`, school: SYNTHETIC_MARKER,
  }).select('id').single()
  teacherAId = rowA!.id

  const { data: rowB } = await db.from('teachers').insert({
    user_id: teacherBUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER,
  }).select('id').single()
  teacherBId = rowB!.id

  const { data: clsA } = await db.from('teacher_classes').insert({
    teacher_id: teacherAId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `SYNTH-D-${Date.now()}`,
  }).select('id').single()
  classAId = clsA!.id
})

after(async () => {
  await db.from('teacher_classes').delete().eq('id', classAId)
  await db.from('teachers').delete().in('id', [teacherAId, teacherBId])
  for (const id of [teacherAUserId, teacherBUserId]) {
    await db.auth.admin.deleteUser(id)
  }
})

test('resolveTeacher returns fullName correctly, matching what process/route.ts now relies on for the teacherName fallback chain (was previously a raw query selecting full_name)', async () => {
  const teacher = await resolveTeacher(teacherAUserId)
  assert.ok(teacher)
  assert.equal(teacher!.fullName, `${SYNTHETIC_MARKER}_Teacher_A_Name`)
})

test('the full composition every Batch D route now performs (resolveTeacher then requireClassTeacher) succeeds end-to-end for the owning teacher', async () => {
  const teacher = await resolveTeacher(teacherAUserId)
  assert.ok(teacher, 'gate 1: teacher record must exist')

  const client = await signInAs(teacherAEmail)
  const user = await requireClassTeacher(client, classAId)
  assert.equal(user.id, teacherAUserId, 'gate 2: class ownership must resolve to the same teacher')
})

test('the same composition rejects a teacher who does not own the assessment\'s class (wrong-teacher / assessment-adjacent isolation)', async () => {
  const teacher = await resolveTeacher(teacherBUserId)
  assert.ok(teacher, 'teacher B has a valid teacher record (gate 1 passes)')

  const client = await signInAs(teacherBEmail)
  await assert.rejects(() => requireClassTeacher(client, classAId), ResourceOwnershipError)
})
