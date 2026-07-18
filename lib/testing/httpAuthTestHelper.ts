// lib/testing/httpAuthTestHelper.ts
//
// Test-only helper for route-level (HTTP) integration tests. Next.js Route
// Handlers read the session via `next/headers` cookies() (utils/supabase/
// server.ts), which only resolves inside a real Next.js request — so
// route-level tests must run against an actual server (`next dev`) and
// authenticate with a real `Cookie` header, not by importing the route
// handler function directly.
//
// The cookie format is @supabase/ssr's own (confirmed empirically against
// this project's installed version, not guessed): cookie name
// `sb-<project-ref>-auth-token`, value `base64-` + base64url(JSON.stringify
// ({ access_token, refresh_token, ... })). Built here with the real
// @supabase/ssr `createServerClient` in a throwaway cookie jar rather than
// hand-rolling the format, so it stays correct if the library's encoding
// ever changes.

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'

export type SyntheticSession = {
  cookieHeader: string
  userId: string
}

/**
 * Signs in a user (must already exist, e.g. via `db.auth.admin.createUser`)
 * and returns the `Cookie` header value a real browser would send after
 * that login — usable directly as `fetch(url, { headers: { Cookie } })`
 * against a running `next dev`/`next start` server.
 */
export async function signInForHttpTest(email: string, password: string): Promise<SyntheticSession> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const anon = createSupabaseJsClient(url, anonKey)
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email, password })
  if (error || !signIn.session) throw new Error(`signInForHttpTest failed: ${error?.message}`)

  const setCookies: Array<{ name: string; value: string }> = []
  const server = createServerClient(url, anonKey, {
    cookies: {
      getAll() { return [] },
      setAll(cookiesToSet) {
        for (const c of cookiesToSet) setCookies.push({ name: c.name, value: c.value })
      },
    },
  })
  await server.auth.setSession({
    access_token: signIn.session.access_token,
    refresh_token: signIn.session.refresh_token,
  })

  return {
    cookieHeader: setCookies.map(c => `${c.name}=${c.value}`).join('; '),
    userId: signIn.user!.id,
  }
}
