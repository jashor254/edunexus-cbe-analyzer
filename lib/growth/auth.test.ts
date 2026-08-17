// lib/growth/auth.test.ts
//
// Sprint PR-2 (Founder Boundary Security) — Release Gate 2's one High
// finding: requireGrowthUser() used to self-register ANY authenticated
// caller as a full-access Growth OS user. This test proves the fix against
// real Supabase auth (real sign-ins, a real GROWTH_FOUNDER_EMAIL check,
// real growth_users rows), not just by reading the code.
//
// Run: npx tsx --env-file=.env.local --test lib/growth/auth.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { requireGrowthUser } from '@/lib/growth/auth'
import { growthRepos } from '@/lib/growth/repositories'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const MARKER = 'SYNTHETIC_PR2_GROWTH_AUTH_TEST'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const db = createServiceClient()

const originalFounderEmail = process.env.GROWTH_FOUNDER_EMAIL
const password = 'Synthetic-Test-Password-1!'

let founderEmail: string
let founderId: string
let teacherLikeEmail: string
let teacherLikeId: string
let thirdUserEmail: string
let thirdUserId: string

async function mkUser(label: string): Promise<{ id: string; email: string }> {
  const email = `${MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw new Error(`setup: could not create ${label}: ${error?.message}`)
  return { id: data.user.id, email }
}

async function signIn(email: string) {
  const client = createSupabaseJsClient(url, anonKey)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn(${email}) failed: ${error.message}`)
  return client
}

before(async () => {
  const founder = await mkUser('founder')
  founderId = founder.id
  founderEmail = founder.email

  const teacherLike = await mkUser('teacherlike')
  teacherLikeId = teacherLike.id
  teacherLikeEmail = teacherLike.email

  const thirdUser = await mkUser('third')
  thirdUserId = thirdUser.id
  thirdUserEmail = thirdUser.email

  // The env var requireGrowthUser() reads is process.env.GROWTH_FOUNDER_EMAIL
  // — set it here to this run's synthetic founder, not the real founder's
  // email, so this test never depends on (or risks) the real account.
  process.env.GROWTH_FOUNDER_EMAIL = founderEmail
})

after(async () => {
  await db.from('growth_users').delete().in('id', [founderId, teacherLikeId, thirdUserId])
  for (const id of [founderId, teacherLikeId, thirdUserId]) await deleteAuthUserOrThrow(db, id)
  process.env.GROWTH_FOUNDER_EMAIL = originalFounderEmail
})

test('founder access: the caller whose email matches GROWTH_FOUNDER_EMAIL is authorized and bootstraps a real growth_users row', async () => {
  const founderClient = await signIn(founderEmail)
  const result = await requireGrowthUser(founderClient)
  assert.equal(result.id, founderId)

  const row = await growthRepos.users.findById(founderId)
  assert.ok(row, 'a growth_users row must now exist for the authorized founder')
  assert.equal(row!.role, 'founder')
})

test('existing founder data remains untouched: a second call for the same founder returns the existing row without re-registering', async () => {
  const before_ = await growthRepos.users.findById(founderId)
  const founderClient = await signIn(founderEmail)
  const result = await requireGrowthUser(founderClient)
  assert.equal(result.id, founderId)
  const after_ = await growthRepos.users.findById(founderId)
  assert.equal(before_!.created_at, after_!.created_at, 'the founder row must not be re-created or its created_at touched by a repeat call')
})

test('teacher-like account denied: an authenticated user who is NOT the founder cannot self-register and gets a PermissionDeniedError', async () => {
  const teacherClient = await signIn(teacherLikeEmail)
  await assert.rejects(
    () => requireGrowthUser(teacherClient),
    (err: unknown) => err instanceof Error && err.constructor.name === 'PermissionDeniedError',
  )

  // The load-bearing assertion: no accidental self-registration happened.
  const row = await growthRepos.users.findById(teacherLikeId)
  assert.equal(row, null, 'a denied caller must never end up with a growth_users row')
})

test('school-admin-like / parent-like accounts denied the same way (no role-specific carve-out exists)', async () => {
  // Reuses the same non-founder fixture — the point is that ANY non-founder
  // identity is denied identically, there is no special-casing by role
  // anywhere in requireGrowthUser(); a teacher, parent, or school admin
  // account all hit the exact same email check.
  const client = await signIn(teacherLikeEmail)
  await assert.rejects(() => requireGrowthUser(client))
})

test('fails closed when misconfigured: with GROWTH_FOUNDER_EMAIL unset, a brand-new caller with no existing row is denied, not defaulted to allowed', async () => {
  delete process.env.GROWTH_FOUNDER_EMAIL
  try {
    const client = await signIn(thirdUserEmail)
    await assert.rejects(() => requireGrowthUser(client))
    const row = await growthRepos.users.findById(thirdUserId)
    assert.equal(row, null)
  } finally {
    process.env.GROWTH_FOUNDER_EMAIL = founderEmail
  }
})

test('fails closed does not lock out an already-registered founder even if GROWTH_FOUNDER_EMAIL is later unset', async () => {
  delete process.env.GROWTH_FOUNDER_EMAIL
  try {
    const founderClient = await signIn(founderEmail)
    const result = await requireGrowthUser(founderClient)
    assert.equal(result.id, founderId, 'an existing founder row must resolve regardless of the current env var value')
  } finally {
    process.env.GROWTH_FOUNDER_EMAIL = founderEmail
  }
})
