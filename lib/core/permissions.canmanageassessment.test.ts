// lib/core/permissions.canmanageassessment.test.ts
//
// Error-Handling Trust Fix — canManageAssessment used to catch every error
// from requireClassTeacher and convert it to `false`, so a DB outage or a
// programming error inside requireClassTeacher was indistinguishable from an
// ordinary "you don't own this class" denial. The fix classifies the catch:
// EduNexusError subclasses (genuine auth/ownership denials) still become
// `false`; anything else rethrows.
//
// Integration test against real (synthetic, cleaned-up) rows and real
// authenticated sessions for the two behaviorally-reachable cases (owning
// teacher -> true, non-owning teacher -> false). A genuine "unexpected
// infra error" cannot be forced through the real stack here: every layer
// canManageAssessment calls through (resolveTeacher, getSchoolUser) already
// destructures away raw Postgres errors into `null` before they would ever
// reach this function's catch — a separate, pre-existing pattern in
// lib/core/identity.ts, out of this patch's scope. The classification
// predicate itself (isEduNexusError) is verified directly below instead.
//
// Run with: npx tsx --env-file=.env.local --test lib/core/permissions.canmanageassessment.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { canManageAssessment } from '@/lib/core/permissions'
import { isEduNexusError, ResourceOwnershipError, UnauthorizedError } from '@/lib/core/errors'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_CANMANAGEASSESSMENT_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

let schoolId: string
let teacherAUserId: string, teacherAEmail: string, teacherAId: string
let teacherBUserId: string, teacherBEmail: string, teacherBId: string
let classId: string

before(async () => {
  const mkUser = async (label: string) => {
    const email = `canmanage-test-${label}-${Date.now()}@example.com`
    let lastError: unknown
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
        if (!error) return { id: data.user.id, email }
        lastError = error
      } catch (err) {
        lastError = err
      }
      await new Promise(resolve => setTimeout(resolve, 500 * attempt))
    }
    throw lastError
  }

  const teacherA = await mkUser('teacher-a')
  teacherAUserId = teacherA.id; teacherAEmail = teacherA.email
  const teacherB = await mkUser('teacher-b')
  teacherBUserId = teacherB.id; teacherBEmail = teacherB.email

  const { data: school } = await db.from('schools').insert({ school_name: SYNTHETIC_MARKER }).select('id').single()
  schoolId = school!.id

  const { data: rowA } = await db.from('teachers').insert({
    user_id: teacherAUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER,
  }).select('id').single()
  teacherAId = rowA!.id

  const { data: rowB } = await db.from('teachers').insert({
    user_id: teacherBUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER,
  }).select('id').single()
  teacherBId = rowB!.id

  const { data: cls } = await db.from('teacher_classes').insert({
    teacher_id: teacherAId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `SYNTH-CMA-${Date.now()}`,
  }).select('id').single()
  classId = cls!.id
})

after(async () => {
  await db.from('teacher_classes').delete().eq('id', classId)
  await db.from('teachers').delete().in('id', [teacherAId, teacherBId])
  await db.from('schools').delete().eq('id', schoolId)
  for (const id of [teacherAUserId, teacherBUserId]) await deleteAuthUserOrThrow(db, id)
})

test('the owning teacher can manage the assessment', async () => {
  const client = await signInAs(teacherAEmail)
  const result = await canManageAssessment(client, schoolId, classId)
  assert.equal(result, true)
})

test('a teacher who does not own the class is denied, not thrown at', async () => {
  const client = await signInAs(teacherBEmail)
  const result = await canManageAssessment(client, schoolId, classId)
  assert.equal(result, false)
})

test('classification predicate: EduNexusError subclasses are treated as genuine denials', () => {
  assert.equal(isEduNexusError(new ResourceOwnershipError()), true)
  assert.equal(isEduNexusError(new UnauthorizedError()), true)
})

test('classification predicate: a plain Error (infra/programming failure) is NOT treated as a genuine denial', () => {
  assert.equal(isEduNexusError(new Error('connection reset')), false)
  assert.equal(isEduNexusError(new TypeError('cannot read property of undefined')), false)
})
