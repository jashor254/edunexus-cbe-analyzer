// The one place that turns a school's capability configuration into the
// list of entries the shared portal-entry surface (components/school-concept
// /PortalEntry.tsx) should render. It performs no merging logic of its own —
// it iterates the registry (never the school's own object, so an unknown or
// malformed key in a school's config is simply never visited: fail-closed by
// construction, not by an explicit check) and delegates every actual
// enable/role decision to resolveSchoolCapability(). No database query, no
// authentication query, no authorization decision.
import { CAPABILITY_REGISTRY } from '@/data/schoolConcepts/capabilityRegistry'
import { resolveSchoolCapability } from './resolveCapability'
import type {
  CapabilityId,
  CapabilityViewerContext,
  ResolvedSchoolCapability,
  SchoolConceptConfig,
} from '@/data/schoolConcepts/types'

export function getPortalCapabilities(
  school: SchoolConceptConfig,
  viewerContext?: CapabilityViewerContext
): ResolvedSchoolCapability[] {
  const resolved: ResolvedSchoolCapability[] = []

  // Object.keys on a registry populated via object-literal syntax preserves
  // insertion order for string keys — this is what gives the result
  // deterministic, registry-defined ordering rather than depending on
  // whichever order a school happened to list its capabilities in.
  for (const id of Object.keys(CAPABILITY_REGISTRY) as CapabilityId[]) {
    const definition = CAPABILITY_REGISTRY[id]
    // The public portal-entry surface is only for capabilities a signed-out
    // visitor doesn't already see rendered as a public module — i.e. ones
    // that require signing in.
    if (definition.visibility !== 'authenticated') continue

    const result = resolveSchoolCapability(school, id, viewerContext)
    if (result.state === 'enabled') resolved.push(result)
  }

  return resolved
}
