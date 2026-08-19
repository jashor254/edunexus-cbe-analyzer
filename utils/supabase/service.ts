import { createClient } from '@supabase/supabase-js'
import { KNOWN_PRODUCTION_PROJECT_REF, extractProjectRef } from './productionRef'

export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  // Fail-closed test/production guard (Phase 2C Step 0). Node's built-in
  // test runner sets process.env.NODE_TEST_CONTEXT automatically for every
  // test process — under `node --test` or `tsx --test`, with or without
  // `--env-file` — regardless of which env file supplied the credentials
  // above. No developer action is required for this signal to exist, which
  // is the point: the Phase 2B incident happened because a test was invoked
  // with `--env-file=.env.local` and this function had no way to notice it
  // was running inside a test at all. If execution is recognizably a test
  // AND the ordinary production-shaped credentials resolve to the known
  // production project, refuse before constructing any client. Genuine
  // production runtime (Next.js server, cron jobs, webhooks) never sets
  // NODE_TEST_CONTEXT, so this check is inert there — production behavior
  // is unchanged.
  if (
    process.env.NODE_TEST_CONTEXT &&
    extractProjectRef(supabaseUrl) === KNOWN_PRODUCTION_PROJECT_REF
  ) {
    throw new Error(
      'createServiceClient: refusing to run — this process is recognizably a test ' +
      '(NODE_TEST_CONTEXT is set) and NEXT_PUBLIC_SUPABASE_URL resolves to the known ' +
      'production Supabase project. Tests must use createTestServiceClient() from ' +
      'utils/supabase/test-service.ts with TEST_SUPABASE_* variables pointed at a ' +
      'disposable target instead.'
    )
  }

  // Node.js < 22 has no native WebSocket — inject ws so scripts work
  // Next.js server runtime polyfills WebSocket, so this branch is skipped in prod
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const transport = typeof WebSocket === 'undefined' ? require('ws') : undefined

  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(transport ? { realtime: { transport } } : {}),
  })
}
