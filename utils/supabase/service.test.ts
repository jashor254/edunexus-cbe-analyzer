import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from './service'

const PRODUCTION_URL = 'https://lpxrfbmzncaztpmyqzkc.supabase.co'
const LOCAL_DOCKER_URL = 'http://127.0.0.1:54321'

type SavedEnv = {
  url: string | undefined
  key: string | undefined
  testContext: string | undefined
}

function saveEnv(): SavedEnv {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    testContext: process.env.NODE_TEST_CONTEXT,
  }
}

function restoreEnv(saved: SavedEnv): void {
  if (saved.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
  else process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url
  if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key
  if (saved.testContext === undefined) delete process.env.NODE_TEST_CONTEXT
  else process.env.NODE_TEST_CONTEXT = saved.testContext
}

// createServiceClient() is the ordinary, production-shaped repository
// client (utils/supabase/service.ts). Phase 2B wrote one synthetic row to
// the REAL production `schools` table because a test invoked with
// `--env-file=.env.local` used this client with no guard against the
// resolved URL being production. Phase 2C Step 0 closes that gap: when
// process.env.NODE_TEST_CONTEXT is set (which Node's own test runner sets
// automatically, regardless of which env file supplied credentials) and the
// resolved URL is the known production project, construction must refuse
// BEFORE any client — and therefore any possible network call — is built.
describe('createServiceClient — fail-closed test/production guard (Phase 2C Step 0)', () => {
  test('test + known production URL is refused before any client is constructed', () => {
    const saved = saveEnv()
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = PRODUCTION_URL
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key'
      // NODE_TEST_CONTEXT is already set by the test runner itself — this
      // assertion is here so the test fails loudly (not silently no-ops)
      // if that runtime invariant ever stops holding.
      assert.ok(process.env.NODE_TEST_CONTEXT, 'expected NODE_TEST_CONTEXT to be set by the test runner')

      assert.throws(
        () => createServiceClient(),
        /refusing to run/,
        'createServiceClient() must refuse when NODE_TEST_CONTEXT is set and the URL is production'
      )
    } finally {
      restoreEnv(saved)
    }
  })

  test('test + local Docker URL is allowed', () => {
    const saved = saveEnv()
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL_DOCKER_URL
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key'
      assert.ok(process.env.NODE_TEST_CONTEXT, 'expected NODE_TEST_CONTEXT to be set by the test runner')

      assert.doesNotThrow(() => createServiceClient())
    } finally {
      restoreEnv(saved)
    }
  })

  test('non-test execution (NODE_TEST_CONTEXT unset) with a production-shaped URL is unaffected — production runtime behavior is unchanged', () => {
    const saved = saveEnv()
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = PRODUCTION_URL
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key'
      delete process.env.NODE_TEST_CONTEXT

      // This is exactly what real production runtime looks like: a
      // production URL, a real key, and no test-runner marker. The guard
      // must not fire here — that would break the app in production.
      assert.doesNotThrow(() => createServiceClient())
    } finally {
      restoreEnv(saved)
    }
  })

  test('missing credentials still throws the original missing-env error, independent of the new guard', () => {
    const saved = saveEnv()
    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.SUPABASE_SERVICE_ROLE_KEY

      assert.throws(() => createServiceClient(), /Missing NEXT_PUBLIC_SUPABASE_URL/)
    } finally {
      restoreEnv(saved)
    }
  })
})
