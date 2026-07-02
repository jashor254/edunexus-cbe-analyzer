// lib/eils/types.ts
// EduNexus Intelligence Learning System — canonical type definitions.
//
// EILS is the cognitive coordination layer above every EduNexus service.
// It does not replace those services — it coordinates them.

import type { LearnerProfile, RiskLevel, RiskFlag } from '@/lib/learnerModel/types'
import type { RootCauseResult } from '@/lib/knowledgeGraph/types'

// ── EILS Event Stream ─────────────────────────────────────────────────────────

export type EILSEventType =
  | 'assessment.completed'
  | 'compass.session_ended'
  | 'formative.recorded'
  | 'parent.observation'
  | 'remedial.started'
  | 'remedial.completed'
  | 'career.profile_updated'
  | 'risk.escalated'
  | 'risk.resolved'
  | 'milestone.achieved'
  | 'academy.mission_completed'

export type EILSEventSource =
  | 'assessmentPipeline'
  | 'compass'
  | 'remedialPlanner'
  | 'parentPulse'
  | 'formativeSignal'
  | 'careerEngine'
  | 'academyMissions'
  | 'eils.coordinator'

export type EILSEvent = {
  id:           string
  student_id:   string
  event_type:   EILSEventType
  source:       EILSEventSource
  payload:      Record<string, unknown>
  processed:    boolean
  processed_at: string | null
  created_at:   string
  updated_at:   string
}

// ── Next Best Learning Action ─────────────────────────────────────────────────

export type ActionType =
  | 'review_topic'
  | 'practice_questions'
  | 'watch_explanation'
  | 'generate_lesson'
  | 'notify_teacher'
  | 'notify_parent'
  | 'career_exploration'
  | 'remediation'
  | 'acceleration'
  | 'confidence_activity'
  | 'peer_discussion'
  | 'hands_on_activity'

export type RecommendationStatus = 'pending' | 'actioned' | 'dismissed' | 'expired' | 'superseded'
export type RecommendationOutcome = 'effective' | 'ineffective' | 'partial'

export type EILSRecommendation = {
  id:              string
  student_id:      string
  action_type:     ActionType
  priority:        number       // 1 = highest urgency
  confidence:      number       // 0–1
  reasoning:       string       // plain English — always explainable
  evidence:        RecommendationEvidence
  expected_impact: string
  subject?:        string
  substrand?:      string
  source_system:   string
  status:          RecommendationStatus
  actioned_at?:    string
  outcome?:        RecommendationOutcome
  outcome_note?:   string
  expires_at?:     string
  created_at:      string
  updated_at:      string
}

export type RecommendationEvidence = {
  risk_flags?:         RiskFlag[]
  weak_substrands?:    string[]
  kg_root_causes?:     string[]
  career_signals?:     string[]
  behaviour_signals?:  string[]
  assessment_data?:    string[]
  parent_signals?:     string[]
  consecutive_weeks?:  number
}

// ── Education Reasoning ───────────────────────────────────────────────────────

export type ReasoningType =
  | 'why_struggling'
  | 'intervention_selection'
  | 'next_action'
  | 'career_update'
  | 'risk_assessment'
  | 'pathway_recommendation'

export type ReasoningEvidence = {
  learner_model:   Record<string, unknown>
  knowledge_graph: RootCauseResult[]
  career_profile:  Record<string, unknown>
  behaviour:       Record<string, unknown>
  risk_history:    Record<string, unknown>[]
}

export type ReasoningResult = {
  question:    string
  conclusion:  string
  confidence:  number
  evidence:    ReasoningEvidence
  actions:     ActionRecommendation[]
}

export type ActionRecommendation = {
  action:          ActionType
  subject?:        string
  substrand?:      string
  rationale:       string
  confidence:      number
  expected_impact: string
}

// ── Intervention Tracking ─────────────────────────────────────────────────────

export type InterventionType =
  | 'remedial_plan'
  | 'compass_assignment'
  | 'teacher_one_on_one'
  | 'parent_home_activity'
  | 'peer_pairing'
  | 'holiday_plan'

export type InterventionOutcome = 'resolved' | 'partial' | 'ineffective' | 'pending'

export type EILSIntervention = {
  id:                       string
  student_id:               string
  risk_flag_type:           string
  subject?:                 string
  substrand?:               string
  intervention_type:        InterventionType
  intervention_ref?:        string
  teacher_id?:              string
  started_at:               string
  resolved_at?:             string
  outcome?:                 InterventionOutcome
  outcome_evidence?:        Record<string, unknown>
  consecutive_weeks_before?: number
  was_effective?:           boolean
  created_at:               string
  updated_at:               string
}

// ── Reasoning Log ─────────────────────────────────────────────────────────────

export type EILSReasoningLog = {
  id:                       string
  student_id:               string
  reasoning_type:           ReasoningType
  question:                 string
  conclusion:               string
  confidence:               number
  evidence:                 Record<string, unknown>
  kg_evidence?:             Record<string, unknown>
  learner_history_evidence?: Record<string, unknown>
  career_evidence?:         Record<string, unknown>
  recommendation_id?:       string
  created_at:               string
}

// ── Milestone ─────────────────────────────────────────────────────────────────

export type EILSMilestoneType =
  | 'term_breakthrough'
  | 'capability_leap'
  | 'pathway_threshold'
  | 'career_readiness_surge'
  | 'risk_resolution_sustained'
  | 'behaviour_transformation'

export type EILSMilestone = {
  id:               string
  student_id:       string
  milestone_type:   EILSMilestoneType
  title:            string
  description:      string
  evidence:         Record<string, unknown>
  celebrated:       boolean
  notified_teacher: boolean
  notified_parent:  boolean
  achieved_at:      string
  created_at:       string
}

