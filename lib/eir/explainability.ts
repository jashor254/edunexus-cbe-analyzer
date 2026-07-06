// lib/eir/explainability.ts
// Pillar 8 — Educational Explainability
//
// Every recommendation produced by EILS must answer:
//   - Why was this recommended?
//   - What evidence supports it?
//   - How confident is the system?
//   - What alternatives were considered?
//   - What educational theory supports this?
//
// This module wraps EILS recommendations with full explanations and
// persists them so teachers, parents, and researchers can audit the AI.

import { createServiceClient } from '@/utils/supabase/service'
import { getOrCreateLearnerProfile } from '@/lib/learnerModel/queries'
import type {
  EIRRecommendationOutcome,
  ExplainedRecommendation,
  AlternativeAction,
  EducationalTheory,
} from './types'
import type { EILSRecommendation } from '@/_frozen/eils/types'

// ── Explain and Persist a Recommendation ─────────────────────────────────────

export async function explainRecommendation(
  recommendation: EILSRecommendation,
): Promise<ExplainedRecommendation> {
  const db      = createServiceClient()
  const profile = await getOrCreateLearnerProfile(recommendation.student_id)
  const now     = new Date().toISOString()

  // Derive educational theory based on action type and evidence
  const theory     = deriveEducationalTheory(recommendation, profile)
  const explanation = buildExplanation(recommendation, profile)
  const evidence    = buildEvidenceSummary(recommendation, profile)
  const alternatives = buildAlternativeActions(recommendation)
  const confidenceLabel = labelConfidence(recommendation.confidence)

  const row: Omit<EIRRecommendationOutcome, 'id'> = {
    recommendation_id:   recommendation.id,
    student_id:          recommendation.student_id,
    recommendation_type: recommendation.action_type,
    subject:             recommendation.subject ?? null,
    substrand:           recommendation.substrand ?? null,
    explanation,
    evidence_summary:    evidence,
    alternative_actions: alternatives,
    educational_theory:  theory,
    confidence:          recommendation.confidence,
    status:              'pending',
    actioned_at:         null,
    outcome:             null,
    outcome_recorded_at: null,
    pre_mastery_level:   null,
    post_mastery_level:  null,
    improvement_delta:   null,
    teacher_feedback:    null,
    learner_feedback:    null,
    parent_feedback:     null,
    feedback_recorded_at: null,
    created_at:          now,
    updated_at:          now,
  }

  await db.from('eir_recommendation_outcomes').insert(row)

  return {
    recommendation_id:   recommendation.id,
    action_type:         recommendation.action_type,
    subject:             recommendation.subject,
    substrand:           recommendation.substrand,
    explanation,
    evidence_summary:    evidence,
    educational_theory:  theory,
    theory_rationale:    theoryRationale(theory),
    confidence:          recommendation.confidence,
    confidence_label:    confidenceLabel,
    alternative_actions: alternatives,
    what_we_measured:    whatWeMeasured(recommendation),
    what_we_concluded:   recommendation.reasoning,
    what_will_improve:   recommendation.expected_impact,
  }
}

// ── Get Explanation for a Recommendation ─────────────────────────────────────

export async function getExplanation(
  recommendationId: string,
): Promise<EIRRecommendationOutcome | null> {
  const db = createServiceClient()

  const { data } = await db
    .from('eir_recommendation_outcomes')
    .select(
      'id, recommendation_id, student_id, recommendation_type, subject, substrand, ' +
      'explanation, evidence_summary, alternative_actions, educational_theory, confidence, ' +
      'status, actioned_at, outcome, outcome_recorded_at, pre_mastery_level, post_mastery_level, ' +
      'improvement_delta, teacher_feedback, learner_feedback, parent_feedback, ' +
      'feedback_recorded_at, created_at, updated_at'
    )
    .eq('recommendation_id', recommendationId)
    .single()

  return data as unknown as EIRRecommendationOutcome | null
}

// ── Record Feedback ───────────────────────────────────────────────────────────

