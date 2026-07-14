// lib/career/capabilityMatchEngine.ts
// Phase 2: Capability-to-Career Bridge
//
// Deterministic, token-free career matching using the 6-dimension capability
// profile produced by capabilityExtractor.ts and the required_capabilities
// seeded on each career in Phase 1.
//
// Design goals:
//   - Instant (no AI calls)
//   - Evidence-based (shows exactly which dimensions match/gap)
//   - Honest (does not inflate scores for careers with missing COS data)
//   - Reality-grounded (KCSE reachability, cost barrier, demand signal)

import { CAPABILITY_LABELS, LEVEL_DESCRIPTIONS } from './capabilityExtractor'
import { COS_DISCLAIMER } from './types'
import type { ConfidenceLevel } from '@/lib/learnerIntelligence/insight'
import type {
  Career,
  CapabilityProfile,
  CapabilityDimension,
  CapabilityLevel,
  CareerCapabilityRequirements,
  CapabilityGap,
  CapabilityStrength,
  CapabilityCareerMatch,
  CapabilityMatchReport,
  CapabilityMatchTier,
  GapSeverity,
  RealityCheck,
} from './types'

// ── Dimension order (for consistent scoring) ──────────────────────────────────

const DIMENSIONS: CapabilityDimension[] = [
  'analytical_reasoning',
  'communication',
  'creative_thinking',
  'technical_aptitude',
  'social_intelligence',
  'resilience',
]

// ── Trend multipliers ─────────────────────────────────────────────────────────

const TREND_MULTIPLIER: Record<string, number> = {
  accelerating: 1.08,
  growing:      1.04,
  stable:       1.00,
  declining:    0.94,
}

// ── Core scoring ─────────────────────────────────────────────────────────────

function scoreDimension(
  studentScore:  number,
  req:           { minimum: number; ideal: number; weight: number },
  trend:         string
): number {
  let base: number

  if (studentScore >= req.ideal) {
    base = req.weight                                   // full credit
  } else if (studentScore >= req.minimum) {
    const t = (studentScore - req.minimum) / (req.ideal - req.minimum)
    base = req.weight * (0.5 + 0.5 * t)                // 50%→100% of weight
  } else {
    const gap      = req.minimum - studentScore
    const severity = Math.min(1, gap / Math.max(req.minimum, 0.1))
    base = req.weight * Math.max(0, 0.5 - severity * 0.65)  // 0%→50% of weight
  }

  return base * (TREND_MULTIPLIER[trend] ?? 1.0)
}

// ── Gap/strength extraction ────────────────────────────────────────────────────

function gapSeverity(studentScore: number, minimum: number): GapSeverity {
  const gap = minimum - studentScore
  if (gap <= 0)    return 'none'
  if (gap < 0.10)  return 'minor'
  if (gap < 0.25)  return 'moderate'
  return 'significant'
}

function gapNarrative(
  dimension: CapabilityDimension,
  studentLevel: CapabilityLevel,
  severity: GapSeverity,
  careerTitle: string,
  minimum: number,
  ideal: number
): string {
  const label = CAPABILITY_LABELS[dimension]
  const minLevel: CapabilityLevel = minimum >= 0.85 ? 'exceptional'
    : minimum >= 0.70 ? 'strong'
    : minimum >= 0.50 ? 'capable'
    : minimum >= 0.30 ? 'developing'
    : 'emerging'

  if (severity === 'minor') {
    return `Your ${label} is close to the threshold for ${careerTitle} — one more step of consistent progress will close this gap.`
  }
  if (severity === 'moderate') {
    return `Your ${label} is at ${studentLevel} — ${careerTitle} typically needs ${minLevel}. Focused effort in this area will make a real difference.`
  }
  return `${label} is the main gap for ${careerTitle}. You are currently at ${studentLevel} and the career requires ${minLevel} as a minimum. This is achievable but needs deliberate attention.`
}

function strengthNarrative(
  dimension: CapabilityDimension,
  level: CapabilityLevel,
  careerTitle: string
): string {
  const label = CAPABILITY_LABELS[dimension]
  const desc  = LEVEL_DESCRIPTIONS[dimension]?.[level] ?? ''
  return `${label} is a genuine asset for ${careerTitle}${desc ? ` — ${desc}` : ''}`
}

