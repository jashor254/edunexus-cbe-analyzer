// lib/core/studentGuardiansEscalation.integration.test.ts
//
// Pre-deployment audit 2026-10-30, AUDIT-F15 (pre-existing, found while
// verifying the remediation): a signed-in user must NOT be able to make
// themselves a learner's guardian by inserting a student_guardians row.
//
// Why it matters: auth_is_guardian_of(student_id) reads student_guardians and
// gates the SELECT policy ("student or guardian") on six learner-report
// tables (clinic_reports, academic_reports, compass_progress,
// learning_compass_configs, learning_compass_state, struggle_patterns). The
// only INSERT policy checked merely guardian_id = auth.uid(), so any user
// could name themselves guardian of any learner and, where those tables
// enforce RLS, read the learner's reports.
//
// Closed by supabase/migrations/20261030124000_student_guardians_close_self_insert.sql.
// Against the pre-migration schema the first assertion below FAILS (the
// self-insert succeeds).
//
// This test asserts the INSERT boundary, which is exactly what F-15 controls.
// The end-to-end read protection on those six tables additionally depends on
// RLS being ENABLED on them — see AUDIT-F16: the committed-migration schema
// leaves RLS DISABLED on clinic_reports and four siblings, so the read path
// is not gated on the repo schema regardless of this fix, and that is a
// production-verification item, not something this test can prove here.
//
// Run with: npm run test:deep (TEST_SUPABASE_* pointed at a disposable stack)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createTestServiceClient } from '@/utils/supabase/test-service'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const MARKER = 'SYNTHETIC_GUARDIAN_ESCALATION'
const db = createTestServiceClient()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function mkUser(label: string) {
  const email = `guardian-esc-${label}-${Date.now()}-${randomBytes(3).toString('hex')}-synthetic@example.com`
  const password = `Test!${randomBytes(8).toString('hex')}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`mkUser: ${error?.message}`)
  userIds.push(data.user.id)
  const client = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw new Error(`signIn: ${signInError.message}`)
  return { id: data.user.id, client }
}

const userIds: string[] = []
let victimStudentId: string
let attacker: Awaited<ReturnType<typeof mkUser>>['client']
let attackerId: string

before(async () => {
  const victimParent = await mkUser('victim-parent')
  const { data: student, error } = await db.from('students')
    .insert({ user_id: victimParent.id, name: `${MARKER} victim`, grade: 8, school: MARKER })
    .select('id').single()
  if (error || !student) throw new Error(`student: ${error?.message}`)
  victimStudentId = student.id

  const a = await mkUser('attacker')
  attacker = a.client
  attackerId = a.id
})

after(async () => {
  await db.from('student_guardians').delete().eq('student_id', victimStudentId)
  await db.from('students').delete().eq('id', victimStudentId)
  for (const id of userIds) await deleteAuthUserOrThrow(db, id)
})

test('a stranger cannot insert a student_guardians row naming themselves guardian of a learner', async () => {
  const { error } = await attacker.from('student_guardians')
    .insert({ student_id: victimStudentId, guardian_id: attackerId, relationship: 'mother' })
  assert.ok(error, 'self-insert into student_guardians was accepted')
  const { data } = await db.from('student_guardians').select('id').eq('student_id', victimStudentId)
  assert.equal((data ?? []).length, 0, 'an attacker guardian row exists')
})

test('the service role can still manage student_guardians (legitimate server writes unaffected)', async () => {
  const { error } = await db.from('student_guardians')
    .insert({ student_id: victimStudentId, guardian_id: attackerId, relationship: 'mother' })
  assert.equal(error, null, 'service-role insert was blocked')
  await db.from('student_guardians').delete().eq('student_id', victimStudentId)
})
