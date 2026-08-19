// Shared production-project-ref recognition, used by both the ordinary
// service client (utils/supabase/service.ts) and the DEEP-test-only client
// (utils/supabase/test-service.ts). Kept in one place per CLAUDE.md's "no
// duplicate constant definitions across files" rule — this constant is
// security-relevant, so a copy that drifted between the two files would be
// exactly the kind of silent gap that caused the Phase 2B incident.

// The production Supabase project ref this repository's .env.local and
// .env.production both resolve to today (see docs/architecture — Phase
// H1S / H1S-FIX / Phase 2C Step 0).
export const KNOWN_PRODUCTION_PROJECT_REF = 'lpxrfbmzncaztpmyqzkc'

// A local Supabase CLI instance has no hosted <ref>.supabase.co URL — it
// serves from http://127.0.0.1:<port> (or http://localhost:<port>). There is
// no way to confuse this host with a production hosted project (disjoint URL
// shape entirely).
export const LOCAL_DOCKER_REF = 'local-docker'

/**
 * Extracts a recognizable project ref from a Supabase URL, or null if the
 * URL doesn't match either the hosted `https://<ref>.supabase.co` shape or
 * the local Docker `http(s)://127.0.0.1|localhost[:port]` shape. Pure,
 * no network access — safe to call from any context.
 */
export function extractProjectRef(url: string): string | null {
  const hosted = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/)
  if (hosted) return hosted[1]
  const local = url.match(/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/?$/)
  if (local) return LOCAL_DOCKER_REF
  return null
}
