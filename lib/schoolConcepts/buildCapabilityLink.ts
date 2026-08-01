// The one place a capability's destination URL is turned into a link. It
// only ever reads the already-resolved, already-safe destination path — it
// never accepts a route from a school config, and it never adds a learner
// ID, role, evidence ID, or any other sensitive value to the URL.
//
// No login/returnTo URL is built here. The destination routes this links to
// (e.g. '/dashboard') are already protected by the existing proxy.ts
// middleware, which already redirects an unauthenticated visitor to
// '/login?returnTo=<path>' and returns them after sign-in. Building a second
// version of that redirect here would duplicate an authentication
// convention that already exists — exactly what this integration layer
// must not do.
import type { ResolvedSchoolCapability } from '@/data/schoolConcepts/types'

export function buildCapabilityLink(resolved: ResolvedSchoolCapability): string | null {
  if (resolved.state !== 'enabled') return null
  return resolved.destination
}
