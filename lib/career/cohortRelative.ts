// lib/career/cohortRelative.ts
//
// FIX 5 — cohort-relative capability, the pure math. No DB, no network: the
// orchestration layer loads the cohort and hands it in.
//
// Why it exists: raw CBC levels mix a learner's ability with the quality of
// their school. A learner at "developing" in a school where most peers are
// "emerging" is in a different position from the same learner in a school
// where most are "strong". This view adds that context ALONGSIDE the absolute
// profile — it replaces nothing and is never read by the match engine.
//
// Method (deterministic): mid-rank percentile per dimension, on the normalized
// 0–1 raw_score scale.
//   percentile = 100 × (peers strictly below + 0.5 × (peers tied + 1)) / n
// where n counts the learner plus every peer WITH EVIDENCE for that dimension.
// A peer or learner with confidence 0 for a dimension has no measurement there
// (the 0.35 placeholder is not a score — same rule as the match engine), so it
// is left out of that dimension entirely.

import { COHORT_RELATIVE_MIN_LEARNERS } from '@/lib/config/careerCohort'
import type { CapabilityDimension, CapabilityProfile, CohortRelative } from './types'

const DIMENSIONS: CapabilityDimension[] = [
  'analytical_reasoning', 'communication', 'creative_thinking',
  'technical_aptitude', 'social_intelligence', 'resilience',
]

export const COHORT_RELATIVE_METHOD =
  'Mid-rank percentile among learners in the same school and grade, per dimension, using each peer\'s most recently ' +
  'saved capability profile. Learners without evidence for a dimension are left out of that dimension.'

export function computeCohortRelative(
  learner: CapabilityProfile,
  peers: CapabilityProfile[],
  cohort: { schoolId: string; grade: number },
  minimum: number = COHORT_RELATIVE_MIN_LEARNERS,
): CohortRelative {
  const size = peers.length + 1   // the learner counts as a cohort member
  if (size < minimum) {
    return {
      status: 'insufficient_cohort',
      cohort: { ...cohort, size },
      minimumCohortSize: minimum,
      reason: `Only ${size} learner${size === 1 ? '' : 's'} in this school and grade have capability evidence; at least ${minimum} are needed before a comparison means anything.`,
    }
  }

  const percentiles = {} as Record<CapabilityDimension, number | null>
  for (const dim of DIMENSIONS) {
    const own = learner[dim]
    if (!own || own.confidence === 0) {
      percentiles[dim] = null
      continue
    }
    const peerScores = peers
      .map(p => p[dim])
      .filter(s => s && s.confidence > 0)
      .map(s => s.raw_score)
    const n = peerScores.length + 1
    if (n < minimum) {
      percentiles[dim] = null
      continue
    }
    const below = peerScores.filter(s => s < own.raw_score).length
    const tied  = peerScores.filter(s => s === own.raw_score).length
    percentiles[dim] = Math.round((100 * (below + 0.5 * (tied + 1))) / n)
  }

  return {
    status: 'available',
    cohort: { ...cohort, size },
    minimumCohortSize: minimum,
    percentiles,
    method: COHORT_RELATIVE_METHOD,
  }
}
