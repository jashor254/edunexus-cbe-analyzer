// scripts/check-env.supabaseKeyShape.test.ts
//
// Supabase Key Contract Audit / small fix — proves the two Supabase API-key
// validators in scripts/check-env.ts no longer assume the obsolete
// JWT-shaped (`eyJ...`) key format, which rejected the modern
// sb_publishable_.../sb_secret_... credentials already in real use (see the
// audit's Phase 8 finding). Every real client factory
// (utils/supabase/client.ts, server.ts, service.ts, middleware.ts,
// authAnon.ts) and lib/config/env.ts's own zod schema already treat the
// credential as an opaque non-empty string — this test proves check-env.ts
// now agrees with them.
//
// Synthetic values only. Never a real credential.
//
// Run: npx tsx --test scripts/check-env.supabaseKeyShape.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RULES } from './check-env'

function ruleFor(key: string) {
  const rule = RULES.find(r => r.key === key)
  if (!rule) throw new Error(`expected a rule for ${key}`)
  return rule
}

const SUPABASE_KEY_VARS = ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']

for (const key of SUPABASE_KEY_VARS) {
  test(`${key}: still required`, () => {
    assert.equal(ruleFor(key).required, true)
  })

  test(`${key}: legacy JWT-shaped synthetic value is still accepted`, () => {
    const validate = ruleFor(key).validate!
    assert.equal(validate('eyJ.synthetic.value'), null)
  })

  test(`${key}: modern sb_publishable_ synthetic value is accepted (previously rejected)`, () => {
    const validate = ruleFor(key).validate!
    assert.equal(validate('sb_publishable_synthetic123'), null)
  })

  test(`${key}: modern sb_secret_ synthetic value is accepted (previously rejected)`, () => {
    const validate = ruleFor(key).validate!
    assert.equal(validate('sb_secret_synthetic123'), null)
  })

  test(`${key}: a whitespace-only value is still rejected`, () => {
    const validate = ruleFor(key).validate!
    assert.notEqual(validate('   '), null)
  })

  test(`${key}: no format/prefix assumption remains — an arbitrary opaque non-empty string is accepted`, () => {
    const validate = ruleFor(key).validate!
    assert.equal(validate('any-opaque-nonempty-credential-string'), null)
  })
}

test('no fallback between NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY is introduced — each remains its own independent, required rule', () => {
  const anon = ruleFor('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const service = ruleFor('SUPABASE_SERVICE_ROLE_KEY')
  assert.equal(anon.key, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
  assert.equal(service.key, 'SUPABASE_SERVICE_ROLE_KEY')
  assert.notEqual(anon.key, service.key)
  assert.equal(anon.required, true)
  assert.equal(service.required, true)
})

test('NEXT_PUBLIC_SUPABASE_URL rule is unchanged — still requires a valid HTTP(S) URL', () => {
  const rule = ruleFor('NEXT_PUBLIC_SUPABASE_URL')
  const validate = rule.validate!
  assert.equal(validate('https://example.supabase.co'), null)
  assert.notEqual(validate('not-a-url'), null)
})
