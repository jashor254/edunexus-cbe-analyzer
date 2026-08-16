// scripts/check-test-target.ts
//
// Preflight for `npm run test:deep`. Verifies TEST_SUPABASE_* variables
// resolve to an explicitly approved, non-production Supabase target before
// any DEEP test file is allowed to run. Never prints secret values — only
// pass/fail and the resolved project ref (a project ref alone is not a
// credential; it appears in the public https:// URL).
//
// Fails closed: missing, malformed, or ambiguous configuration is a
// refusal, never a fallback to "assume development and continue."
// See docs/architecture — Phase H1S / H1S-FIX.

import { resolveTestTarget } from '../utils/supabase/test-service'

const result = resolveTestTarget({
  TEST_SUPABASE_URL: process.env.TEST_SUPABASE_URL,
  TEST_SUPABASE_SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
  TEST_SUPABASE_PROJECT_REF: process.env.TEST_SUPABASE_PROJECT_REF,
})

if (!result.ok) {
  console.error('DEEP test target NOT verified')
  console.error(`reason: ${result.reason}`)
  console.error('')
  console.error('DEEP tests require TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_ROLE_KEY,')
  console.error('and TEST_SUPABASE_PROJECT_REF to all be set and mutually consistent,')
  console.error('and must not resolve to the production Supabase project.')
  console.error('Refusing to run — this is the expected, safe outcome until a verified')
  console.error('non-production test target exists.')
  process.exit(1)
}

console.log('DEEP test target verified')
console.log(`project: ${result.projectRef}`)
console.log('production: false')
