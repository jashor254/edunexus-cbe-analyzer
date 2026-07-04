// lib/eir/types.ts
// Education Intelligence Research — canonical type definitions.
//
// EIR is the scientific layer above EILS.  It consumes EILS intelligence,
// discovers patterns, validates hypotheses, and feeds evidence back to improve
// every recommendation EILS produces.
//
// One type namespace per pillar, plus shared utility types.

// ── Shared ────────────────────────────────────────────────────────────────────

export type EvidenceStrength = 'weak' | 'moderate' | 'strong' | 'very_strong'
export type ResearchStatus   = 'proposed' | 'testing' | 'validated' | 'rejected'
export type ResearchPillar   =
  | 'misconception'
  | 'trajectory'
  | 'intervention'
  | 'personalization'
  | 'career'
  | 'kg_evolution'
  | 'risk'
  | 'explainability'
  | 'validation'
  | 'general'

// ── Pillar 1 — Misconception Discovery ───────────────────────────────────────

export type MisconceptionType =
  | 'procedural_error'
  | 'conceptual_confusion'
  | 'prerequisite_gap'
  | 'overgeneralisation'
  | 'incomplete_schema'
  | 'notation_error'

export type CorrectionEffectiveness = 'effective' | 'partial' | 'ineffective' | 'untried'

export type EIRMisconception = {
  id:                       string
  student_id:               string
  school_id:                string | null
  grade:                    number
  subject:                  string
  substrand:                string
  misconception_type:       MisconceptionType
  description:              string
  frequency_count:          number
  first_seen_at:            string
  last_seen_at:             string
  resolved_at:              string | null
  root_cause:               string | null
  correction_strategy:      string | null
  correction_effectiveness: CorrectionEffectiveness | null
  evidence:                 Record<string, unknown>
  created_at:               string
  updated_at:               string
}

export type MisconceptionPattern = {
  subject:               string
  substrand:             string
  misconception_type:    MisconceptionType
  description:           string
  student_count:         number    // how many students show this
  frequency:             number    // total occurrences
  resolution_rate:       number    // 0–1
  avg_days_to_resolve:   number | null
  most_effective_correction: string | null
}

export type MisconceptionLibrary = {
  total_patterns:       number
  by_subject:           Record<string, MisconceptionPattern[]>
  most_persistent:      MisconceptionPattern[]
  highest_frequency:    MisconceptionPattern[]
  hardest_to_correct:   MisconceptionPattern[]
  recently_resolved:    MisconceptionPattern[]
  generated_at:         string
}

// ── Pillar 2 — Learning Trajectories ─────────────────────────────────────────

export type TrajectoryClass =
  | 'accelerating'
  | 'improving'
  | 'stable'
  | 'plateau'
  | 'declining'
  | 'recovering'
  | 'insufficient_data'

export type EIRLearningTrajectory = {
  id:                               string
  student_id:                       string
  subject:                          string
  substrand:                        string
  mastery_velocity:                 number | null    // mastery level per week
  plateau_detected_at:              string | null
  plateau_weeks:                    number | null
  breakthrough_at:                  string | null
  forgetting_curve_rate:            number | null    // 0–1
  days_since_last_assessment:       number | null
  days_to_recover_after_intervention: number | null
  retention_score:                  number | null    // 0–1
  current_mastery_level:            number | null    // 1.0–4.0
  peak_mastery_level:               number | null
  assessment_count:                 number
  compass_session_count:            number
  trajectory_class:                 TrajectoryClass
  snapshot_at:                      string
  created_at:                       string
  updated_at:                       string
}

export type TrajectoryModel = {
  student_id:           string
  trajectories:         EIRLearningTrajectory[]
  overall_class:        TrajectoryClass
  avg_velocity:         number
  subjects_accelerating: string[]
  subjects_plateauing:  string[]
  subjects_declining:   string[]
  learning_rhythm:      'consistent' | 'irregular' | 'burst_and_rest'
  predicted_mastery_in_4_weeks: Record<string, number>  // substrand → expected level
  generated_at:         string
}

