// lib/career/capabilityExtractor.ts
// Converts CBC subject scores into a 6-dimension capability profile.
// This is the core intelligence layer of the Career Operating System.
//
// Design principle: capabilities are more durable than grades.
// A learner who improves from 1.5→2.8 in Mathematics over 3 terms has
// stronger analytical capability signal than a learner static at 2.5.
// The trend IS the signal.

import { normalizeSubjectScores } from '@/lib/pathwayCalculator'
import { COS_DISCLAIMER } from './types'
import type {
  CapabilityProfile, CapabilityScore,
  CapabilityLevel, CapabilityTrendDirection,
} from './types'

// ── Subject → Capability weight maps ────────────────────────────────────────
// Weights are relative within each capability dimension. They don't need to
// sum to 1 — they are normalised against the total observed weight.

const ANALYTICAL_WEIGHTS: Record<string, number> = {
  mathematics:          0.40,
  core_mathematics:     0.40,
  integrated_science:   0.30,
  physics:              0.25,
  chemistry:            0.20,
  biology:              0.15,
  geography:            0.12,
  geo:                  0.12,
  computer_studies:     0.10,
}

const COMMUNICATION_WEIGHTS: Record<string, number> = {
  english:                       0.50,
  kiswahili:                     0.30,
  social_studies:                0.12,
  history:                       0.10,
  // 8-4-4's History & Government is a distinct subject from CBC's History &
  // Citizenship (see SUBJECT_KEY_ALIASES in lib/pathwayCalculator.ts) but
  // tests the same civics/communication-about-society skill — same weight.
  history_and_government:        0.10,
  cre:                           0.08,
  christian_religious_education: 0.08,
  ire:                           0.08,
  islamic_religious_education:   0.08,
  // HRE (Hindu Religious Education) is the third KCSE religion option
  // alongside CRE/IRE, same subject category — same weight as those.
  hre:                           0.08,
}

const CREATIVE_WEIGHTS: Record<string, number> = {
  creative_arts:        0.35,
  creative_arts_sports: 0.35,
  art_design:           0.30,
  music:                0.20,
  english:              0.10,   // composition component
  pre_technical:        0.08,
  pre_technical_studies:0.08,
}

const TECHNICAL_WEIGHTS: Record<string, number> = {
  pre_technical:         0.40,
  pre_technical_studies: 0.40,
  physics:               0.35,
  chemistry:             0.25,
  computer_studies:      0.25,
  mathematics:           0.15,
  core_mathematics:      0.15,
  integrated_science:    0.12,
}

