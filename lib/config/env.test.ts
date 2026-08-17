// lib/config/env.test.ts
//
// H4A / OPS-ENV-001 — production startup must fail closed when a required
// critical operational secret/configuration is absent or structurally
// invalid. Pure test of the validator itself — no process import-time
// side effect, no process-spawning tricks needed (see lib/config/env.ts's
// header for why this was refactored from a top-level throw into a pure
// function, and why it is NOT wired into any real startup path yet).
//
// Run: npx tsx --experimental-test-module-mocks --test lib/config/env.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateEnv, validateEnvOrThrow } from './env'

const VALID_VARS = {
  DEEPSEEK_AI_API_KEY: 'sk-fixture',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-fixture',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-fixture',
  NODE_ENV: 'production',
}

test('OPS-ENV-001: a complete, valid environment passes', () => {
  const result = validateEnv(VALID_VARS)
  assert.equal(result.ok, true)
})

test('OPS-ENV-001: a missing critical secret (DEEPSEEK_AI_API_KEY) fails closed with a clear message naming the field', () => {
  const { DEEPSEEK_AI_API_KEY: _omit, ...rest } = VALID_VARS
  const result = validateEnv(rest)
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.match(result.message, /DEEPSEEK_AI_API_KEY/)
})

test('OPS-ENV-001: a structurally invalid Supabase URL (not a URL at all) fails closed rather than being silently accepted', () => {
  const result = validateEnv({ ...VALID_VARS, NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' })
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.match(result.message, /NEXT_PUBLIC_SUPABASE_URL/)
})

test('OPS-ENV-001: a missing service role key fails closed', () => {
  const { SUPABASE_SERVICE_ROLE_KEY: _omit, ...rest } = VALID_VARS
  const result = validateEnv(rest)
  assert.equal(result.ok, false)
})

test('OPS-ENV-001: optional Paystack keys being absent does not fail validation — only the derived critical set is required', () => {
  const result = validateEnv(VALID_VARS) // VALID_VARS never included Paystack keys
  assert.equal(result.ok, true, 'Paystack keys must not be forced into the critical set')
})

test('OPS-ENV-001: validateEnvOrThrow throws with the same descriptive message on an invalid environment', () => {
  assert.throws(() => validateEnvOrThrow({}), /Missing or invalid environment variables/)
})

test('OPS-ENV-001: validateEnvOrThrow returns the validated env unchanged on success', () => {
  const env = validateEnvOrThrow(VALID_VARS)
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, VALID_VARS.NEXT_PUBLIC_SUPABASE_URL)
})
