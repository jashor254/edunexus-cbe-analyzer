// lib/compass/evidenceClaimTypes.ts
// The two Compass evidence claim shapes (Wave 2 Phase 9), shared between
// lib/compass/evidence.ts (the producer) and lib/compass/autoConfirm.ts (the
// consumer that must tell them apart) — pulled into its own file so neither
// module needs to import the other.

export const ENGAGEMENT_EXTRACTION_METHOD = 'compass_session_engagement_v1' as const
export const MASTERY_EXTRACTION_METHOD    = 'compass_session_mastery_v1'    as const
