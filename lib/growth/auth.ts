import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuthentication } from '@/lib/core/permissions'
import { PermissionDeniedError } from '@/lib/core/errors'
import { growthRepos } from '@/lib/growth/repositories'
import { logger } from '@/lib/observability/logger'
import { isFounderIdentity } from '@/lib/growth/founderIdentity'

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
// Takes a session-bound client (from utils/supabase/server), not
// createServiceClient() — deliberate exception to the "server-side DB always
// uses the service client" rule: requireAuthentication() below needs
// auth.getUser() resolved against the caller's own session, which the
// service-role client has no session to provide. app/api/growth/* routes
// reuse this same session client for their subsequent growth_schools/
// growth_users queries too, so RLS (not just this founder-email gate) is
// the second layer of defense on that data — not a silent divergence.
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

// Growth CRM membership is not administrative authority.
//
// `requireGrowthUser()` answers "is this caller a Growth CRM member" and, by
// design, trusts an existing growth_users row (it must keep working for the
// founder even if GROWTH_FOUNDER_EMAIL is later unset). Privileged operations
// (the app/api/admin/* routes that grant access, confirm payments, set school
// entitlement, create school administrators, publish career content or list
// users) need more than membership.
//
// `requirePlatformAdmin()` is that stricter gate: CRM membership AND a
// server-side founder identity check (the authenticated email must equal
// GROWTH_FOUNDER_EMAIL, a server-only env var no client can influence). The
// identity check cannot be satisfied by anything stored in the database, so it
// holds independently of database grants and policies. Fails closed: with the
// env var unset, no one is a platform admin.

export async function requirePlatformAdmin(client: SupabaseClient): Promise<{ id: string }> {
  const user = await requireAuthentication(client)

  if (!isFounderIdentity(user.email, process.env.GROWTH_FOUNDER_EMAIL)) {
    // A Growth member who is not the configured founder is an unexpected state
    // (membership is provisioned for the founder only) — surface it for review.
    const member = await growthRepos.users.findById(user.id)
    if (member) {
      logger.error(
        'requirePlatformAdmin: denied — Growth member is not the configured founder identity',
        { operation: 'growth.auth.requirePlatformAdmin', user_id: user.id },
      )
    }
    throw new PermissionDeniedError()
  }

  // Identity is the founder; membership resolution (including first-use
  // bootstrap for the founder only) is unchanged.
  const member = await requireGrowthUser(client)
  return { id: member.id }
}
