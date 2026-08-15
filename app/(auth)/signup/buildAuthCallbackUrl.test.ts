// app/(auth)/signup/buildAuthCallbackUrl.test.ts
//
// Phase 1 self-serve onboarding, Task 3 — proves the callback URL both
// signup entry points (Google OAuth, email/password) now build carries
// role=school (and returnTo/product/secondary_role) intact, and that a
// plain signup is unaffected. This is what's now passed as
// options.emailRedirectTo to supabase.auth.signUp() — before this fix,
// nothing was passed, so Supabase fell back to the project's bare Site
// URL and every one of these params was silently dropped for email/
// password signups (Google OAuth already carried them via redirectTo).
//
// Run: npx tsx --test "app/(auth)/signup/buildAuthCallbackUrl.test.ts"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAuthCallbackUrl } from './page'

test('school signup intent survives into the callback URL', () => {
  const url = buildAuthCallbackUrl('https://edunexus.example', {
    returnTo: '/organizations/new?type=school',
    role: 'school',
    productId: null,
    secondaryRole: null,
  })
  const parsed = new URL(url)
  assert.equal(parsed.pathname, '/auth/callback')
  assert.equal(parsed.searchParams.get('returnTo'), '/organizations/new?type=school')
  assert.equal(parsed.searchParams.get('role'), 'school')
})

test('a normal (no role param) signup carries no role, matching pre-fix behavior', () => {
  const url = buildAuthCallbackUrl('https://edunexus.example', {
    returnTo: '/dashboard',
    role: null,
    productId: null,
    secondaryRole: null,
  })
  const parsed = new URL(url)
  assert.equal(parsed.searchParams.has('role'), false)
  assert.equal(parsed.searchParams.get('returnTo'), '/dashboard')
})

test('product and secondary_role are carried when present', () => {
  const url = buildAuthCallbackUrl('https://edunexus.example', {
    returnTo: '/dashboard',
    role: 'teacher',
    productId: 'sow-generator',
    secondaryRole: 'parent',
  })
  const parsed = new URL(url)
  assert.equal(parsed.searchParams.get('product'), 'sow-generator')
  assert.equal(parsed.searchParams.get('secondary_role'), 'parent')
})

test('an unchecked secondary-role checkbox (secondaryRole: null) omits secondary_role entirely — never sent as the string "null"', () => {
  const url = buildAuthCallbackUrl('https://edunexus.example', {
    returnTo: '/dashboard',
    role: 'teacher',
    productId: null,
    secondaryRole: null,
  })
  const parsed = new URL(url)
  assert.equal(parsed.searchParams.has('secondary_role'), false)
})