const SOCIAL_WEIGHTS: Record<string, number> = {
  community_service_learning:    0.40,
  csl:                           0.40,
  social_studies:                0.30,
  cre:                           0.15,
  christian_religious_education: 0.15,
  ire:                           0.15,
  islamic_religious_education:   0.15,
  // HRE — same weight as CRE/IRE, same subject category.
  hre:                           0.15,
  // Business Studies (commerce/economics/accounting) is fundamentally about
  // understanding markets, organisations and people transacting — social
  // reasoning applied to commerce, not pure quantitative manipulation.
  // Weighted alongside CRE/IRE/HRE as a supporting (not primary) contributor.
  business_studies:              0.15,
  kiswahili:                     0.10,
  english:                       0.08,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// CBC Level 1–4 → 0.0–1.0
function normalizeCBC(score: number): number {
  return Math.max(0, Math.min(1, (score - 1) / 3))
}

function scoreToLevel(raw: number): CapabilityLevel {
  if (raw >= 0.85) return 'exceptional'
  if (raw >= 0.70) return 'strong'
  if (raw >= 0.50) return 'capable'
  if (raw >= 0.30) return 'developing'
  return 'emerging'
}

// Compute a weighted average from available subjects. Returns score, evidence
// list, and a confidence score (how much of the weight map was observed).
function weightedCapability(
  scores: Record<string, number>,
  weights: Record<string, number>
): { score: number; evidence: string[]; confidence: number } {
  let totalWeight = 0
  let weightedSum = 0
  const evidence: string[] = []

  for (const [subject, weight] of Object.entries(weights)) {
    const raw = scores[subject]
    if (raw !== undefined) {
      weightedSum += normalizeCBC(raw) * weight
      totalWeight += weight
      evidence.push(`${subject.replace(/_/g, ' ')}: ${raw}/4`)
    }
  }

  if (totalWeight === 0) {
    return { score: 0.35, evidence: [], confidence: 0 }
  }

  // Max possible total weight — proxy for "fully observed"
  const maxWeight = Object.values(weights).reduce((s, w) => s + w, 0)
  return {
    score:      weightedSum / totalWeight,
    evidence,
    confidence: Math.min(1, totalWeight / maxWeight),
  }
}

// ── Trend Detection ───────────────────────────────────────────────────────────
// Takes a series of capability raw_scores (oldest → newest).
//
// H2D Decision B (docs/architecture/adr-0029-addendum-h2d-capability-convergence.md):
// this is the platform's **momentumTrend** concept — "is the learner's
// recent half of history stronger or weaker than their earlier half."
// First-half average vs. second-half average, a recency-weighted momentum
// signal, deliberately not the same question as Projection's
// computeTrend() (lib/projection/academicProjector.ts), which answers
// **netTrend** — "what changed from the very first point to the very
// last." A spike-then-return history can read as momentumTrend
// 'accelerating' here and netTrend 'stable' there; both are correct
// answers to different questions. Do not unify these two functions.

function detectTrend(history: number[]): CapabilityTrendDirection {
  if (history.length < 2) return 'stable'

  const n = history.length
  const last  = history[n - 1]
  const first = history[0]
  const totalDelta = last - first

  // With 3+ points, look at the rate of change across the last half
  if (n >= 3) {
    const midIdx  = Math.floor(n / 2)
    const earlyAvg = history.slice(0, midIdx).reduce((a, b) => a + b, 0) / midIdx
    const lateAvg  = history.slice(midIdx).reduce((a, b) => a + b, 0) / (n - midIdx)
    const delta = lateAvg - earlyAvg
    if (delta > 0.18) return 'accelerating'
    if (delta > 0.07) return 'growing'
    if (delta < -0.07) return 'declining'
    return 'stable'
  }

  // Only 2 points
  if (totalDelta > 0.10) return 'growing'
  if (totalDelta < -0.10) return 'declining'
  return 'stable'
}

// ── Resilience Computation ────────────────────────────────────────────────────
// Resilience is not derived from a single subject — it's a meta-signal from
// the trajectory across all subjects over time.
//
// FIX 1 (Career Intelligence corrective pass). The previous version scored
// only each subject's first→last delta, which (a) gave a learner who held CBC
// 3.8 every term ~0.43 "developing" because flat cannot "improve", and (b)
// gave near-maximum credit to a learner whose only "growth" was one bad first
// assessment followed by their normal level (regression to the mean). Each
// subject is now classified into exactly one trajectory category, so
// stability, improvement and recovery are separate signals.
//
// SCALES — read before touching any threshold:
//   * Per-subject values here are RAW CBC 1–4. normalizeSubjectScores() only
//     canonicalises subject KEYS; it never rescales values. Every *_CBC
//     constant below is therefore in CBC points.
//   * The stable-hold credit converts a subject's average level to the
//     NORMALIZED 0–1 scale via normalizeCBC before weighting it.
//   * The overall trend uses detectTrend() on NORMALIZED 0–1 per-assessment
//     averages (unchanged).
//   * Every *_CREDIT / *_PENALTY / *_BONUS and the ceiling are on the
//     resilience raw_score scale, NORMALIZED 0–1.

/** CBC 1–4. A first→last rise above this is improvement (unchanged from before). */
const RESILIENCE_IMPROVE_DELTA_CBC = 0.25
/** CBC 1–4. A first→last rise at or above this is strong momentum (unchanged). */
const RESILIENCE_STRONG_MOMENTUM_DELTA_CBC = 0.75
/** CBC 1–4. A first→last fall below minus this is decline (unchanged). */
const RESILIENCE_DECLINE_DELTA_CBC = 0.25
/** CBC 1–4. A consecutive move bigger than this counts as a "big move" (dips, volatility). */
const RESILIENCE_BIG_MOVE_CBC = 0.25
/** CBC 1–4 (≈ normalized 0.83). A subject held at or above this at every point is sustained strength. */
const RESILIENCE_SUSTAINED_STRONG_MIN_CBC = 3.5
/** Minimum points in one subject before sustained strength or a bad-first pattern can be judged. */
const RESILIENCE_MIN_POINTS_FOR_PATTERN = 3
/** CBC 1–4. After one low first point, the remaining points must sit within this range to count as "settled". */
const RESILIENCE_SETTLED_RANGE_CBC = 0.5

/** Normalized 0–1 resilience credits, each multiplied by the share of subjects in that category. */
const RESILIENCE_BASE              = 0.35
const RESILIENCE_IMPROVE_CREDIT    = 0.40
// 0.33 (not 0.30) keeps an all-subjects recovery off the 0.70 "strong"
// boundary: 0.73 with 4+ assessments, 0.68 with 3.
const RESILIENCE_RECOVERY_CREDIT   = 0.33
const RESILIENCE_BAD_FIRST_CREDIT  = 0.15
const RESILIENCE_SUSTAINED_CREDIT  = 0.25
// 0.20 (not 0.15) so a learner flat at CBC 3.0 lands clearly inside
// "capable" rather than on the 0.50 boundary, where float rounding decided
// the label. Scaled by the normalized level held, so flat-low earns ~0.03.
const RESILIENCE_STABLE_HOLD_CREDIT = 0.20
const RESILIENCE_DECLINE_PENALTY   = 0.20
const RESILIENCE_MOMENTUM_BONUS    = 0.08
const RESILIENCE_LONGEVITY_BONUS   = 0.05
/**
 * Normalized 0–1. With no improving and no recovered subject, resilience may
 * not reach "strong" (scoreToLevel's 0.70) — stability alone earns at most
 * "capable". Strong requires actual upward movement or a genuine recovery.
 */
const RESILIENCE_STABILITY_ONLY_CEILING = 0.69

type SubjectTrajectory =
  | 'volatile' | 'recovered' | 'declining' | 'bad_first'
  | 'improving' | 'sustained_strong' | 'stable'

function subjectLabel(subject: string): string {
  return subject
    .split('_')
    .map(w => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/**
 * Number of direction reversals among big consecutive moves (CBC 1–4).
 * down→up→down or up→down→up is 2. A monotonic decline is 0, a single dip
 * and recovery is 1.
 */
function bigMoveReversals(history: number[]): number {
  const signs: number[] = []
  for (let i = 1; i < history.length; i++) {
    const d = history[i] - history[i - 1]
    if (Math.abs(d) > RESILIENCE_BIG_MOVE_CBC) signs.push(Math.sign(d))
  }
  let reversals = 0
  for (let i = 1; i < signs.length; i++) {
    if (signs[i] !== signs[i - 1]) reversals++
  }
  return reversals
}

/**
 * Genuine mid-history recovery (CBC 1–4): some point after the first drops
 * more than RESILIENCE_BIG_MOVE_CBC below the peak reached BEFORE it, and the
 * subject's latest point is back at or above that earlier peak. A low FIRST
 * point can never qualify — there is no earlier high for it to fall from —
 * which is what separates recovery from regression to the mean.
 */
function findRecovery(history: number[]): { peak: number; trough: number } | null {
  for (let k = 1; k < history.length; k++) {
    const peakBefore = Math.max(...history.slice(0, k))
    if (history[k] < peakBefore - RESILIENCE_BIG_MOVE_CBC && history[history.length - 1] >= peakBefore) {
      return { peak: peakBefore, trough: Math.min(...history.slice(k)) }
    }
  }
  return null
}

/**
 * One low first point, then the learner's normal level (CBC 1–4): the first
 * point is the strict minimum, the rest sit clearly above it, and the rest
 * are settled within RESILIENCE_SETTLED_RANGE_CBC. Counts as a return to the
 * learner's usual level, not as growth.
 */
function isBadFirstPoint(history: number[]): boolean {
  if (history.length < RESILIENCE_MIN_POINTS_FOR_PATTERN) return false
  const [first, ...rest] = history
  if (!rest.every(v => v > first)) return false
  const restAvg = rest.reduce((a, b) => a + b, 0) / rest.length
  const restRange = Math.max(...rest) - Math.min(...rest)
  return restAvg - first > RESILIENCE_BIG_MOVE_CBC && restRange <= RESILIENCE_SETTLED_RANGE_CBC
}

function computeResilience(
  allHistory: Array<Record<string, number>>
): CapabilityScore {
  if (allHistory.length < 2) {
    return {
      level:      'developing',
      raw_score:  0.40,
      trend:      'stable',
      evidence:   ['Need at least 2 assessments to measure resilience accurately'],
      confidence: 0.15,
    }
  }

  const allSubjects = [...new Set(allHistory.flatMap(s => Object.keys(s)))]
  const counts: Record<SubjectTrajectory, number> = {
    volatile: 0, recovered: 0, declining: 0, bad_first: 0,
    improving: 0, sustained_strong: 0, stable: 0,
  }
  let strongMomentumCount = 0
  let stableHoldNormalizedSum = 0
  const evidence: string[] = []

  for (const subject of allSubjects) {
    const subjectHistory = allHistory
      .map(s => s[subject])
      .filter((v): v is number => v !== undefined)

    if (subjectHistory.length < 2) continue

    const label = subjectLabel(subject)
    const first = subjectHistory[0]
    const last  = subjectHistory[subjectHistory.length - 1]
    const delta = last - first   // CBC 1–4
    const recovery = findRecovery(subjectHistory)

    // Exactly one category per subject, checked in this order.
    if (bigMoveReversals(subjectHistory) >= 2) {
      // Noisy oscillation is never rewarded as resilience. If it also nets
      // downward it still carries the decline penalty.
      if (delta < -RESILIENCE_DECLINE_DELTA_CBC) {
        counts.declining++
        evidence.push(`${label} moved up and down sharply and ended lower (${first.toFixed(1)} → ${last.toFixed(1)})`)
      } else {
        counts.volatile++
        evidence.push(`${label} moved up and down sharply — not counted as growth`)
      }
    } else if (recovery) {
      counts.recovered++
      evidence.push(`Recovered in ${label} after a dip (${recovery.peak.toFixed(1)} → ${recovery.trough.toFixed(1)} → ${last.toFixed(1)})`)
    } else if (delta < -RESILIENCE_DECLINE_DELTA_CBC) {
      counts.declining++
      evidence.push(`Declined in ${label} (${first.toFixed(1)} → ${last.toFixed(1)})`)
    } else if (isBadFirstPoint(subjectHistory)) {
      counts.bad_first++
      evidence.push(`${label} returned to its usual level after one low early assessment (${first.toFixed(1)} → ${last.toFixed(1)})`)
    } else if (delta > RESILIENCE_IMPROVE_DELTA_CBC) {
      counts.improving++
      if (delta >= RESILIENCE_STRONG_MOMENTUM_DELTA_CBC) strongMomentumCount++
      evidence.push(`Improved in ${label} (${first.toFixed(1)} → ${last.toFixed(1)}, +${delta.toFixed(1)})`)
    } else if (
      subjectHistory.length >= RESILIENCE_MIN_POINTS_FOR_PATTERN &&
      Math.min(...subjectHistory) >= RESILIENCE_SUSTAINED_STRONG_MIN_CBC
    ) {
      counts.sustained_strong++
      evidence.push(`Held strong performance in ${label} across ${subjectHistory.length} assessments`)
    } else {
      counts.stable++
      const avg = subjectHistory.reduce((a, b) => a + b, 0) / subjectHistory.length
      stableHoldNormalizedSum += normalizeCBC(avg)   // normalized 0–1
    }
  }

  const classified = Object.values(counts).reduce((a, b) => a + b, 0)
  const rate = (n: number): number => (classified > 0 ? n / classified : 0)
  const avgStableHold = counts.stable > 0 ? stableHoldNormalizedSum / counts.stable : 0

  let raw = RESILIENCE_BASE
    + rate(counts.improving)        * RESILIENCE_IMPROVE_CREDIT
    + rate(counts.recovered)        * RESILIENCE_RECOVERY_CREDIT
    + rate(counts.bad_first)        * RESILIENCE_BAD_FIRST_CREDIT
    + rate(counts.sustained_strong) * RESILIENCE_SUSTAINED_CREDIT
    + rate(counts.stable) * avgStableHold * RESILIENCE_STABLE_HOLD_CREDIT
    - rate(counts.declining)        * RESILIENCE_DECLINE_PENALTY
    + (strongMomentumCount > 0 ? RESILIENCE_MOMENTUM_BONUS : 0)
    + (allHistory.length >= 4 ? RESILIENCE_LONGEVITY_BONUS : 0)

  if (counts.improving + counts.recovered === 0) {
    raw = Math.min(raw, RESILIENCE_STABILITY_ONLY_CEILING)
  }
  raw = Math.max(0.05, Math.min(1, raw))

  // Trend: look at average overall score across assessment snapshots
  const avgPerAssessment = allHistory.map(s => {
    const vals = Object.values(s)
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }).map(normalizeCBC)

  const defaultEvidence = evidence.length > 0
    ? evidence
    : [`Held a steady level in ${counts.stable} of ${classified} subjects assessed`]

  return {
    level:      scoreToLevel(raw),
    raw_score:  raw,
    trend:      detectTrend(avgPerAssessment),
    evidence:   defaultEvidence,
    confidence: Math.min(1, allHistory.length / 4),
  }
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Extracts a 6-dimension capability profile from a student's assessment history.
 *
 * @param scoreHistory  Assessment snapshots, oldest first. Each entry is a
 *                      subject_scores map as stored in the `assessments` table.
 *                      Must include at least 1 entry (the current assessment).
 */
export function extractCapabilityProfile(
  scoreHistory: Array<Record<string, number>>
): CapabilityProfile {
  if (scoreHistory.length === 0) {
    throw new Error('extractCapabilityProfile requires at least one assessment snapshot')
  }

  // Normalise shorthand keys (emat → essential_mathematics, geo → geography…)
  // so the weights match the same keys used throughout the system.
  const normalized = scoreHistory.map(s => normalizeSubjectScores(s))
  const current    = normalized[normalized.length - 1]

  // ── 6 dimensions ────────────────────────────────────────────────────────────

  const analytical = weightedCapability(current, ANALYTICAL_WEIGHTS)
  const comm       = weightedCapability(current, COMMUNICATION_WEIGHTS)
  const creative   = weightedCapability(current, CREATIVE_WEIGHTS)
  const technical  = weightedCapability(current, TECHNICAL_WEIGHTS)
  const social     = weightedCapability(current, SOCIAL_WEIGHTS)

  // Build per-dimension history arrays for trend detection
  const analyticalHistory = normalized.map(s => weightedCapability(s, ANALYTICAL_WEIGHTS).score)
  const commHistory       = normalized.map(s => weightedCapability(s, COMMUNICATION_WEIGHTS).score)
  const creativeHistory   = normalized.map(s => weightedCapability(s, CREATIVE_WEIGHTS).score)
  const technicalHistory  = normalized.map(s => weightedCapability(s, TECHNICAL_WEIGHTS).score)
  const socialHistory     = normalized.map(s => weightedCapability(s, SOCIAL_WEIGHTS).score)

  const resilience = computeResilience(normalized)

  // ── Cluster detection ───────────────────────────────────────────────────────

  const dimensionScores: Array<[string, number]> = [
    ['analytical_reasoning', analytical.score],
    ['communication',        comm.score],
    ['creative_thinking',    creative.score],
    ['technical_aptitude',   technical.score],
    ['social_intelligence',  social.score],
    ['resilience',           resilience.raw_score],
  ]
  dimensionScores.sort((a, b) => b[1] - a[1])

  const dominant = dimensionScores
    .filter(([, s]) => s >= 0.60)
    .slice(0, 2)
    .map(([name]) => name)

  const emerging = dimensionScores
    .filter(([name, s]) => s >= 0.40 && s < 0.60 && !dominant.includes(name))
    .slice(0, 2)
    .map(([name]) => name)

  // ── Low-confidence evidence fallbacks ────────────────────────────────────────

  function withFallback(
    score: { score: number; evidence: string[]; confidence: number },
    label: string
  ): { score: number; evidence: string[]; confidence: number } {
    if (score.evidence.length === 0) {
      return {
        ...score,
        evidence: [`No ${label} subjects assessed yet — score is an estimate`],
      }
    }
    return score
  }

  const aFull = withFallback(analytical, 'analytical')
  const cFull = withFallback(comm,       'communication')
  const crFull= withFallback(creative,   'creative')
  const tFull = withFallback(technical,  'technical')
  const sFull = withFallback(social,     'social')

  return {
    analytical_reasoning: {
      level:      scoreToLevel(aFull.score),
      raw_score:  aFull.score,
      trend:      detectTrend(analyticalHistory),
      evidence:   aFull.evidence,
      confidence: aFull.confidence,
    },
    communication: {
      level:      scoreToLevel(cFull.score),
      raw_score:  cFull.score,
      trend:      detectTrend(commHistory),
      evidence:   cFull.evidence,
      confidence: cFull.confidence,
    },
    creative_thinking: {
      level:      scoreToLevel(crFull.score),
      raw_score:  crFull.score,
      trend:      detectTrend(creativeHistory),
      evidence:   crFull.evidence,
      confidence: crFull.confidence,
    },
    technical_aptitude: {
      level:      scoreToLevel(tFull.score),
      raw_score:  tFull.score,
      trend:      detectTrend(technicalHistory),
      evidence:   tFull.evidence,
      confidence: tFull.confidence,
    },
    social_intelligence: {
      level:      scoreToLevel(sFull.score),
      raw_score:  sFull.score,
      trend:      detectTrend(socialHistory),
      evidence:   sFull.evidence,
      confidence: sFull.confidence,
    },
    resilience,
    dominant_cluster:  dominant,
    emerging_cluster:  emerging,
    computed_at:       new Date().toISOString(),
    assessment_count:  scoreHistory.length,
    disclaimer:        COS_DISCLAIMER,
  }
}

// ── Capability narrative helpers ───────────────────────────────────────────────
// Plain-English descriptions for UI rendering.

export const CAPABILITY_LABELS: Record<string, string> = {
  analytical_reasoning: 'Analytical Reasoning',
  communication:        'Communication',
  creative_thinking:    'Creative Thinking',
  technical_aptitude:   'Technical Aptitude',
  social_intelligence:  'Social Intelligence',
  resilience:           'Resilience & Growth',
}

export const LEVEL_DESCRIPTIONS: Record<string, Record<string, string>> = {
  analytical_reasoning: {
    emerging:    'Early stages of mathematical and logical thinking. Building the foundations.',
    developing:  'Showing growth in structured problem-solving. Consistency will unlock more.',
    capable:     'Solid analytical foundation. Tackles most problem types effectively.',
    strong:      'Strong logical reasoning across multiple domains. A clear asset.',
    exceptional: 'Outstanding analytical ability. This is a genuine competitive advantage.',
  },
  communication: {
    emerging:    'Still developing confidence and clarity in expression.',
    developing:  'Communication is growing. Written and verbal expression improving.',
    capable:     'Communicates clearly in most contexts. Reliable in academic settings.',
    strong:      'Expresses ideas with clarity and precision. A career-defining strength.',
    exceptional: 'Exceptional communicator. Rare and highly valued across all careers.',
  },
  creative_thinking: {
    emerging:    'Creative confidence is still developing.',
    developing:  'Beginning to generate original ideas and approaches.',
    capable:     'Comfortable with creative problem-solving and original thinking.',
    strong:      'Strong creative thinker who generates novel solutions.',
    exceptional: 'Exceptional creativity. Divergent thinking at a high level.',
  },
  technical_aptitude: {
    emerging:    'Technical skills are early-stage. Exposure to hands-on subjects will help.',
    developing:  'Growing technical awareness. Building towards practical application.',
    capable:     'Can engage with technical tools and systems effectively.',
    strong:      'Strong technical capability. Comfortable with complex systems and tools.',
    exceptional: 'Exceptional technical aptitude. A significant advantage in STEM and tech careers.',
  },
  social_intelligence: {
    emerging:    'Interpersonal and social skills are still developing.',
    developing:  'Growing awareness of others. Social engagement is increasing.',
    capable:     'Works well with others and understands social contexts.',
    strong:      'Strong social intelligence. A people-person who builds trust naturally.',
    exceptional: 'Exceptional social and emotional intelligence. A rare leadership asset.',
  },
  resilience: {
    emerging:    'Very early. More assessment data will reveal a clearer picture.',
    developing:  'Showing some growth signals. Consistency will build a stronger trajectory.',
    capable:     'Maintaining progress under challenge. A solid growth pattern.',
    strong:      'Clear upward trajectory across subjects. This is a strong predictor of success.',
    exceptional: 'Exceptional growth trajectory. Improving significantly despite difficulty.',
  },
}

export const TREND_LABELS: Record<string, string> = {
  declining:    'Declining',
  stable:       'Stable',
  growing:      'Growing',
  accelerating: 'Accelerating',
}
