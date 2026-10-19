// lib/config/adaptiveVariants.ts — limits for adaptive variant generation.

/**
 * Generation attempts per (question, tier): the first draft plus one retry
 * carrying the verifier's specific feedback. Each attempt is two AI calls
 * (generate + verify). The teacher's token charge is per request, never per
 * attempt (see the variants generate routes).
 */
export const ADAPTIVE_VARIANT_MAX_GENERATION_ATTEMPTS = 2
