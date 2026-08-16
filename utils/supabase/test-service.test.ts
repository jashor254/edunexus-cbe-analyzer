import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { resolveTestTarget, createTestServiceClient } from './test-service'

const VALID_TEST_REF = 'abcdefghijklmnopqrst'
const VALID_TEST_URL = `https://${VALID_TEST_REF}.supabase.co`
const PRODUCTION_REF = 'lpxrfbmzncaztpmyqzkc'

describe('resolveTestTarget — fail-closed DEEP test target validation', () => {
  test('missing TEST_SUPABASE_URL is rejected', () => {
    const result = resolveTestTarget({
      TEST_SUPABASE_URL: undefined,
      TEST_SUPABASE_SERVICE_ROLE_KEY: 'fake-key',
      TEST_SUPABASE_PROJECT_REF: VALID_TEST_REF,
    })
    assert.equal(result.ok, false)
  })

  test('missing TEST_SUPABASE_SERVICE_ROLE_KEY is rejected', () => {
    const result = resolveTestTarget({
      TEST_SUPABASE_URL: VALID_TEST_URL,
      TEST_SUPABASE_SERVICE_ROLE_KEY: undefined,
      TEST_SUPABASE_PROJECT_REF: VALID_TEST_REF,
    })
    assert.equal(result.ok, false)
  })

  test('missing TEST_SUPABASE_PROJECT_REF is rejected', () => {
    const result = resolveTestTarget({
      TEST_SUPABASE_URL: VALID_TEST_URL,
      TEST_SUPABASE_SERVICE_ROLE_KEY: 'fake-key',
      TEST_SUPABASE_PROJECT_REF: undefined,
    })
    assert.equal(result.ok, false)
  })

  test('malformed TEST_SUPABASE_URL is rejected', () => {
    const result = resolveTestTarget({
      TEST_SUPABASE_URL: 'not-a-url',
      TEST_SUPABASE_SERVICE_ROLE_KEY: 'fake-key',
      TEST_SUPABASE_PROJECT_REF: VALID_TEST_REF,
    })
    assert.equal(result.ok, false)
  })

  test('URL/ref mismatch is rejected', () => {
    const result = resolveTestTarget({
      TEST_SUPABASE_URL: VALID_TEST_URL,
      TEST_SUPABASE_SERVICE_ROLE_KEY: 'fake-key',
      TEST_SUPABASE_PROJECT_REF: 'some-other-ref',
    })
    assert.equal(result.ok, false)
  })

  test('production project ref is rejected even if internally self-consistent', () => {
    const result = resolveTestTarget({
      TEST_SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co`,
      TEST_SUPABASE_SERVICE_ROLE_KEY: 'fake-key',
      TEST_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.reason, /production/i)
  })

  test('a valid, internally-consistent, non-production target is accepted', () => {
    const result = resolveTestTarget({
      TEST_SUPABASE_URL: VALID_TEST_URL,
      TEST_SUPABASE_SERVICE_ROLE_KEY: 'fake-key',
      TEST_SUPABASE_PROJECT_REF: VALID_TEST_REF,
    })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.projectRef, VALID_TEST_REF)
  })

  test('a local Docker Supabase URL (127.0.0.1) with ref "local-docker" is accepted', () => {
    const result = resolveTestTarget({
      TEST_SUPABASE_URL: 'http://127.0.0.1:54321',
      TEST_SUPABASE_SERVICE_ROLE_KEY: 'fake-key',
      TEST_SUPABASE_PROJECT_REF: 'local-docker',
    })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.projectRef, 'local-docker')
  })

  test('a local Docker Supabase URL with any other ref is rejected (no silent match)', () => {
    const result = resolveTestTarget({
      TEST_SUPABASE_URL: 'http://127.0.0.1:54321',
      TEST_SUPABASE_SERVICE_ROLE_KEY: 'fake-key',
      TEST_SUPABASE_PROJECT_REF: VALID_TEST_REF,
    })
    assert.equal(result.ok, false)
  })
})

describe('createTestServiceClient — refuses to construct without a verified target', () => {
  test('throws when TEST_* variables are absent, without making any network call', () => {
    const saved = {
      url: process.env.TEST_SUPABASE_URL,
      key: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
      ref: process.env.TEST_SUPABASE_PROJECT_REF,
    }
    delete process.env.TEST_SUPABASE_URL
    delete process.env.TEST_SUPABASE_SERVICE_ROLE_KEY
    delete process.env.TEST_SUPABASE_PROJECT_REF

    try {
      assert.throws(() => createTestServiceClient(), /refusing to run/)
    } finally {
      if (saved.url !== undefined) process.env.TEST_SUPABASE_URL = saved.url
      if (saved.key !== undefined) process.env.TEST_SUPABASE_SERVICE_ROLE_KEY = saved.key
      if (saved.ref !== undefined) process.env.TEST_SUPABASE_PROJECT_REF = saved.ref
    }
  })

  test('throws when configured target is the known production project', () => {
    const saved = {
      url: process.env.TEST_SUPABASE_URL,
      key: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
      ref: process.env.TEST_SUPABASE_PROJECT_REF,
    }
    process.env.TEST_SUPABASE_URL = `https://${PRODUCTION_REF}.supabase.co`
    process.env.TEST_SUPABASE_SERVICE_ROLE_KEY = 'fake-key'
    process.env.TEST_SUPABASE_PROJECT_REF = PRODUCTION_REF

    try {
      assert.throws(() => createTestServiceClient(), /production/i)
    } finally {
      process.env.TEST_SUPABASE_URL = saved.url
      process.env.TEST_SUPABASE_SERVICE_ROLE_KEY = saved.key
      process.env.TEST_SUPABASE_PROJECT_REF = saved.ref
    }
  })

  test('constructs a client (no network call made) for a valid non-production target', () => {
    const saved = {
      url: process.env.TEST_SUPABASE_URL,
      key: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
      ref: process.env.TEST_SUPABASE_PROJECT_REF,
    }
    process.env.TEST_SUPABASE_URL = VALID_TEST_URL
    process.env.TEST_SUPABASE_SERVICE_ROLE_KEY = 'fake-key'
    process.env.TEST_SUPABASE_PROJECT_REF = VALID_TEST_REF

    try {
      // @supabase/supabase-js's createClient() only builds a client object —
      // it performs no network I/O until a query/auth call is actually
      // issued, so this proves construction succeeds without connecting.
      const client = createTestServiceClient()
      assert.equal(typeof client, 'object')
      assert.equal(typeof client.from, 'function')
    } finally {
      process.env.TEST_SUPABASE_URL = saved.url
      process.env.TEST_SUPABASE_SERVICE_ROLE_KEY = saved.key
      process.env.TEST_SUPABASE_PROJECT_REF = saved.ref
    }
  })
})