// ── Unified Intelligence Profile ──────────────────────────────────────────────
// Layer 1 output — everything EILS knows about a learner in one snapshot.

export type IntelligenceSnapshot = {
  student_id:      string
  generated_at:    string

  // From Learner Model
  profile:         LearnerProfile

  // From Knowledge Graph
  root_causes:     RootCauseResult[]
  missing_prereqs: string[]

  // From Career System
  career_readiness_score: number    // 0–100 composite
  top_career:             string | null
  pathway_leader:         'stem' | 'social_sciences' | 'arts_sports' | 'technical_tvet' | null

  // From EILS
  pending_recommendations: EILSRecommendation[]
  active_interventions:    EILSIntervention[]
  recent_milestones:       EILSMilestone[]

  // Summary for quick reads
  summary: IntelligenceSummary
}

export type IntelligenceSummary = {
  overall_risk:         RiskLevel
  top_action:           string         // one-sentence: "What should happen next?"
  top_action_type:      ActionType
  struggling_subjects:  string[]
  strong_subjects:      string[]
  weeks_at_current_risk: number
  last_positive_signal: string | null  // date
  celebration_pending:  boolean        // unnotified milestone exists
}

// ── AI Coordination Context ───────────────────────────────────────────────────
// What EILS provides to any AI system asking "what do I need to know?"

export type EILSCoordinationContext = {
  student_id:          string
  grade:               number
  risk_level:          RiskLevel
  confirmed_gaps:      string[]
  persistent_gaps:     string[]
  top_weak_substrands: string[]           // max 5, prioritised by KG depth
  top_strong_substrands: string[]         // max 3
  learning_style:      LearningStyleHint
  career_direction:    string | null      // e.g. "Engineering" or null
  pathway:             string | null
  recommended_approach: TeachingApproach
  prerequisite_gaps:   string[]           // KG-identified missing foundations
  context_note:        string             // plain English for AI system prompt injection
}

export type LearningStyleHint =
  | 'needs_foundation_first'    // missing prerequisites — don't go advanced
  | 'ready_for_challenge'       // strong across board, push harder
  | 'confidence_building'       // declining trend — start with wins
  | 'needs_variety'             // low velocity, try different modalities
  | 'standard'                  // no special flag

export type TeachingApproach =
  | 'remediate_prerequisite'
  | 'reinforce_concepts'
  | 'challenge_and_extend'
  | 'restore_confidence'
  | 'standard_progression'

// ── Teacher Intelligence Panel ────────────────────────────────────────────────
// Layer 6 output

export type EILSTeacherPanel = {
  class_id:                  string
  teacher_id:                string
  week_of:                   string
  students_needing_attention: StudentAttentionItem[]
  class_trajectory:          'improving' | 'stable' | 'declining'
  hidden_misconceptions:     MisconceptionAlert[]
  acceleration_candidates:   AccelerationCandidate[]
  lesson_adaptation_tips:    string[]
  class_mastery_heatmap:     MasteryHeatmapRow[]
  generated_at:              string
}

export type StudentAttentionItem = {
  student_id:       string
  student_name:     string
  risk_level:       RiskLevel
  reason:           string         // one sentence
  suggested_action: string
  weeks_at_risk:    number
  peer_helper?:     string         // name of a classmate who can support
}

export type MisconceptionAlert = {
  substrand:        string
  subject:          string
  students_affected: number
  evidence:         string
  suggestion:       string
}

export type AccelerationCandidate = {
  student_id:   string
  student_name: string
  reason:       string
  suggestion:   string
}

export type MasteryHeatmapRow = {
  substrand:    string
  subject:      string
  avg_level:    number     // 1–4
  pct_below_me: number     // % below Meeting Expectations
  trend:        'improving' | 'stable' | 'declining'
}

// ── Parent Intelligence ────────────────────────────────────────────────────────
// Layer 7 output

export type EILSParentInsight = {
  student_id:      string
  student_name:    string
  week_of:         string
  what_changed:    string    // plain language
  why_it_changed:  string
  what_you_can_do: string[]  // home activities
  celebrations:    string[]  // positive moments to share
  concerns:        string[]  // gentle flags (not alarmist)
  career_hint?:    string    // "Did you know? Engineering requires..."
  generated_at:    string
}

// ── School Intelligence ───────────────────────────────────────────────────────
// Layer 8 output — delegates to lib/school/intelligence.ts, adds EILS overlay

export type EILSSchoolIntelligence = {
  school_id:              string
  week_of:                string
  curriculum_gaps:        CurriculumGap[]
  teaching_effectiveness: TeacherEffectivenessRow[]
  resource_needs:         ResourceNeed[]
  risk_clusters:          RiskCluster[]
  school_growth_trend:    'improving' | 'stable' | 'declining'
  generated_at:           string
}

export type CurriculumGap = {
  subject:      string
  substrand:    string
  grade:        number
  severity:     'low' | 'medium' | 'high'
  pct_affected: number
  recommendation: string
}

export type TeacherEffectivenessRow = {
  teacher_id:         string    // anonymised for privacy
  grade:              number
  subject:            string
  intervention_count: number
  efficacy_rate:      number
  risk_resolved_count: number
}

export type ResourceNeed = {
  subject:     string
  grade:       number
  need_type:   'remedial_materials' | 'assessment_tool' | 'compass_topics' | 'teacher_support'
  description: string
  urgency:     'low' | 'medium' | 'high'
}

export type RiskCluster = {
  subject:      string
  substrand:    string
  grade:        number
  student_count: number
  risk_level:   RiskLevel
  weeks_active: number
}
