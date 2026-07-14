// lib/career/capabilityExtractor.ts
// Converts CBC subject scores into a 6-dimension capability profile.
// This is the core intelligence layer of the Career Operating System.
//
// Design principle: capabilities are more durable than grades.
// A learner who improves from 1.5→2.8 in Mathematics over 3 terms has
// stronger analytical capability signal than a learner static at 2.5.
// The trend IS the signal.

import { normalizeSubjectScores } from '@/lib/pathwayCalculator'
import { repos } from '@/lib/repositories'
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
  cre:                           0.08,
  christian_religious_education: 0.08,
  ire:                           0.08,
  islamic_religious_education:   0.08,
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
  let improvingCount = 0
  let decliningCount = 0
  let strongMomentumCount = 0
  const evidence: string[] = []

  for (const subject of allSubjects) {
    const subjectHistory = allHistory
      .map(s => s[subject])
      .filter((v): v is number => v !== undefined)

    if (subjectHistory.length < 2) continue

    const first = subjectHistory[0]
    const last  = subjectHistory[subjectHistory.length - 1]
    const delta = last - first

    if (delta >= 0.75) {
      strongMomentumCount++
      improvingCount++
      evidence.push(`${subject.replace(/_/g, ' ')}: ${first.toFixed(1)} → ${last.toFixed(1)} (+${delta.toFixed(1)})`)
    } else if (delta > 0.25) {
      improvingCount++
      evidence.push(`${subject.replace(/_/g, ' ')}: improving (+${delta.toFixed(1)})`)
    } else if (delta < -0.25) {
      decliningCount++
    }
  }

  const observed  = allSubjects.length
  const improveRate = observed > 0 ? improvingCount / observed : 0
  const declineRate = observed > 0 ? decliningCount / observed : 0
  const momentumBonus = strongMomentumCount > 0 ? 0.08 : 0

  // Base: 0.35 (developing), boosted by improvement rate, penalised by decline
  const raw = Math.max(0.05, Math.min(1, 0.35 + (improveRate * 0.45) - (declineRate * 0.20) + momentumBonus + (allHistory.length >= 4 ? 0.08 : 0)))

  // Trend: look at average overall score across assessment snapshots
  const avgPerAssessment = allHistory.map(s => {
    const vals = Object.values(s)
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }).map(normalizeCBC)

  const defaultEvidence = evidence.length > 0
    ? evidence
    : [`Improving in ${improvingCount} of ${observed} subjects assessed`]

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

// ── Canonical capability computation ───────────────────────────────────────────
// The single source of truth for "what is this student's capability profile
// right now" from the `assessments` table. Every consumer that needs a
// capability profile derived from assessment history — the Learner Model
// (lib/learnerModel/updater.ts), the Career Operating System's persisted
// profile (lib/career/careerEngine.ts), and the on-demand career/capability
// API routes — calls this instead of independently querying `assessments`
// and calling extractCapabilityProfile() themselves. This does not change
// where results are persisted (each caller keeps its own storage target),
// only how the input scoreHistory is built, so every persisted profile is
// computed the same way for the same student at the same point in time.
//
// Returns null (never a fabricated profile) when there is no assessment
// evidence yet — missing evidence is not negative evidence.
export async function computeCapabilityProfile(
  studentId:       string,
  currentSnapshot?: Record<string, number>,
): Promise<CapabilityProfile | null> {
  const history = await repos.learnerModel.findAssessmentHistory(studentId)
  const scoreHistory = history.map(r => r.subject_scores)

  // A just-submitted assessment may not yet be visible to this query (read
  // replica lag, or the caller has it in-hand before the write settles) —
  // append it if it isn't already the most recent entry.
  if (currentSnapshot && (
    scoreHistory.length === 0 ||
    JSON.stringify(scoreHistory[scoreHistory.length - 1]) !== JSON.stringify(currentSnapshot)
  )) {
    scoreHistory.push(currentSnapshot)
  }

  if (scoreHistory.length === 0) return null
  return extractCapabilityProfile(scoreHistory)
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
