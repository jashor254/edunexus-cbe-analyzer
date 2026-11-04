// utils/supabase/publishableKey.ts
//
// The ONE place the browser-safe Supabase key is resolved.
//
// Supabase disabled the legacy JWT keys (anon, service_role) on 2026-05-25 and
// answers every request that presents one with 401 "Legacy API keys are
// disabled". The only valid names are NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
// (this file) and SUPABASE_SECRET_KEY (server only, read in service.ts). There
// is deliberately NO fallback to the retired NEXT_PUBLIC_SUPABASE_ANON_KEY: a
// silent fallback hides a misconfigured environment until a request fails
// (and proxy.ts, which once read only the retired name, answered 500 on every
// protected route whenever that variable was absent).
//
// Next inlines NEXT_PUBLIC_* values into client bundles only when written as the
// literal expression `process.env.NEXT_PUBLIC_…`, so keep it exactly like this.
export function getSupabasePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY was disabled by Supabase on 2026-05-25 and is not read)'
    )
  }
  return key
}
