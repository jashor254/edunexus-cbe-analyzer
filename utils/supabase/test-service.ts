import { createClient } from '@supabase/supabase-js'

// The production Supabase project ref this repository's .env.local and
// .env.production both resolve to today (see docs/architecture — Phase H1S
// test-environment-safety audit). Automated tests must never be allowed to
// resolve to this ref, regardless of which TEST_* variables produced it.
const KNOWN_PRODUCTION_PROJECT_REF = 'lpxrfbmzncaztpmyqzkc'

// A local Supabase CLI instance has no hosted <ref>.supabase.co URL — it
// serves from http://127.0.0.1:<port> (or http://localhost:<port>). There is
// no way to confuse this host with a production hosted project (disjoint URL
// shape entirely), so recognizing it does not weaken the production-ref
// check below — it only adds a second, equally explicit target class.
// TEST_SUPABASE_PROJECT_REF must be exactly 'local-docker' for this class,
// so a typo'd or copy-pasted hosted ref can never silently match a local URL.
const LOCAL_DOCKER_REF = 'local-docker'

function extractProjectRef(url: string): string | null {
  const hosted = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/)
  if (hosted) return hosted[1]
  const local = url.match(/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/?$/)
  if (local) return LOCAL_DOCKER_REF
  return null
}

// A flat shape rather than a discriminated union — kept simple and
// unambiguous for both branches to consume directly.
export type TestTargetResult = {
  ok: boolean
  projectRef?: string
  reason?: string
}

export type TestTargetEnv = Record<
  'TEST_SUPABASE_URL' | 'TEST_SUPABASE_SERVICE_ROLE_KEY' | 'TEST_SUPABASE_PROJECT_REF',
  string | undefined
>

// process.env satisfies this by index signature, but TypeScript treats an
// index-signature source and an all-optional named-property target as
// having "no properties in common" for direct assignability — the same
// object shape read through Record's index signature avoids that false
// positive, so callers pass process.env unchanged.

/**
 * Pure validation of a DEEP test target, with no client construction and no
 * network access — safe to unit-test directly. Fails closed: any missing,
 * malformed, or ambiguous input is a rejection, never a fallback guess.
 */
export function resolveTestTarget(env: TestTargetEnv): TestTargetResult {
  const url = env.TEST_SUPABASE_URL
  const serviceKey = env.TEST_SUPABASE_SERVICE_ROLE_KEY
  const expectedRef = env.TEST_SUPABASE_PROJECT_REF

  if (!url) return { ok: false, reason: 'TEST_SUPABASE_URL is not set' }
  if (!serviceKey) return { ok: false, reason: 'TEST_SUPABASE_SERVICE_ROLE_KEY is not set' }
  if (!expectedRef) return { ok: false, reason: 'TEST_SUPABASE_PROJECT_REF is not set' }

  const resolvedRef = extractProjectRef(url)
  if (!resolvedRef) {
    return { ok: false, reason: 'TEST_SUPABASE_URL is not a recognizable https://<ref>.supabase.co URL' }
  }

  if (resolvedRef === KNOWN_PRODUCTION_PROJECT_REF) {
    return { ok: false, reason: 'TEST_SUPABASE_URL resolves to the known production project — refusing' }
  }

  if (resolvedRef !== expectedRef) {
    return { ok: false, reason: 'TEST_SUPABASE_URL project ref does not match TEST_SUPABASE_PROJECT_REF' }
  }

  return { ok: true, projectRef: resolvedRef }
}

/**
 * DEEP-test-only Supabase client. Reads TEST_SUPABASE_* variables — never
 * NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, which are the
 * production credentials .env.local also carries. Throws before
 * constructing any client if the target is missing, ambiguous, or resolves
 * to production. See docs/architecture — Phase H1S / H1S-FIX.
 */
export function createTestServiceClient() {
  const result = resolveTestTarget({
    TEST_SUPABASE_URL: process.env.TEST_SUPABASE_URL,
    TEST_SUPABASE_SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
    TEST_SUPABASE_PROJECT_REF: process.env.TEST_SUPABASE_PROJECT_REF,
  })

  if (!result.ok) {
    throw new Error(
      `createTestServiceClient: refusing to run — ${result.reason}. ` +
      'DEEP tests require an explicitly configured, verified non-production Supabase target ' +
      '(TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_ROLE_KEY, TEST_SUPABASE_PROJECT_REF). ' +
      "Run `npm run test:deep` to see the same check with a full explanation."
    )
  }

  // Node.js < 22 has no native WebSocket — inject ws so scripts work.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const transport = typeof WebSocket === 'undefined' ? require('ws') : undefined

  return createClient(process.env.TEST_SUPABASE_URL!, process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(transport ? { realtime: { transport } } : {}),
  })
}