// ── Reality check ─────────────────────────────────────────────────────────────

function buildRealityCheck(career: Career, profile: CapabilityProfile): RealityCheck {
  // KCSE achievability: crude heuristic based on analytical + technical capability
  // vs stated overall grade requirement
  let kcse_achievable = true
  const kcseGrade = career.kcse_minimum?.overall_grade ?? 'C'
  const analytic  = profile.analytical_reasoning.raw_score
  const technical = profile.technical_aptitude.raw_score

  if      (kcseGrade === 'A' || kcseGrade === 'A-') kcse_achievable = analytic >= 0.70 && technical >= 0.60
  else if (kcseGrade === 'B+')                       kcse_achievable = analytic >= 0.55
  else if (kcseGrade === 'B')                        kcse_achievable = analytic >= 0.45
  else if (kcseGrade === 'B-')                       kcse_achievable = analytic >= 0.35
  // C+ and below: always achievable

  // Cost barrier
  const minCost = career.cost_to_qualify?.min ?? 0
  const cost_barrier: 'low' | 'medium' | 'high' =
    minCost > 500000 ? 'high' :
    minCost > 150000 ? 'medium' : 'low'

  return {
    kcse_achievable,
    cost_barrier,
    time_to_income_years: career.time_to_income_years ?? 4,
    risk_level:           career.risk_level           ?? 'medium',
    difficulty:           career.difficulty           ?? 'moderate',
    kenya_demand:         career.kenya_demand         ?? 'balanced',
  }
}

// ── Confidence labeling ────────────────────────────────────────────────────────
// The same thresholds scoreCareer() already uses to cap alignment_score for
// thin evidence (assessment_count < 2 / < 3) — labeled, not re-derived, so
// the Low/Medium/High shown to a learner always agrees with the score that
// produced their tier. Longitudinal evidence (3+ assessments) is the only
// case that earns High — matching the "longitudinal evidence -> high
// confidence guidance" ladder every Career Intelligence consumer follows.
export function confidenceFromAssessmentCount(assessmentCount: number): ConfidenceLevel {
  if (assessmentCount < 2) return 'Low'
  if (assessmentCount < 3) return 'Medium'
  return 'High'
}

// ── Match narrative ───────────────────────────────────────────────────────────

function buildMatchNarrative(
  tier:      CapabilityMatchTier,
  career:    Career,
  gaps:      CapabilityGap[],
  strengths: CapabilityStrength[],
  score:     number,
  profile:   CapabilityProfile,
  confidence: ConfidenceLevel
): string {
  const topStrength = strengths[0]
  const topGap      = gaps.find(g => g.gap_severity === 'significant') ?? gaps[0]
  // A 'primary' tier match resting on thin evidence must still read as
  // provisional — the tier alone ("Strong Match") should never carry more
  // certainty than the evidence behind it does.
  const confidenceCaveat = confidence !== 'High'
    ? ` Confidence is ${confidence.toLowerCase()} because this is based on a small number of assessments so far — this will sharpen as more evidence arrives.`
    : ''

  if (tier === 'primary') {
    const strengthPart = topStrength
      ? `Current evidence suggests your ${CAPABILITY_LABELS[topStrength.dimension]} is a strong signal here.`
      : `Current evidence suggests your capability profile maps well to the demands of this career.`
    const gapPart = topGap
      ? ` The area to watch is ${CAPABILITY_LABELS[topGap.dimension]} — ${topGap.narrative}`
      : ` Your profile shows no critical gaps for this path so far.`
    return `Based on available evidence, ${career.title} looks like a strong match for your current capability profile. ${strengthPart}${gapPart}${confidenceCaveat}`
  }

  if (tier === 'stretch') {
    const gapPart = topGap
      ? `The main gap is ${CAPABILITY_LABELS[topGap.dimension]} — ${topGap.narrative}`
      : `You are close across the board — consistency will close the remaining gaps.`
    const strengthPart = topStrength
      ? ` Your ${CAPABILITY_LABELS[topStrength.dimension]} is already an asset.`
      : ''
    return `Current evidence suggests ${career.title} is within reach with focused development.${strengthPart} ${gapPart}${confidenceCaveat}`
  }

  if (tier === 'alternative') {
    const mainGap = gaps.find(g => g.gap_severity === 'significant')
    return `Current evidence suggests ${career.title} is a possible path worth exploring, though it would require significant growth${mainGap ? ` in ${CAPABILITY_LABELS[mainGap.dimension]}` : ''}. Consider it a longer-term goal while building your capabilities.`
  }

  // entrepreneurial
  return `Based on available evidence, the entrepreneurial door of ${career.title} looks well-suited for your cluster. Starting your own venture in this space requires less formal qualification and lets your strongest capabilities lead.${confidenceCaveat}`
}

