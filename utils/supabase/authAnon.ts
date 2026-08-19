// utils/supabase/authAnon.ts
//
// Phase 2B-RESUME — a server-side, anon-keyed Supabase client used for
// exactly one purpose: exchanging a server-generated OTP token_hash for a
// real Supabase Auth session (`auth.verifyOtp`) as the last step of the
// learner-account activation bootstrap (lib/core/learnerAccounts.ts). This
// is NOT `utils/supabase/client.ts` (that one is `createBrowserClient`,
// which assumes a browser storage context and is unsuitable for a Next.js
// route handler) and NOT `utils/supabase/service.ts` (the service-role key
// is unnecessary here — `verifyOtp` is a public Auth endpoint gated by the
// anon apikey header, not an admin operation, and using the narrower key
// for it is the least-privilege choice).
//
// Never used for `.from(...)` table access — RLS-scoped DB reads/writes
// still go through createServiceClient() (server) or createClient()
// (browser) exclusively, per CLAUDE.md. This client's only job is minting
// a session.
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { KNOWN_PRODUCTION_PROJECT_REF, extractProjectRef } from './productionRef'

export function createAnonAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    throw new Error('createAnonAuthClient: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  // Same fail-closed test/production guard as createServiceClient() (Phase
  // 2C Step 0) — minting a real Auth session against the production project
  // from a test process is exactly as unsafe as a stray write would be.
  if (
    process.env.NODE_TEST_CONTEXT &&
    extractProjectRef(supabaseUrl) === KNOWN_PRODUCTION_PROJECT_REF
  ) {
    throw new Error(
      'createAnonAuthClient: refusing to run — this process is recognizably a test ' +
      '(NODE_TEST_CONTEXT is set) and NEXT_PUBLIC_SUPABASE_URL resolves to the known ' +
      'production Supabase project.'
    )
  }

  return createSupabaseJsClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