// ── Pillar 3 — Intervention Effectiveness ────────────────────────────────────

export type EIRInterventionType =
  | 'teacher_explanation'
  | 'ai_explanation'
  | 'worked_example'
  | 'practice_questions'
  | 'video_lesson'
  | 'peer_discussion'
  | 'revision'
  | 'hands_on_activity'
  | 'remedial_plan'
  | 'compass_assignment'
  | 'parent_home_activity'
  | 'peer_pairing'

export type EIRInterventionRecord = {
  id:                   string
  student_id:           string
  teacher_id:           string | null
  school_id:            string | null
  grade:                number
  subject:              string
  substrand:            string | null
  intervention_type:    EIRInterventionType
  learner_risk_level:   string
  learner_profile_type: string | null
  pre_mastery_level:    number | null
  post_mastery_level:   number | null
  mastery_delta:        number | null
  started_at:           string
  completed_at:         string | null
  days_to_resolution:   number | null
  // null = intervention still pending assessment (outcome not yet recorded)
  outcome:              'effective' | 'partial' | 'ineffective' | 'unknown' | null
  // Generated column: outcome IN ('effective','partial'). Postgres three-valued
  // logic means this is NULL (not false) when outcome is NULL — a pending
  // intervention is neither effective nor ineffective yet.
  was_effective:        boolean | null
  evidence:             Record<string, unknown>
  created_at:           string
  updated_at:           string
}

export type InterventionEffectivenessReport = {
  by_type:              InterventionTypeStats[]
  best_for_risk_level:  Record<string, EIRInterventionType>  // risk → best intervention
  best_for_subject:     Record<string, EIRInterventionType>  // subject → best intervention
  fastest_resolution:   { type: EIRInterventionType; avg_days: number }
  highest_mastery_gain: { type: EIRInterventionType; avg_delta: number }
  generated_at:         string
}

export type InterventionTypeStats = {
  intervention_type:   EIRInterventionType
  total_records:       number
  // Interventions with outcome still NULL — not yet assessed. Excluded from
  // effectiveness_rate and best/worst_for_profile; reported here so callers
  // can see how much of total_records is actually decided vs. still pending.
  pending_records:     number
  effectiveness_rate:  number    // 0–1, over ASSESSED records only (excludes pending_records)
  avg_mastery_delta:   number
  avg_days_to_resolve: number
  best_for_profile:    string[]  // learner profile types where it works best
  worst_for_profile:   string[]
}

// ── Pillar 4 — Personalization Models ────────────────────────────────────────

export type ExplanationStyle  = 'structured' | 'example_first' | 'question_first' | 'visual' | 'analogy_based'
export type EngagementPattern = 'consistent' | 'bursty' | 'weekend_heavy' | 'irregular' | 'teacher_dependent'
export type ChallengeResponse = 'thrives' | 'persists' | 'withdraws' | 'needs_scaffolding'
export type FeedbackResponse  = 'acts_immediately' | 'delayed_response' | 'ignores'

export type EIRPersonalizationModel = {
  id:                              string
  student_id:                      string
  optimal_challenge_level:         number | null    // 1–4
  optimal_session_mins:            number | null
  optimal_revision_interval_days:  number | null
  optimal_assessment_frequency_weeks: number | null
  preferred_explanation_style:     ExplanationStyle | null
  optimal_time_preference:         string | null
  engagement_pattern:              EngagementPattern | null
  response_to_challenge:           ChallengeResponse | null
  response_to_feedback:            FeedbackResponse | null
  evidence_count:                  number
  model_confidence:                number | null    // 0–1
  last_updated_at:                 string
  created_at:                      string
  updated_at:                      string
}

// ── Pillar 5 — Career Development ────────────────────────────────────────────

