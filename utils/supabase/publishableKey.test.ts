import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getSupabasePublishableKey } from './publishableKey'

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const keys = ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]))
  try {
    for (const k of keys) { if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k] }
    fn()
  } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
  }
}

test('returns the publishable key', () => {
  withEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture' }, () => {
    assert.equal(getSupabasePublishableKey(), 'sb_publishable_fixture')
  })
})

test('the RETIRED anon key is never used, even when it is the only key present', () => {
  withEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'retired-legacy-anon' }, () => {
    assert.throws(() => getSupabasePublishableKey(), /Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/)
  })
})

test('the retired anon key never shadows or replaces the publishable key', () => {
  withEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'retired-legacy-anon' }, () => {
    assert.equal(getSupabasePublishableKey(), 'sb_publishable_fixture')
  })
})

test('an empty publishable key fails closed with a descriptive error', () => {
  withEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' }, () => {
    assert.throws(() => getSupabasePublishableKey(), /2026-05-25/)
  })
})
