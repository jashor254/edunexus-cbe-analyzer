// lib/holiday/evidenceClaimTypes.ts
// The two Holiday Return evidence claim shapes (Adaptive Learning v2
// Architecture §4/§7, FROZEN), mirroring lib/compass/evidenceClaimTypes.ts's
// exact pattern — shared between lib/holiday/return.ts (the producer) and
// lib/holiday/returnAutoConfirm.ts (the consumer that must tell them apart)
// so neither module needs to import the other.

export const HOLIDAY_ENGAGEMENT_EXTRACTION_METHOD = 'holiday_return_engagement_v1' as const
export const HOLIDAY_MASTERY_EXTRACTION_METHOD    = 'holiday_return_mastery_v1'    as const
