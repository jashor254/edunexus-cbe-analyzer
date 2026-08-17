// lib/testing/deleteAuthUserOrThrow.integration.test.ts
//
// H4A / OPS-TEST-001 — proves the actual DEEP_MAIN cleanup-residual root
// cause against a real local Supabase instance, and proves the fix.
//
// Run: npx tsx --env-file=.env.local --experimental-test-module-mocks --test lib/testing/deleteAuthUserOrThrow.integration.test.ts
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { deleteAuthUserOrThrow } from './deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_OPS_TEST_001'
const db = createServiceClient()
const createdUserIds: string[] = []
const createdNotificationLogIds: string[] = []

after(async () => {
  // Real cleanup for whatever this file itself created, in the correct
  // order — the exact discipline the pre-H4A suite's bare deleteUser calls
  // were missing.
  if (createdNotificationLogIds.length) await db.from('notification_log').delete().in('id', createdNotificationLogIds)
  for (const id of createdUserIds) await deleteAuthUserOrThrow(db, id)
})

test('OPS-TEST-001 FINDING: db.auth.admin.deleteUser() never rejects on a dangling-FK deletion failure — it resolves with a populated .error the bare await pattern never inspects', async () => {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-bare-${Date.now()}@example.com`
  const { data, error: createError } = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
  if (createError || !data.user) throw new Error(`user creation failed: ${createError?.message}`)
  const userId = data.user.id
  createdUserIds.push(userId) // fallback cleanup if this test fails before its own explicit cleanup below

  const { data: logRow, error: logError } = await db.from('notification_log').insert({
    user_id: userId, type: 'assignment_marked', reference_id: crypto.randomUUID(), success: true,
  }).select('id').single()
  if (logError || !logRow) throw new Error(`notification_log seed failed: ${logError?.message}`)
  createdNotificationLogIds.push(logRow.id)

  // The exact pattern used bare, unguarded, across ~100 pre-existing
  // DEEP_MAIN test files: `await db.auth.admin.deleteUser(id)` with no
  // destructuring of `.error` and no try/catch needed, because the
  // promise never REJECTS here — it resolves normally, carrying a
  // populated `.error` field the caller simply never looks at.
  const deleteResult = await db.auth.admin.deleteUser(userId)
  assert.ok(deleteResult.error, 'a real error IS present on the resolved result — the bug is that ~100 files never destructure/check `.error`, not that Supabase hides it')

  // Prove the user actually still exists — the "successful" delete above
  // was a no-op.
  const { data: stillExists } = await db.auth.admin.getUserById(userId)
  assert.ok(stillExists?.user, 'the auth user must still exist — this is the exact silent-leak mechanism behind DEEP_MAIN\'s observed residual (614 auth.users, 192 schools in one run)')

  // Now clean up properly for real, in the correct order, so this test
  // itself leaves no residual.
  await db.from('notification_log').delete().eq('id', logRow.id)
  createdNotificationLogIds.splice(createdNotificationLogIds.indexOf(logRow.id), 1)
  await deleteAuthUserOrThrow(db, userId)
  createdUserIds.splice(createdUserIds.indexOf(userId), 1)

  const { data: goneNow } = await db.auth.admin.getUserById(userId)
  assert.equal(goneNow?.user, null, 'once the blocking FK reference is removed first, the same deleteUser call genuinely succeeds')
})

test('OPS-TEST-001: deleteAuthUserOrThrow() throws loudly instead of silently no-opping when a dangling FK reference blocks deletion', async () => {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-throw-${Date.now()}@example.com`
  const { data, error: createError } = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
  if (createError || !data.user) throw new Error(`user creation failed: ${createError?.message}`)
  const userId = data.user.id
  createdUserIds.push(userId) // fallback cleanup if this test fails before its own explicit cleanup below

  const { data: logRow, error: logError } = await db.from('notification_log').insert({
    user_id: userId, type: 'alert_created', reference_id: crypto.randomUUID(), success: false,
  }).select('id').single()
  if (logError || !logRow) throw new Error(`notification_log seed failed: ${logError?.message}`)
  createdNotificationLogIds.push(logRow.id)

  await assert.rejects(
    () => deleteAuthUserOrThrow(db, userId),
    /failed to delete auth user/,
    'the helper must surface the blocked deletion as a real thrown error, not a silent no-op'
  )

  // Clean up for real and confirm the throwing helper also succeeds once
  // the actual blocker is gone.
  await db.from('notification_log').delete().eq('id', logRow.id)
  createdNotificationLogIds.splice(createdNotificationLogIds.indexOf(logRow.id), 1)
  await deleteAuthUserOrThrow(db, userId)
  createdUserIds.splice(createdUserIds.indexOf(userId), 1)
})
