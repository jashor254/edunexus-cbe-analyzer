// lib/eir/personalization.ts
// Pillar 4 — Personalization Models
//
// Derives optimal learning parameters for each learner from historical
// engagement patterns, session data, and assessment outcomes.
//
// Discovers:
//   - Optimal challenge level (not too easy, not too hard)
//   - Optimal session length (diminishing returns threshold)
//   - Optimal revision interval (spaced repetition calibration)
//   - Preferred explanation style (what modality works for this learner)
//   - Engagement pattern (when and how this learner learns best)

import { createServiceClient } from '@/utils/supabase/service'
import { getOrCreateLearnerProfile } from '@/lib/learnerModel/queries'
import type {
  EIRPersonalizationModel,
  ExplanationStyle,
  EngagementPattern,
  ChallengeResponse,
  FeedbackResponse,
} from './types'

// ── Build Personalization Model for a Learner ─────────────────────────────────

export async function buildPersonalizationModel(
  studentId: string,
): Promise<EIRPersonalizationModel> {
  const db      = createServiceClient()
  const profile = await getOrCreateLearnerProfile(studentId)
  const now     = new Date().toISOString()

  // Fetch Compass session history for engagement analysis
  const { data: compassSessions } = await db
    .from('compass_sessions')
    .select('duration_mins, consecutive_right, consecutive_wrong, abandoned, completed_at, topic, subject')
    .eq('student_id', studentId)
    .order('completed_at', { ascending: false })
    .limit(50)

  const sessions = (compassSessions ?? []) as CompassSessionRow[]

  // ── Derive parameters ────────────────────────────────────────────────────────

  const optimalSessionMins       = deriveOptimalSessionLength(sessions)
  const optimalChallengeLevel    = deriveOptimalChallengeLevel(profile, sessions)
  const optimalRevisionInterval  = deriveRevisionInterval(profile)
  const optimalAssessmentFreq    = deriveAssessmentFrequency(profile)
  const preferredStyle           = deriveExplanationStyle(profile, sessions)
  const engagementPattern        = deriveEngagementPattern(sessions)
  const challengeResponse        = deriveChallengeResponse(profile, sessions)
  const feedbackResponse         = deriveFeedbackResponse(profile)

  // Evidence count = number of compass sessions + assessments
  const assessmentCount = Object.values(profile.knowledge_state)
    .reduce((s, m) => s + m.assessment_count, 0)
  const evidenceCount = sessions.length + assessmentCount

  // Model confidence grows with evidence
  const modelConfidence = Math.min(0.95, evidenceCount / 50)

  const row: Omit<EIRPersonalizationModel, 'id'> = {
    student_id:                          studentId,
    optimal_challenge_level:             optimalChallengeLevel,
    optimal_session_mins:                optimalSessionMins,
    optimal_revision_interval_days:      optimalRevisionInterval,
    optimal_assessment_frequency_weeks:  optimalAssessmentFreq,
    preferred_explanation_style:         preferredStyle,
    optimal_time_preference:             deriveTimePreference(sessions),
    engagement_pattern:                  engagementPattern,
    response_to_challenge:               challengeResponse,
    response_to_feedback:                feedbackResponse,
    evidence_count:                      evidenceCount,
    model_confidence:                    modelConfidence,
    last_updated_at:                     now,
    created_at:                          now,
    updated_at:                          now,
  }

  // Upsert
  const { data: upserted } = await db
    .from('eir_personalization_models')
    .upsert({
      ...row,
      updated_at: now,
    }, { onConflict: 'student_id' })
    .select()
    .single()

  return (upserted ?? { id: '', ...row }) as EIRPersonalizationModel
}

// ── Get Persisted Model ────────────────────────────────────────────────────────

export async function getPersonalizationModel(
  studentId: string,
): Promise<EIRPersonalizationModel | null> {
  const db = createServiceClient()

  const { data } = await db
    .from('eir_personalization_models')
    .select(
      'id, student_id, optimal_challenge_level, optimal_session_mins, ' +
      'optimal_revision_interval_days, optimal_assessment_frequency_weeks, ' +
      'preferred_explanation_style, optimal_time_preference, engagement_pattern, ' +
      'response_to_challenge, response_to_feedback, evidence_count, model_confidence, ' +
      'last_updated_at, created_at, updated_at'
    )
    .eq('student_id', studentId)
    .single()

  return data as unknown as EIRPersonalizationModel | null
}

