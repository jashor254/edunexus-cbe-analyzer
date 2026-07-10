// Gates how much "intelligence" the teacher attention feed surfaces, keyed to
// how much real data exists — never to elapsed time. A teacher with no marks
// saved yet sees nothing; the flagship prerequisite-chain insight unlocks the
// moment there's enough data to make it true, not on a fixed schedule.
export const ATTENTION_FEED_TIERS = {
  // Tier 1 — prerequisite-chain warnings (the flagship insight): unlocks on
  // the first marksheet saved, since one substrand's marks is enough to
  // reason "they didn't grasp A, so C is at risk."
  TIER1_MIN_ASSESSMENTS: 1,

  // Tier 2 — risk trends, formative signals, intervention check-ins: these
  // need a second data point to mean anything (is it new or persistent?).
  TIER2_MIN_ASSESSMENTS: 2,
  TIER2_MIN_WEEKS_OF_SIGNAL: 2,

  // Tier 3 — career moments, teaching-pattern self-insight: nice-to-have
  // layers that only make sense with roughly a full term of history.
  TIER3_MIN_WEEKS_OF_SIGNAL: 10,
} as const

export type AttentionFeedTier = 0 | 1 | 2 | 3
