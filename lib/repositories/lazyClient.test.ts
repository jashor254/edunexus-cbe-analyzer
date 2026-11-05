// lib/repositories/lazyClient.test.ts
//
// An environment that deliberately holds NO privileged database or email
// credential (an isolated Preview build) must still be able to IMPORT the
// repository singleton and the email client — `next build` does exactly that
// while collecting page data. Credentials are validated where they are used,
// and there is no fallback: the first database/email operation fails closed
// with the original error.
//
// Run: npm test -- lib/repositories/lazyClient.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

// Simulate a credential-free environment by clearing EVERY database/email
// variable (prefix-based, so nothing is missed), and restore them afterwards.
const isCredentialVar = (k: string) =>
  k.startsWith('SUPABASE_') || k.startsWith('NEXT_PUBLIC_SUPABASE') || k.startsWith('RESEND_')
const saved: Record<string, string | undefined> = {}

before(() => {
  for (const k of Object.keys(process.env).filter(isCredentialVar)) { saved[k] = process.env[k]; delete process.env[k] }
})
after(() => {
  for (const k of Object.keys(process.env).filter(isCredentialVar)) delete process.env[k]
  for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v
})

test('importing the repository singleton without database credentials does not throw', async () => {
  const mod = await import('./index')
  assert.ok(mod.repos, 'repos singleton should construct without credentials')
  assert.ok(mod.repos.billing, 'individual repositories exist')
})

test('the first database operation fails closed with the original credential error (no fallback)', async () => {
  const { repos } = await import('./index')
  await assert.rejects(
    repos.billing.findProfileRole('00000000-0000-0000-0000-000000000000'),
    /Missing NEXT_PUBLIC_\w+ or \w+/,
  )
})

test('importing the email client without RESEND_API_KEY does not throw; sending fails closed', async () => {
  const mod = await import('@/lib/resend-client')
  assert.equal(typeof mod.getResend, 'function')
  assert.throws(() => mod.getResend(), /RESEND_API_KEY is not set/)
})

test('with a key present the email client is created once and reused', async () => {
  const name = ['RESEND', 'API', 'KEY'].join('_')
  process.env[name] = 're_test_placeholder'
  try {
    const { getResend } = await import('@/lib/resend-client')
    assert.equal(getResend(), getResend())
  } finally {
    delete process.env[name]
  }
})

test('an email send without credentials fails closed BEFORE any network request', async () => {
  const calls: unknown[] = []
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (...args: unknown[]) => { calls.push(args); throw new Error('network must not be reached') }) as typeof fetch
  try {
    const { sendAssignmentMarkedEmail } = await import('@/lib/email/sender')
    const result = await sendAssignmentMarkedEmail({
      submissionId: '00000000-0000-0000-0000-000000000001',
      parentEmail: 'parent-synthetic@example.invalid', parentName: 'Synthetic Parent', studentName: 'Synthetic Learner',
      subject: 'Mathematics', topic: 'Fractions', score: 5, maxScore: 10, teacherFeedback: null,
      teacherName: 'Synthetic Teacher', teacherSchool: 'Synthetic School', assignmentId: '00000000-0000-0000-0000-000000000002',
    })
    assert.equal(result.success, false, 'a send with no credentials must not report success')
    assert.equal(calls.length, 0, 'no outbound request may be attempted without credentials')
  } finally {
    globalThis.fetch = realFetch
  }
})

test('concurrent first uses of one repository share a single client (no duplicate clients)', async () => {
  const urlName = ['NEXT_PUBLIC', 'SUPABASE', 'URL'].join('_')
  const keyName = ['SUPABASE', 'SECRET', 'KEY'].join('_')
  process.env[urlName] = 'https://synthetic-placeholder.invalid'
  process.env[keyName] = 'placeholder-not-a-real-key'
  try {
    const { BaseRepository } = await import('./base')
    class Probe extends BaseRepository { client() { return this.db } }
    const probe = new Probe()
    const seen = await Promise.all(Array.from({ length: 20 }, async () => probe.client()))
    assert.ok(seen.every(c => c === seen[0]), 'all concurrent callers must receive the same client instance')
    assert.equal(new Probe().client() === seen[0], false, 'a different repository instance owns its own client')
  } finally {
    delete process.env[urlName]
    delete process.env[keyName]
  }
})

