// lib/career/growthEngine.ts
// Phase 7: Student Growth Engine — compute capability deltas between assessment snapshots.
import type {
  CapabilityProfile, CapabilityDimension,
  CapabilityGrowthReport, DimensionGrowth, GrowthDirection,
} from './types'
import { COS_DISCLAIMER } from './types'
import { CAPABILITY_LABELS } from './capabilityExtractor'

const DIMENSIONS: CapabilityDimension[] = [
  'analytical_reasoning', 'communication', 'creative_thinking',
  'technical_aptitude', 'social_intelligence', 'resilience',
]

export function computeCapabilityGrowth(
  studentId: string,
  current: CapabilityProfile,
  previous: CapabilityProfile | null
): CapabilityGrowthReport {
  const currentAt  = current.computed_at
  const previousAt = previous?.computed_at ?? null

  const weeksTracked = previousAt
    ? Math.max(0, Math.round(
        (new Date(currentAt).getTime() - new Date(previousAt).getTime())
        / (7 * 24 * 60 * 60 * 1000)
      ))
    : 0

  const dimensions: DimensionGrowth[] = DIMENSIONS.map(dim => {
    const curr          = current[dim]
    const prev          = previous?.[dim]
    const currentScore  = curr.raw_score
    const previousScore = prev?.raw_score ?? currentScore
    const delta         = currentScore - previousScore

    const direction: GrowthDirection =
      delta >  0.04 ? 'improved' :
      delta < -0.04 ? 'declined' :
      'stable'

    return {
      dimension:        dim,
      previous_level:   prev?.level ?? curr.level,
      current_level:    curr.level,
      previous_score:   previousScore,
      current_score:    currentScore,
      delta,
      direction,
      weeks_since_last: weeksTracked,
    }
  })

  const improved = dimensions.filter(d => d.direction === 'improved').sort((a, b) => b.delta - a.delta)
  const declined = dimensions.filter(d => d.direction === 'declined').sort((a, b) => a.delta - b.delta)

  const biggestWin  = improved[0] ?? null
  const biggestDrop = declined[0] ?? null

  const overallDirection: GrowthDirection =
    improved.length > declined.length ? 'improved' :
    declined.length > improved.length ? 'declined' :
    'stable'

  let highlight = 'Capability profile stable across all dimensions.'
  if (!previous) {
    highlight = 'First profile computed — keep adding assessments to see your growth curve.'
  } else if (biggestWin) {
    const label = CAPABILITY_LABELS[biggestWin.dimension]
    highlight = biggestWin.previous_level !== biggestWin.current_level
      ? `${label} levelled up: ${biggestWin.previous_level} → ${biggestWin.current_level}`
      : `${label} score up by ${Math.round(biggestWin.delta * 100)} points`
  } else if (biggestDrop) {
    const label = CAPABILITY_LABELS[biggestDrop.dimension]
    highlight = `Watch: ${label} dipped slightly — more practice assessments will help stabilise it.`
  }

  return {
    student_id:           studentId,
    current_computed_at:  currentAt,
    previous_computed_at: previousAt,
    dimensions,
    overall_direction:    overallDirection,
    biggest_win:          biggestWin,
    biggest_drop:         biggestDrop,
    highlight,
    weeks_tracked:        weeksTracked,
    disclaimer:           COS_DISCLAIMER,
  }
}
