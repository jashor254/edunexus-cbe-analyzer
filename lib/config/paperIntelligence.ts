// lib/config/paperIntelligence.ts
// Single source of truth for Paper Intelligence capture limits. Shared by the
// phone (client-side retake prompt) and the server (authoritative check), so
// both judge a photo against the same numbers.

export const PAPER_INTELLIGENCE_LIMITS = {
  /**
   * A learner's script rarely runs past 4 pages; 12 covers an end-term answer
   * booklet (raised from 8 for scanned exam papers, 2026-10-19) without
   * inviting a whole exercise book. Every page goes to the vision model in one
   * marking call — raise further only after measuring time and cost.
   */
  maxPagesPerScript: 12,
  /** Sharpness is measured on a copy resized to this long edge, so the score does not depend on the phone's camera resolution. */
  sharpnessAnalysisEdgePx: 800,
  /**
   * Below this 0..1 sharpness score a page is rejected and the teacher asked
   * to retake it. Calibrated 2026-10-14 on the Phase 0 photos (real phone
   * shots of scheme and learner scripts) and blurred copies of them — see
   * SHARP_REFERENCE_VARIANCE in lib/paperIntelligence/sharpness.ts.
   */
  minSharpnessScore: 0.15,
  /** A question the AI marked with less than this confidence (0..1) is routed to the teacher rather than offered for one-tap confirm. */
  reviewBelowGradingConfidence: 0.7,
  /** Lifetime of the signed links a teacher uses to view a learner's script photos during review. */
  pageViewUrlTtlSeconds: 600,
} as const
