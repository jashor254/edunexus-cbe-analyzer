import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuthentication } from '@/lib/core/permissions'
import { PermissionDeniedError } from '@/lib/core/errors'
import { growthRepos } from '@/lib/growth/repositories'

// Sprint PR-2 (Founder Boundary Security, Release Gate 2's one High
// finding) — this used to self-register ANY authenticated caller
// (`growthRepos.users.ensure(user.id, ...)` ran unconditionally for every
// request) as a full-access Growth OS user. Growth OS shares the same
// `auth.users` pool as the learner platform, so a teacher, parent, or
// school admin account could self-provision into the founder's sales
// pipeline simply by calling any /api/growth/* route or visiting /growth —
// not yet exploited, but the mechanism was real, not theoretical.
//
// Fixed to fail closed: authentication alone is no longer sufficient.
// A caller with no existing growth_users row is now authorized ONLY if
// their email matches GROWTH_FOUNDER_EMAIL (server-side env var, never
// exposed to the client) — no permissions framework, no new table, no
// multi-user model. Mode 1 ("solo founder," docs/growth-os/
// edunexus-growth-engine-specification.md §0.6) is preserved exactly as
// designed; what changed is WHO is allowed to become that one user, not
// how many users can exist.
//
// An existing founder row (growth_users.id = user.id) is returned
// immediately, with no write — this is what "existing founder data
// remains untouched" means in practice: this function never mutates a
// row that's already there, whether or not GROWTH_FOUNDER_EMAIL is set.
export async function requireGrowthUser(client: SupabaseClient): Promise<{ id: string }> {
  const user = await requireAuthentication(client)

  const existing = await growthRepos.users.findById(user.id)
  if (existing) return { id: existing.id }

  const founderEmail = process.env.GROWTH_FOUNDER_EMAIL?.trim().toLowerCase()
  const callerEmail = user.email?.trim().toLowerCase()
  if (!founderEmail || !callerEmail || callerEmail !== founderEmail) {
    // Deliberately the same generic error every unauthorized caller gets,
    // regardless of role (teacher, parent, school admin) or whether
    // GROWTH_FOUNDER_EMAIL is even configured — no information about why
    // access was denied, or that a "founder" concept exists at all, is
    // leaked in the response (mapped to a generic 403 by every
    // app/api/growth/* route's catch block).
    throw new PermissionDeniedError()
  }

  const founder = await growthRepos.users.ensure(user.id, user.email ?? 'Founder')
  return { id: founder.id }
}
