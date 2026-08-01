import type { UserRole } from '@/lib/auth/roleRedirect'

export type SchoolConceptNavLink = {
  label: string
  href: string
}

export type SchoolConceptLevel = {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  focusAreas: string[]
}

export type SchoolConceptContactField = {
  label: string
  value: string
  status: 'confirmed' | 'pending'
}

export type SchoolConceptNewsItem = {
  title: string
  category: string
  summary: string
}

export type SchoolConceptParentInfoItem = {
  label: string
  status: string
}

export type SchoolConceptAdmissionsFaq = {
  question: string
  answer: string
}

export type SchoolConceptTheme = {
  primary: string
  primaryDark: string
  cream: string
  clay: string
  charcoal: string
}

// ─── Capability integration (Phase 4A) ──────────────────────────────────────
//
// A "capability" is an existing, already-built EduNexus surface (Parent
// Portal, Teacher Workspace, Compass, ...) that a school website may link
// into. The website never renders or reimplements a capability — it only
// decides whether an entry point should be visible. See
// lib/schoolConcepts/resolveCapability.ts: "Showing a capability entry is
// not authorization." Real access control lives entirely at the destination
// route, using the same auth/RLS boundary every other EduNexus surface uses.

/** Only 'parentPortal' is registered so far (Phase 4A proves the seam with
 * one capability). Extend this union, and CAPABILITY_REGISTRY, together. */
export type CapabilityId = 'parentPortal'

export type CapabilityCategory = 'public-module' | 'operational' | 'educational-intelligence'

export type CapabilityDelivery = 'local-module' | 'edunexus-route'

export type CapabilityVisibility = 'public' | 'authenticated'

/** Immutable, platform-wide facts about a capability. Lives once in
 * CAPABILITY_REGISTRY — a school config may never redefine any of this. */
export type CapabilityDefinition = {
  id: CapabilityId
  label: string
  category: CapabilityCategory
  delivery: CapabilityDelivery
  /** Canonical destination path. Required when delivery is 'edunexus-route'. */
  route: string
  visibility: CapabilityVisibility
  allowedRoles: UserRole[]
  contentOwner: 'school' | 'edunexus' | 'shared'
  indexableByDefault: boolean
}

/** The only thing a school configuration may say about a capability:
 * whether it has it, and how to label it. Never a route, never a role list. */
export type SchoolCapabilityOverride = {
  enabled: boolean
  navLabel?: string
  navOrder?: number
}

export type CapabilityViewerContext = {
  role?: UserRole
}

export type ResolvedSchoolCapability =
  | { state: 'disabled'; id: CapabilityId }
  | { state: 'enabled'; id: CapabilityId; label: string; destination: string }

export type SchoolConceptConfig = {
  slug: string
  schoolName: string
  shortDescription: string
  heroTagline: string
  levels: SchoolConceptLevel[]
  nav: SchoolConceptNavLink[]
  contact: {
    phone: SchoolConceptContactField
    email: SchoolConceptContactField
    postalAddress: SchoolConceptContactField
    physicalLocation: SchoolConceptContactField
  }
  sampleNews: SchoolConceptNewsItem[]
  parentInfo: SchoolConceptParentInfoItem[]
  admissions: {
    documents: string[]
    enquiryProcessSteps: string[]
    faqs: SchoolConceptAdmissionsFaq[]
  }
  websiteFunctions: string[]
  about: {
    intro: string
    storyNote: string
    missionNote: string
  }
  theme: SchoolConceptTheme
  conceptDisclaimer: string
  /** Whether this school's website is approved for public indexing.
   * 'concept' (the only value any school should have before the school has
   * seen and approved its site) drives noindex/nofollow and the "Website
   * Concept" title qualifier — see lib/schoolConcepts/pageMetadata.ts.
   * Required, not optional: a school with no explicit status must never
   * silently default to indexable. */
  publicationStatus: 'concept' | 'approved'
  /** Optional. Absent or `{ enabled: false }` for a capability means the
   * school does not have it — omit entirely rather than writing a false
   * "enabled: false" if a capability has never been discussed with the
   * school. Never place a route or role list here; those live only in
   * CAPABILITY_REGISTRY. */
  capabilities?: Partial<Record<CapabilityId, SchoolCapabilityOverride>>
}
