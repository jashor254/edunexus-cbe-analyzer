// lib/holiday/notify.test.ts
// Pure/no-external-call tests for Wave 6 (Parent Delivery). Does not send a
// real WhatsApp message — that requires live Meta Business API credentials
// and a real recipient, which this test suite deliberately never invokes.
// Run with: npx tsx --env-file=.env.local --test lib/holiday/notify.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { notifyParentOfHolidayReturn } from './notify'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_NOTIFY_TEST'
const db = createServiceClient()

let teacherId: string
let studentId: string
let authUserId: string

before(async () => {
  const { data: authUser } = await db.auth.admin.createUser({
    email: `notify-test-${Date.now()}@example.com`, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true,
  })
  authUserId = authUser!.user.id
  const { data: teacher } = await db.from('teachers').insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherId = teacher!.id
  // Deliberately no parent_phone set — the no-phone-on-file path.
  const { data: student } = await db.from('students').insert({ teacher_id: teacherId, name: 'No Phone Learner', grade: 8, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'teacher' }).select('id').single()
  studentId = student!.id
})

after(async () => {
  await db.from('notification_log').delete().eq('user_id', studentId)
  await db.from('students').delete().eq('id', studentId)
  await db.from('teachers').delete().eq('id', teacherId)
  await deleteAuthUserOrThrow(db, authUserId)
})

test('notifyParentOfHolidayReturn is a safe no-op when no parent phone is on file (never throws, never logs a send)', async () => {
  await notifyParentOfHolidayReturn({
    studentId, weeksAssigned: 4, weeksCompleted: 3,
    masteryClaims: [{ subject: 'mathematics', cbcLevel: 2 }],
  })

  const { data: logs } = await db.from('notification_log').select('id').eq('user_id', studentId)
  assert.equal((logs ?? []).length, 0, 'no WhatsApp send should have been attempted or logged without a phone on file')
})

test('notifyParentOfHolidayReturn never throws even if the student does not exist', async () => {
  await assert.doesNotReject(() =>
    notifyParentOfHolidayReturn({
      studentId: '00000000-0000-0000-0000-000000000000',
      weeksAssigned: 4, weeksCompleted: 2, masteryClaims: [],
    })
  )
})