export async function recordFeedback(params: {
  recommendationId: string
  role:             'teacher' | 'learner' | 'parent'
  feedback:         string
}): Promise<void> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  const updateField = params.role === 'teacher' ? 'teacher_feedback' :
    params.role === 'parent' ? 'parent_feedback' : 'learner_feedback'

  await db
    .from('eir_recommendation_outcomes')
    .update({
      [updateField]:         params.feedback,
      feedback_recorded_at:  now,
      updated_at:            now,
    })
    .eq('recommendation_id', params.recommendationId)
}

// ── Explanation Builders ──────────────────────────────────────────────────────

type LearnerProfile = Awaited<ReturnType<typeof getOrCreateLearnerProfile>>

function buildExplanation(rec: EILSRecommendation, profile: LearnerProfile): string {
  const parts: string[] = []

  parts.push(rec.reasoning)

  if (rec.evidence.weak_substrands?.length) {
    parts.push(`The learner has struggled with: ${rec.evidence.weak_substrands.slice(0, 3).join(', ')}.`)
  }

  if (rec.evidence.risk_flags?.length) {
    const types = rec.evidence.risk_flags.map(f => f.type.replace(/_/g, ' ')).join(', ')
    parts.push(`Active risk signals: ${types}.`)
  }

  if (rec.evidence.kg_root_causes?.length) {
    parts.push(`Knowledge graph identifies root cause: ${rec.evidence.kg_root_causes[0]}.`)
  }

  if (rec.evidence.consecutive_weeks && rec.evidence.consecutive_weeks >= 2) {
    parts.push(`This pattern has persisted for ${rec.evidence.consecutive_weeks} weeks.`)
  }

  const riskLevel = profile.overall_risk_level
  if (riskLevel === 'critical' || riskLevel === 'at_risk') {
    parts.push(`Overall risk level is "${riskLevel}", making timely intervention important.`)
  }

  return parts.join(' ')
}

function buildEvidenceSummary(
  rec:     EILSRecommendation,
  profile: LearnerProfile,
): Record<string, unknown> {
  return {
    risk_level:          profile.overall_risk_level,
    risk_flags:          profile.risk_flags.map(f => ({ type: f.type, severity: f.severity })),
    confirmed_gaps:      profile.confirmed_gaps.slice(0, 5),
    persistent_gaps:     profile.persistent_gaps.slice(0, 3),
    weak_substrands:     rec.evidence.weak_substrands ?? [],
    kg_root_causes:      rec.evidence.kg_root_causes ?? [],
    career_signals:      rec.evidence.career_signals ?? [],
    consecutive_weeks:   rec.evidence.consecutive_weeks ?? 0,
    source_system:       rec.source_system,
    priority:            rec.priority,
    confidence:          rec.confidence,
  }
}

function buildAlternativeActions(rec: EILSRecommendation): AlternativeAction[] {
  const alternativeMap: Record<string, AlternativeAction[]> = {
    remediation: [
      { action: 'practice_questions', rationale: 'Compass session — less intensive', why_not: 'Remediation targets root cause more precisely' },
      { action: 'notify_teacher',     rationale: 'Teacher-led intervention',        why_not: 'AI remediation scales better; teacher reserved for unresolved cases' },
    ],
    practice_questions: [
      { action: 'review_topic',       rationale: 'Full topic review first',          why_not: 'Practice questions generate diagnostic evidence more efficiently' },
      { action: 'confidence_activity', rationale: 'Start with easier wins',          why_not: 'Practice questions assess current level before adjusting difficulty' },
    ],
    notify_teacher: [
      { action: 'remediation',        rationale: 'Try AI remediation first',        why_not: 'Risk level or persistence suggests human judgment is needed' },
      { action: 'practice_questions', rationale: 'Self-directed learning',          why_not: 'Automated systems have not resolved this after multiple attempts' },
    ],
    notify_parent: [
      { action: 'notify_teacher',     rationale: 'Teacher intervention first',      why_not: 'Parent involvement targets home-side factors teacher cannot address' },
    ],
    confidence_activity: [
      { action: 'practice_questions', rationale: 'Jump straight to practice',       why_not: 'Low confidence makes jumping in counter-productive — win first' },
      { action: 'remediation',        rationale: 'Address specific gap',            why_not: 'Confidence must be restored before gap-filling is effective' },
    ],
    career_exploration: [
      { action: 'practice_questions', rationale: 'Focus on academics directly',     why_not: 'Career relevance reframes motivation more effectively for disengaged learners' },
    ],
    acceleration: [
      { action: 'review_topic',       rationale: 'Consolidate current level first', why_not: 'Strong mastery signals readiness for above-grade-level challenge' },
    ],
  }

  return alternativeMap[rec.action_type] ?? []
}