export type EIRCareerDevelopmentSnapshot = {
  id:                    string
  student_id:            string
  snapshot_at:           string
  top_career_slug:       string | null
  previous_career_slug:  string | null
  career_readiness_score: number | null
  interest_stability:    number | null    // 0–1
  competency_growth_rate: number | null
  pathway:               string | null
  confidence_score:      number | null
  career_confidence:     number | null
  career_changed:        boolean
  pathway_changed:       boolean
  readiness_trend:       'improving' | 'stable' | 'declining' | null
  evidence:              Record<string, unknown>
  created_at:            string
  updated_at:            string
}

export type CareerDevelopmentModel = {
  student_id:           string
  current_snapshot:     EIRCareerDevelopmentSnapshot
  snapshots:            EIRCareerDevelopmentSnapshot[]
  career_stability:     number      // 0–1: how consistent career interest is over time
  readiness_trajectory: 'accelerating' | 'improving' | 'stable' | 'declining'
  pivot_count:          number      // how many times top career has changed
  competency_gap:       Record<string, number>  // career → gap to readiness threshold
  generated_at:         string
}

// ── Pillar 6 — Knowledge Graph Evolution ─────────────────────────────────────

export type KGDiscoveryType =
  | 'missing_prerequisite_link'
  | 'alternative_learning_path'
  | 'difficulty_calibration'
  | 'learning_bottleneck'
  | 'concept_cluster'
  | 'common_confusion_pair'

export type EIRKGDiscovery = {
  id:                      string
  discovery_type:          KGDiscoveryType
  subject:                 string
  substrand:               string
  related_substrand:       string | null
  description:             string
  evidence_count:          number
  supporting_student_count: number
  confidence:              number | null
  status:                  'hypothesis' | 'validating' | 'validated' | 'rejected'
  validated_at:            string | null
  rejected_at:             string | null
  rejection_reason:        string | null
  proposed_change:         string | null
  applied_at:              string | null
  evidence:                Record<string, unknown>
  created_at:              string
  updated_at:              string
}

// ── Pillar 7 — Early Risk Detection ──────────────────────────────────────────

export type EIRRiskType =
  | 'disengagement'
  | 'burnout'
  | 'learning_regression'
  | 'exam_failure'
  | 'dropout_risk'
  | 'confidence_collapse'

export type EIRRiskPrediction = {
  id:                      string
  student_id:              string
  predicted_at:            string
  prediction_horizon_days: number
  risk_type:               EIRRiskType
  predicted_risk_level:    'low' | 'medium' | 'high' | 'critical'
  actual_risk_level:       'low' | 'medium' | 'high' | 'critical' | null
  prediction_features:     Record<string, unknown>
  confidence:              number | null
  evaluate_at:             string
  evaluated_at:            string | null
  was_accurate:            boolean | null
  model_version:           string
  created_at:              string
  updated_at:              string
}

export type RiskPredictionResult = {
  student_id:    string
  predictions:   EIRRiskPrediction[]
  top_risk:      EIRRiskType | null
  top_risk_level: 'low' | 'medium' | 'high' | 'critical' | null
  alert:         boolean   // true = action needed in next 14 days
  alert_reason:  string | null
  generated_at:  string
}

// ── Pillar 8 — Educational Explainability ────────────────────────────────────

export type EducationalTheory =
  | 'spaced_repetition'
  | 'scaffolding'
  | 'constructivism'
  | 'zone_of_proximal_development'
  | 'retrieval_practice'
  | 'interleaving'
  | 'elaborative_interrogation'
  | 'growth_mindset'
  | 'mastery_learning'
  | 'cognitive_load_theory'

export type EIRRecommendationOutcome = {
  id:                   string
  recommendation_id:    string
  student_id:           string
  recommendation_type:  string
  subject:              string | null
  substrand:            string | null
  explanation:          string
  evidence_summary:     Record<string, unknown>
  alternative_actions:  AlternativeAction[]
  educational_theory:   EducationalTheory | null
  confidence:           number | null
  status:               'pending' | 'accepted' | 'dismissed' | 'expired'
  actioned_at:          string | null
  outcome:              'improved' | 'same' | 'declined' | 'unknown' | null
  outcome_recorded_at:  string | null
  pre_mastery_level:    number | null
  post_mastery_level:   number | null
  improvement_delta:    number | null
  teacher_feedback:     string | null
  learner_feedback:     string | null
  parent_feedback:      string | null
  feedback_recorded_at: string | null
  created_at:           string
  updated_at:           string
}

