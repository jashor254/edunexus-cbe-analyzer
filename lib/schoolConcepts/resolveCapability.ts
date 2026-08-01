// The one place a school website decides whether a capability ENTRY POINT
// should be visible. It is a display resolver, not an authorization engine.
//
//   Showing a capability entry is not authorization.
//
// This function may never decide whether a parent owns a learner, a teacher
// belongs to a class, a student belongs to a school, or any other real
// access question — those checks happen again, independently, inside the
// destination route (the same auth/RLS boundary every other EduNexus
// surface already uses). If this function is ever wrong, the worst it can
// do is show or hide a link; it can never grant access to anything.
import { CAPABILITY_REGISTRY } from '@/data/schoolConcepts/capabilityRegistry'
import type {
  CapabilityId,
  CapabilityViewerContext,
  ResolvedSchoolCapability,
  SchoolConceptConfig,
} from '@/data/schoolConcepts/types'

export function resolveSchoolCapability(
  school: SchoolConceptConfig,
  capabilityId: CapabilityId,
  viewerContext?: CapabilityViewerContext
): ResolvedSchoolCapability {
  const definition = CAPABILITY_REGISTRY[capabilityId]
  const override = school.capabilities?.[capabilityId]

  // Unregistered capability ID, or the school hasn't enabled it: fail closed.
  if (!definition || !override?.enabled) {
    return { state: 'disabled', id: capabilityId }
  }

  // A role hint that's known and doesn't match is a display decision only —
  // it hides the entry from a visitor it obviously isn't for. It is not the
  // access check; the destination performs that independently regardless.
  if (viewerContext?.role && !definition.allowedRoles.includes(viewerContext.role)) {
    return { state: 'disabled', id: capabilityId }
  }

  return {
    state: 'enabled',
    id: capabilityId,
    label: override.navLabel ?? definition.label,
    destination: definition.route,
  }
}