// ── Inject Personalization Into AI Context ────────────────────────────────────
// Returns a plain-English context string for AI system prompt injection.

export async function getPersonalizationContext(
  studentId: string,
): Promise<string> {
  const model = await getPersonalizationModel(studentId)
  if (!model || model.model_confidence === null || model.model_confidence < 0.2) {
    return ''
  }

  const parts: string[] = []

  if (model.preferred_explanation_style) {
    const styleMap: Record<ExplanationStyle, string> = {
      structured:     'This learner prefers structured, step-by-step explanations.',
      example_first:  'This learner learns best when given a concrete example first, then the rule.',
      question_first: 'This learner responds well to discovery learning — start with a question, not the answer.',
      visual:         'This learner benefits from visual representations, diagrams, or spatial analogies.',
      analogy_based:  'This learner understands abstract concepts best through real-world analogies.',
    }
    parts.push(styleMap[model.preferred_explanation_style])
  }

  if (model.optimal_challenge_level !== null) {
    if (model.optimal_challenge_level < 2) parts.push('Keep tasks at foundational level — this learner withdraws from difficulty.')
    else if (model.optimal_challenge_level >= 3.5) parts.push('This learner thrives on challenge — aim above current mastery level.')
    else parts.push('Aim for moderate challenge — slightly above current comfort zone.')
  }

  if (model.response_to_challenge === 'withdraws') {
    parts.push('Start with a topic where the learner has previously succeeded to build confidence first.')
  }

  if (model.optimal_session_mins !== null && model.optimal_session_mins < 20) {
    parts.push(`Keep sessions under ${model.optimal_session_mins} minutes — this learner loses focus beyond that.`)
  }

  return parts.join(' ')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type CompassSessionRow = {
  duration_mins:     number | null
  consecutive_right: number | null
  consecutive_wrong: number | null
  abandoned:         boolean | null
  completed_at:      string | null
  topic:             string | null
  subject:           string | null
}

function deriveOptimalSessionLength(sessions: CompassSessionRow[]): number | null {
  if (sessions.length < 3) return null

  // Find the duration beyond which abandonment rate spikes
  const completedDurations = sessions
    .filter(s => !s.abandoned && s.duration_mins)
    .map(s => s.duration_mins as number)
    .sort((a, b) => a - b)

  if (!completedDurations.length) return null
  const median = completedDurations[Math.floor(completedDurations.length / 2)]
  return Math.round(median * 1.2)   // allow 20% above median before diminishing returns
}

function deriveOptimalChallengeLevel(
  profile:  Awaited<ReturnType<typeof getOrCreateLearnerProfile>>,
  sessions: CompassSessionRow[],
): number | null {
  const avgMastery = Object.values(profile.knowledge_state)
  if (!avgMastery.length) return null

  const mean = avgMastery.reduce((s, m) => s + m.level, 0) / avgMastery.length

  // High consecutive_right → can handle higher challenge
  const avgConsecRight = sessions.length
    ? sessions.reduce((s, r) => s + (r.consecutive_right ?? 0), 0) / sessions.length
    : 0

  if (avgConsecRight >= 4) return Math.min(4, mean + 0.5)   // push harder
  if (avgConsecRight <= 1) return Math.max(1, mean - 0.5)   // back off
  return mean
}

function deriveRevisionInterval(
  profile: Awaited<ReturnType<typeof getOrCreateLearnerProfile>>,
): number | null {
  // Based on confirmed gaps — more gaps = shorter revision interval needed
  const gapCount = profile.confirmed_gaps.length
  if (gapCount === 0) return 14    // 2 weeks for healthy learners
  if (gapCount <= 2)  return 7     // weekly revision
  if (gapCount <= 5)  return 3     // every 3 days
  return 2                          // near-daily for high-gap learners
}

function deriveAssessmentFrequency(
  profile: Awaited<ReturnType<typeof getOrCreateLearnerProfile>>,
): number | null {
  // at_risk and critical learners need more frequent assessment
  const riskLevel = profile.overall_risk_level
  if (riskLevel === 'critical') return 1
  if (riskLevel === 'at_risk')  return 2
  if (riskLevel === 'watch')    return 3
  return 4   // monthly for healthy learners
}

function deriveExplanationStyle(
  profile:  Awaited<ReturnType<typeof getOrCreateLearnerProfile>>,
  sessions: CompassSessionRow[],
): ExplanationStyle | null {
  if (sessions.length < 5) return null

  // Consecutive wrong spikes → learner needs more scaffolding (example_first)
  const avgWrong = sessions.reduce((s, r) => s + (r.consecutive_wrong ?? 0), 0) / sessions.length
  if (avgWrong >= 3) return 'example_first'

  // High persistence in behaviour → question_first works well
  const behaviour = profile.learning_behaviour
  const persistence = (behaviour.persistence as { score?: number } | undefined)?.score ?? 0.5
  if (persistence >= 0.7) return 'question_first'

  // Low help_seeking → structured works best (reduces anxiety)
  const helpSeeking = (behaviour.help_seeking as { score?: number } | undefined)?.score ?? 0.5
  if (helpSeeking < 0.3) return 'structured'

  return 'structured'
}

function deriveEngagementPattern(sessions: CompassSessionRow[]): EngagementPattern | null {
  if (sessions.length < 5) return null

  const completedDates = sessions
    .filter(s => s.completed_at)
    .map(s => new Date(s.completed_at as string))
    .sort((a, b) => a.getTime() - b.getTime())

  if (completedDates.length < 3) return 'irregular'

  // Check weekend concentration
  const weekendCount = completedDates.filter(d => d.getDay() === 0 || d.getDay() === 6).length
  if (weekendCount / completedDates.length >= 0.6) return 'weekend_heavy'

  // Check interval consistency
  const gaps: number[] = []
  for (let i = 1; i < completedDates.length; i++) {
    gaps.push((completedDates[i].getTime() - completedDates[i - 1].getTime()) / 86400000)
  }
  const meanGap = gaps.reduce((s, n) => s + n, 0) / gaps.length
  const maxGap  = Math.max(...gaps)

  if (maxGap > 30) return 'bursty'
  if (meanGap <= 3) return 'consistent'
  return 'irregular'
}

function deriveChallengeResponse(
  profile:  Awaited<ReturnType<typeof getOrCreateLearnerProfile>>,
  sessions: CompassSessionRow[],
): ChallengeResponse | null {
  if (sessions.length < 5) return null

  const abandonRate = sessions.filter(s => s.abandoned).length / sessions.length
  const avgConsecWrong = sessions.reduce((s, r) => s + (r.consecutive_wrong ?? 0), 0) / sessions.length

  const behaviour   = profile.learning_behaviour
  const persistence = (behaviour.persistence as { score?: number } | undefined)?.score ?? 0.5

  if (abandonRate > 0.4 && avgConsecWrong > 3) return 'withdraws'
  if (persistence >= 0.7 && abandonRate < 0.15) return 'thrives'
  if (persistence >= 0.5) return 'persists'
  return 'needs_scaffolding'
}

function deriveFeedbackResponse(
  profile: Awaited<ReturnType<typeof getOrCreateLearnerProfile>>,
): FeedbackResponse | null {
  // If confirmed gaps remain despite recommendations → delayed or ignores
  const gaps         = profile.confirmed_gaps.length
  const riskPersists = profile.risk_history.filter(r => !r.resolved_at && (r.consecutive_weeks ?? 0) >= 3).length

  if (riskPersists > 1 && gaps > 3) return 'ignores'
  if (riskPersists === 1)            return 'delayed_response'
  return 'acts_immediately'
}

function deriveTimePreference(sessions: CompassSessionRow[]): string | null {
  if (sessions.length < 5) return null

  const hours = sessions
    .filter(s => s.completed_at)
    .map(s => new Date(s.completed_at as string).getHours())

  const morning   = hours.filter(h => h >= 6  && h < 12).length
  const afternoon = hours.filter(h => h >= 12 && h < 17).length
  const evening   = hours.filter(h => h >= 17 && h < 22).length
  const weekend   = sessions
    .filter(s => s.completed_at)
    .filter(s => [0, 6].includes(new Date(s.completed_at as string).getDay())).length

  const max = Math.max(morning, afternoon, evening)
  if (max < sessions.length * 0.3) return 'no_preference'

  if (weekend / sessions.length > 0.5) return 'weekend'
  if (morning   === max) return 'morning'
  if (afternoon === max) return 'afternoon'
  return 'evening'
}