export type AlternativeAction = {
  action:    string
  rationale: string
  why_not:   string   // why this was ranked lower
}

export type ExplainedRecommendation = {
  recommendation_id:   string
  action_type:         string
  subject?:            string
  substrand?:          string
  explanation:         string
  evidence_summary:    Record<string, unknown>
  educational_theory:  EducationalTheory | null
  theory_rationale:    string | null
  confidence:          number
  confidence_label:    'very_high' | 'high' | 'moderate' | 'low'
  alternative_actions: AlternativeAction[]
  what_we_measured:    string
  what_we_concluded:   string
  what_will_improve:   string
}

// ── Pillar 9 — Continuous Validation ─────────────────────────────────────────

export type ValidationSignal = {
  recommendation_id:  string
  student_id:         string
  signal_type:        'assessment_result' | 'compass_session' | 'teacher_feedback' | 'parent_feedback'
  signal_data:        Record<string, unknown>
  recorded_at:        string
}

export type ValidationSummary = {
  total_recommendations:  number
  accepted_count:         number
  dismissed_count:        number
  expired_count:          number
  acceptance_rate:        number    // 0–1
  effectiveness_rate:     number    // 0–1 (of accepted, how many improved outcomes)
  by_action_type:         Record<string, { count: number; effectiveness: number }>
  avg_improvement_delta:  number    // average mastery level change for accepted recs
  teacher_satisfaction:   number | null  // 0–1
  generated_at:           string
}

// ── Pillar 10 — Educational Knowledge Base ────────────────────────────────────

export type EIRHypothesis = {
  id:                  string
  pillar:              ResearchPillar
  title:               string
  description:         string
  status:              ResearchStatus
  evidence_count:      number
  proposed_by:         'system' | 'teacher' | 'admin' | 'researcher'
  proposed_at:         string
  testing_since:       string | null
  validated_at:        string | null
  rejected_at:         string | null
  rejection_reason:    string | null
  supporting_evidence: Record<string, unknown>[]
  counter_evidence:    Record<string, unknown>[]
  tags:                string[]
  created_at:          string
  updated_at:          string
}

export type EIRFinding = {
  id:                   string
  hypothesis_id:        string | null
  pillar:               ResearchPillar
  title:                string
  summary:              string
  detail:               string | null
  confidence:           number | null
  evidence_strength:    EvidenceStrength
  sample_size:          number | null
  applies_to_subjects:  string[]
  applies_to_grades:    number[]
  applies_to_curricula: string[]
  finding_data:         Record<string, unknown>
  action_recommendation: string | null
  published_at:         string
  last_verified_at:     string
  created_at:           string
  updated_at:           string
}

export type KnowledgeBaseReport = {
  total_hypotheses: number
  total_findings:   number
  by_pillar:        Record<ResearchPillar, { hypotheses: number; findings: number }>
  recent_findings:  EIRFinding[]
  top_findings:     EIRFinding[]    // highest confidence + strongest evidence
  open_hypotheses:  EIRHypothesis[]
  generated_at:     string
}

// ── EIR Research Cycle ────────────────────────────────────────────────────────
// What the engine produces on each research cycle.

export type EIRResearchCycle = {
  student_id:              string
  ran_at:                  string
  pillars_updated:         ResearchPillar[]
  misconceptions_found:    number
  trajectory_class:        TrajectoryClass | null
  risk_alerts:             EIRRiskType[]
  kg_discoveries:          number
  recommendations_tracked: number
  personalization_updated: boolean
  career_snapshot_taken:   boolean
}
