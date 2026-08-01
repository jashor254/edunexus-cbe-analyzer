// The single, platform-wide source of truth for every known capability a
// school website may link into: canonical label, category, delivery method,
// destination route, visibility, and allowed roles. A school configuration
// may only ever say "enabled: true/false" (data/schoolConcepts/types.ts,
// SchoolCapabilityOverride) — it must never repeat a route or role list.
//
// Phase 4A registers exactly one capability (parentPortal) to prove the
// seam. Adding a second capability later means adding one entry here plus
// one CapabilityId union member in types.ts — nothing else in the
// integration layer changes.
import { getRoleRedirect } from '@/lib/auth/roleRedirect'
import type { CapabilityDefinition, CapabilityId } from './types'

export const CAPABILITY_REGISTRY: Record<CapabilityId, CapabilityDefinition> = {
  parentPortal: {
    id: 'parentPortal',
    label: 'Parent Portal',
    category: 'operational',
    delivery: 'edunexus-route',
    // getRoleRedirect('parent') is EduNexus's own single canonical
    // role→destination mapping (lib/auth/roleRedirect.ts) — reused here
    // rather than re-typing '/dashboard', so this can never drift from it.
    route: getRoleRedirect('parent'),
    visibility: 'authenticated',
    allowedRoles: ['parent'],
    contentOwner: 'edunexus',
    indexableByDefault: false,
  },
}