// ── Main scoring function ─────────────────────────────────────────────────────

function scoreCareer(
  career:  Career,
  profile: CapabilityProfile
): {
  score:           number
  dimensionScores: Partial<Record<CapabilityDimension, number>>
  gaps:            CapabilityGap[]
  strengths:       CapabilityStrength[]
} | null {
  const req = career.required_capabilities
  if (!req) return null   // career has no COS data yet — skip

  let totalWeight  = 0
  let totalScore   = 0
  const dimensionScores: Partial<Record<CapabilityDimension, number>> = {}
  const gaps:      CapabilityGap[]      = []
  const strengths: CapabilityStrength[] = []

  for (const dim of DIMENSIONS) {
    const dimReq     = req[dim]
    const dimProfile = profile[dim]
    if (!dimReq || !dimProfile) continue

    const contribution = scoreDimension(dimProfile.raw_score, dimReq, dimProfile.trend)
    dimensionScores[dim] = contribution
    totalWeight  += dimReq.weight
    totalScore   += contribution

    const severity = gapSeverity(dimProfile.raw_score, dimReq.minimum)

    if (severity !== 'none') {
      gaps.push({
        dimension:        dim,
        student_level:    dimProfile.level,
        student_score:    dimProfile.raw_score,
        required_minimum: dimReq.minimum,
        required_ideal:   dimReq.ideal,
        gap_severity:     severity,
        narrative:        gapNarrative(dim, dimProfile.level, severity, career.title, dimReq.minimum, dimReq.ideal),
      })
    } else if (dimProfile.raw_score >= dimReq.ideal) {
      strengths.push({
        dimension: dim,
        level:     dimProfile.level,
        narrative: strengthNarrative(dim, dimProfile.level, career.title),
      })
    }
  }

  if (totalWeight === 0) return null

  let rawScore = totalScore / totalWeight

  // Confidence cap: low assessment count → constrain score ceiling
  if (profile.assessment_count < 2) rawScore = Math.min(rawScore, 0.65)
  else if (profile.assessment_count < 3) rawScore = Math.min(rawScore, 0.80)

  // Sort: significant gaps first, then moderate, then minor
  const severityOrder: GapSeverity[] = ['significant', 'moderate', 'minor', 'none']
  gaps.sort((a, b) => severityOrder.indexOf(a.gap_severity) - severityOrder.indexOf(b.gap_severity))

  return { score: rawScore, dimensionScores, gaps, strengths }
}

// ── Tier classification ────────────────────────────────────────────────────────

function classifyTier(score: number): CapabilityMatchTier {
  if (score >= 0.70) return 'primary'
  if (score >= 0.50) return 'stretch'
  return 'alternative'
}

// ── Entrepreneurial tier logic ─────────────────────────────────────────────────
// Students whose dominant cluster includes creative_thinking, resilience, or
// social_intelligence get an explicit entrepreneurial tier regardless of alignment
// score — because those capabilities are most predictive of entrepreneurial success.

const ENTREPRENEURIAL_DIMENSIONS: CapabilityDimension[] = [
  'creative_thinking',
  'resilience',
  'social_intelligence',
]