// ── Educational Theory Inference ──────────────────────────────────────────────

function deriveEducationalTheory(
  rec:     EILSRecommendation,
  profile: LearnerProfile,
): EducationalTheory | null {
  const actionMap: Record<string, EducationalTheory> = {
    remediation:          'scaffolding',
    practice_questions:   'retrieval_practice',
    review_topic:         'spaced_repetition',
    confidence_activity:  'growth_mindset',
    peer_discussion:      'constructivism',
    hands_on_activity:    'constructivism',
    generate_lesson:      'zone_of_proximal_development',
    acceleration:         'zone_of_proximal_development',
    watch_explanation:    'cognitive_load_theory',
  }

  if (rec.evidence.kg_root_causes?.length && rec.action_type === 'remediation') {
    return 'scaffolding'
  }

  return actionMap[rec.action_type] ?? null
}

function theoryRationale(theory: EducationalTheory | null): string | null {
  if (!theory) return null
  const map: Record<EducationalTheory, string> = {
    spaced_repetition:            'Distributing practice over time reduces forgetting and strengthens long-term retention.',
    scaffolding:                  'Breaking complex skills into supported steps allows learners to access concepts they could not reach alone.',
    constructivism:               'Learners build understanding more deeply by actively constructing knowledge through experience and peer discussion.',
    zone_of_proximal_development: 'Tasks pitched just above current ability — with appropriate support — produce the greatest learning gains.',
    retrieval_practice:           'Attempting to recall information strengthens memory traces more than re-reading or passive review.',
    interleaving:                 'Mixing different types of problems during practice improves long-term transfer of skills.',
    elaborative_interrogation:    'Asking why questions forces deeper processing and strengthens conceptual connections.',
    growth_mindset:               'Belief that ability can grow through effort increases resilience and reduces fear of failure.',
    mastery_learning:             'Ensuring full mastery at each level before progressing eliminates knowledge gaps that compound over time.',
    cognitive_load_theory:        'Reducing extraneous cognitive load allows working memory to focus on meaningful learning.',
  }
  return map[theory] ?? null
}

function whatWeMeasured(rec: EILSRecommendation): string {
  const pieces: string[] = ['We measured:']
  if (rec.evidence.weak_substrands?.length)   pieces.push(`mastery levels in ${rec.evidence.weak_substrands.length} substrands`)
  if (rec.evidence.risk_flags?.length)        pieces.push(`${rec.evidence.risk_flags.length} active risk flags`)
  if (rec.evidence.kg_root_causes?.length)    pieces.push(`knowledge graph root cause depth`)
  if (rec.evidence.behaviour_signals?.length) pieces.push(`learning behaviour signals`)
  if (rec.evidence.career_signals?.length)    pieces.push(`career interest alignment`)
  if (rec.evidence.consecutive_weeks)         pieces.push(`${rec.evidence.consecutive_weeks}-week persistence data`)
  return pieces.join(', ').replace(':,', ':')
}

function labelConfidence(confidence: number): 'very_high' | 'high' | 'moderate' | 'low' {
  if (confidence >= 0.85) return 'very_high'
  if (confidence >= 0.7)  return 'high'
  if (confidence >= 0.5)  return 'moderate'
  return 'low'
}