// Requires 2+ assessments — the same evidence-volume floor scoreCareer()
// applies to every other tier via its confidence cap (assessment_count < 2
// caps rawScore at 0.65). Without this gate, a single high score on one
// entrepreneurial-adjacent dimension could promote a specific career
// (entrepreneur-business) on thinner evidence than any other tier allows.
function qualifiesForEntrepreneurialTier(profile: CapabilityProfile): boolean {
  if (profile.assessment_count < 2) return false
  return ENTREPRENEURIAL_DIMENSIONS.some(
    dim => profile[dim].raw_score >= 0.50 || profile.dominant_cluster.includes(dim)
  )
}

// ── Public API ────────────────────────────────────────────────────────────────

export function computeCapabilityMatches(
  studentId: string,
  profile:   CapabilityProfile,
  careers:   Career[]
): CapabilityMatchReport {
  const primary:        CapabilityCareerMatch[] = []
  const stretch:        CapabilityCareerMatch[] = []
  const alternative:    CapabilityCareerMatch[] = []
  const entrepreneurial:CapabilityCareerMatch[] = []
  let   totalScored = 0

  const showEntrepreneurial = qualifiesForEntrepreneurialTier(profile)
  const confidence = confidenceFromAssessmentCount(profile.assessment_count)

  for (const career of careers) {
    const result = scoreCareer(career, profile)
    if (!result) continue
    totalScored++

    const tier = classifyTier(result.score)
    const realityCheck = buildRealityCheck(career, profile)
    const narrative    = buildMatchNarrative(
      tier, career, result.gaps, result.strengths, result.score, profile, confidence
    )

    const match: CapabilityCareerMatch = {
      career_slug:      career.slug,
      career_title:     career.title,
      career_category:  career.category,
      pathway:          career.pathway,
      tier,
      alignment_score:  Math.round(result.score * 1000) / 1000,
      confidence,
      dimension_scores: result.dimensionScores,
      gaps:             result.gaps,
      strengths:        result.strengths,
      reality_check:    realityCheck,
      narrative,
      disclaimer:       COS_DISCLAIMER,
    }

    if (tier === 'primary')       primary.push(match)
    else if (tier === 'stretch')  stretch.push(match)
    else                          alternative.push(match)

    // Entrepreneurial tier: entrepreneur-business career gets special promotion
    // if the student has entrepreneurial capability signals
    if (showEntrepreneurial && career.slug === 'entrepreneur-business') {
      entrepreneurial.push({
        ...match,
        tier:      'entrepreneurial',
        narrative: buildMatchNarrative('entrepreneurial', career, result.gaps, result.strengths, result.score, profile, confidence),
      })
    }
  }

  // Sort each tier by alignment_score descending
  const byScore = (a: CapabilityCareerMatch, b: CapabilityCareerMatch) =>
    b.alignment_score - a.alignment_score

  return {
    student_id:           studentId,
    primary:              primary.sort(byScore).slice(0, 5),
    stretch:              stretch.sort(byScore).slice(0, 5),
    alternative:          alternative.sort(byScore).slice(0, 3),
    entrepreneurial:      entrepreneurial,
    total_careers_scored: totalScored,
    assessment_count:     profile.assessment_count,
    dominant_cluster:     profile.dominant_cluster,
    generated_at:         new Date().toISOString(),
    disclaimer:           COS_DISCLAIMER,
  }
}

// ── Score to percentage helper (for UI) ──────────────────────────────────────

export function alignmentToPercent(score: number): number {
  return Math.round(score * 100)
}

export function tierLabel(tier: CapabilityMatchTier): string {
  const labels: Record<CapabilityMatchTier, string> = {
    primary:        'Strong Match',
    stretch:        'Stretch Goal',
    alternative:    'Alternative Path',
    entrepreneurial:'Entrepreneurial Opportunity',
  }
  return labels[tier]
}

export function tierColor(tier: CapabilityMatchTier): string {
  const colors: Record<CapabilityMatchTier, string> = {
    primary:        'green',
    stretch:        'blue',
    alternative:    'amber',
    entrepreneurial:'purple',
  }
  return colors[tier]
}

export function demandLabel(demand: string): string {
  const labels: Record<string, string> = {
    critical_shortage: 'Critical Shortage — very high demand',
    undersupplied:     'Undersupplied — more jobs than qualified candidates',
    balanced:          'Balanced — stable demand',
    saturated:         'Saturated — competitive entry',
  }
  return labels[demand] ?? demand
}
