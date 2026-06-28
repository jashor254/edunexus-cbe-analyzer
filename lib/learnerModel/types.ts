// lib/learnerModel/types.ts
// The Permanent Learner Memory — a living, continuously-evolving profile per student.
// Every intelligence engine reads from here. Every data source writes to here.
//
// EIOS Principle: The Learner Model is the only permanent source of truth.
// Every interaction either updates it, reads from it, validates it,
// or improves confidence in it. Nothing bypasses it.

export type RiskLevel = 'normal' | 'watch' | 'at_risk' | 'critical'

export type RiskFlagType =
  | 'declining_performance'
  | 'missing_prerequisite'
  | 'disengaged'
  | 'language_barrier'
  | 'no_assessment_data'
  | 'multiple_weak_substrands'

export type RiskFlag = {
  type:       RiskFlagType
  subject?:   string
  substrand?: string
  detail:     string
  severity:   'low' | 'medium' | 'high'
  flagged_at: string
}

// ── Knowledge State ───────────────────────────────────────────────────────────
// Per-substrand mastery — updated from assessments, compass sessions,
// formative signals, and parent observations.
// Confidence degrades when not validated for 60+ days.

export type MasterySource = 'assessment' | 'compass' | 'formative' | 'inferred' | 'parent'

export type SubstrandMastery = {
  level:            1 | 2 | 3 | 4   // CBC: BE=1, AE=2, ME=3, EE=4
  confidence:       'low' | 'medium' | 'high'
  source:           MasterySource
  assessment_count: number
  root_cause?:      string           // if struggling — from knowledge graph
  last_updated:     string
  last_validated:   string           // last confirmation from ANY source
  validation_count: number           // total cross-source confirmations
}

export type KnowledgeState = Record<string, SubstrandMastery>  // key = "subject:substrand"

// ── Capability Dimensions ─────────────────────────────────────────────────────
// 6 dimensions computed from assessment score history via capabilityExtractor.
// These are more durable than grades — trend IS the signal.

export type CapabilityLevel = 'emerging' | 'developing' | 'capable' | 'strong' | 'exceptional'
export type CapabilityTrend = 'declining' | 'stable' | 'growing' | 'accelerating'

export type CapabilityDimension = {
  raw_score:     number          // 0–1
  level:         CapabilityLevel
  trend:         CapabilityTrend
  confidence:    number          // 0–1 (higher = more assessment data)
  last_computed: string
  previous_level?: CapabilityLevel  // to detect threshold crossings
}

export type CapabilityDimensions = {
  analytical_reasoning: CapabilityDimension
  communication:        CapabilityDimension
  creative_thinking:    CapabilityDimension
  technical_aptitude:   CapabilityDimension
  social_intelligence:  CapabilityDimension
  resilience:           CapabilityDimension
}

// ── Learning Behaviour ────────────────────────────────────────────────────────
// HOW a student learns — not just what they know.
// Updated from: Compass consecutiveRight/Wrong, Academy reflections,
//               session frequency patterns.
// This replaces the unsupported 'learning_style' field.

export type BehaviourMetric = {
  score:       number    // 0–1, rolling weighted average
  trend:       'improving' | 'stable' | 'declining'
  data_points: number
  last_updated: string
}

export type LearningBehaviour = {
  persistence:   BehaviourMetric   // continues after consecutive wrong answers
  confidence:    BehaviourMetric   // correct responses after previous errors
  velocity:      BehaviourMetric   // concepts mastered per hour of Compass
  help_seeking:  BehaviourMetric   // self-initiates Compass vs. waits for assignment
  reflection:    BehaviourMetric   // quality and depth of Academy reflections
  consistency:   BehaviourMetric   // regularity vs. burst engagement pattern
}

// ── Growth Milestones ─────────────────────────────────────────────────────────
// Permanent record of meaningful progress events.
// Never deleted — the narrative of a learner's journey.
// Source for parent celebrations, student motivation, career signals.

export type MilestoneType =
  | 'capability_threshold'    // capability level crossed upward
  | 'risk_resolved'           // student moved from at_risk/critical → normal
  | 'first_mastery'           // first time a substrand reached Level 3+
  | 'prerequisite_cleared'    // knowledge graph prerequisite gap closed
  | 'pathway_readiness_cross' // pathway readiness crossed 50% / 70% threshold
  | 'behaviour_improvement'   // a learning behaviour metric significantly improved

export type GrowthMilestone = {
  type:          MilestoneType
  dimension?:    string        // for capability_threshold
  substrand?:    string        // for first_mastery, prerequisite_cleared
  pathway?:      string        // for pathway_readiness_cross
  behaviour?:    string        // for behaviour_improvement
  from_level:    string
  to_level:      string
  achieved_at:   string
  notified:      boolean       // has this surfaced to teacher/parent/student?
  notified_at?:  string
}

// ── Risk History ──────────────────────────────────────────────────────────────
// Permanent record of every risk flag — when it appeared, how long it persisted,
// what resolved it. This is what makes intervention efficacy measurable.

export type RiskResolutionType =
  | 'assessment_improved'
  | 'compass_completed'
  | 'parent_confirmed'
  | 'teacher_intervention'
  | 'natural_decay'

export type RiskHistoryRecord = {
  flag_type:          RiskFlagType
  severity:           'low' | 'medium' | 'high'
  subject?:           string
  substrand?:         string
  first_flagged:      string
  last_seen:          string
  resolved_at?:       string
  consecutive_weeks:  number
  peak_severity:      'low' | 'medium' | 'high'
  resolution_type?:   RiskResolutionType
  intervention_id?:   string   // links to intervention_log
}

// ── Parent Observations ───────────────────────────────────────────────────────
// Inbound WhatsApp replies parsed from the weekly Parent Pulse.
// The only evening/weekend learning signal the platform has.
// Weighted lower than assessments (0.6) but higher than inferred (0.3).

export type ParentObservationOutcome = 'demonstrated' | 'struggled' | 'not_attempted'

export type ParentObservation = {
  substrand:    string
  outcome:      ParentObservationOutcome
  week_of:      string
  source:       'whatsapp_reply'
  confidence:   number           // default 0.6
  recorded_at:  string
}

// ── Pathway Readiness ─────────────────────────────────────────────────────────
// Live 0-100 readiness scores per CBC pathway.
// Updated automatically after every assessment — not on-demand.
// This makes the Career Intelligence Report a confirmation, not a discovery.

export type PathwayReadinessScore = {
  score:        number    // 0–100
  trend:        'improving' | 'stable' | 'declining'
  last_updated: string | null
}

export type PathwayReadiness = {
  stem:           PathwayReadinessScore
  social_sciences: PathwayReadinessScore
  arts_sports:    PathwayReadinessScore
  technical_tvet: PathwayReadinessScore
}

// ── Career Signals ────────────────────────────────────────────────────────────

export type CareerSignals = {
  top_career_slugs:    string[]
  readiness_scores:    Record<string, number>   // careerSlug → 0–100
  strongest_subjects:  string[]
  weakest_subjects:    string[]
  last_updated:        string
}

// ── Engagement Patterns ───────────────────────────────────────────────────────

export type EngagementPatterns = {
  compass_topics_explored:  string[]
  sessions_last_30_days:    number
  assignments_submitted:    number
  avg_session_mins:         number
  last_active:              string
}

// ── Formative Signal Snapshot ─────────────────────────────────────────────────

export type FormativeSignalSnapshot = {
  class_id:    string
  subject:     string
  substrand?:  string
  outcome:     'got_it' | 'confused' | 'lost'
  recorded_at: string
}

// ── Full Learner Profile ──────────────────────────────────────────────────────
// The complete Permanent Learner Memory.

export type LearnerProfile = {
  id:                   string
  student_id:           string

  // ── Academic Mastery ───────────────────────────────────────────────────────
  knowledge_state:      KnowledgeState
  confirmed_gaps:       string[]              // weak across 2+ assessments
  persistent_gaps:      string[]              // weak across 2+ terms

  // ── Capability Profile ─────────────────────────────────────────────────────
  capability_dimensions: Partial<CapabilityDimensions>

  // ── Learning Behaviour (replaces learning_style) ──────────────────────────
  learning_behaviour:   LearningBehaviour

  // ── Career Intelligence ────────────────────────────────────────────────────
  career_signals:       Partial<CareerSignals>
  pathway_readiness:    PathwayReadiness

  // ── Engagement ────────────────────────────────────────────────────────────
  engagement_patterns:  Partial<EngagementPatterns>

  // ── Observations ──────────────────────────────────────────────────────────
  formative_signals:    FormativeSignalSnapshot[]    // sliding window of last 20
  parent_observations:  ParentObservation[]          // last 12 (3 months)

  // ── Risk ──────────────────────────────────────────────────────────────────
  risk_flags:           RiskFlag[]                   // current active flags
  risk_history:         RiskHistoryRecord[]          // permanent record
  overall_risk_level:   RiskLevel

  // ── Growth Record ─────────────────────────────────────────────────────────
  growth_milestones:    GrowthMilestone[]

  // ── Term Snapshots ────────────────────────────────────────────────────────
  term_snapshots:       TermSnapshot[]

  // ── Legacy (kept for backwards compat, do not use in new code) ───────────
  learning_style:       string | null
  strengths:            Record<string, unknown>
  weaknesses:           Record<string, unknown>
  interests:            Record<string, unknown>
  profile_data:         Record<string, unknown>

  // ── Metadata ──────────────────────────────────────────────────────────────
  last_assessment_date: string | null
  current_term:         number | null
  current_year:         number | null
  created_at:           string
  updated_at:           string
}

export type TermSnapshot = {
  term:         number
  year:         number
  snapped_at:   string
  risk_level:   RiskLevel
  capability_summary: Record<string, { level: string; score: number }>
  knowledge_summary:  Record<string, number>  // substrand → level
  pathway_readiness:  Record<string, number>  // pathway → score
}

// ── Monday Panel Output Types ─────────────────────────────────────────────────

export type StudentIntelligenceSummary = {
  student_id:           string
  student_name:         string
  risk_level:           RiskLevel
  top_flags:            RiskFlag[]
  action:               string          // one sentence: what to do
  peer_pairing?:        string          // who can help them and why
  compass_suggestion?:  string          // specific topic to assign
  career_moment?:       string          // if capability milestone crossed
  weeks_at_risk?:       number          // from risk_history
}

export type TeachingPatternInsight = {
  pattern:     string    // e.g. "Lost signals cluster on algebraic expressions"
  count:       number
  suggestion:  string    // what to do about it
  substrands:  string[]
}

export type PrerequisiteAlert = {
  lesson_substrand:    string
  missing_prereq:      string
  students_affected:   number
  pct_affected:        number
  suggested_warmup:    string
  student_names:       string[]
}

export type InterventionCheckin = {
  intervention_id:   string
  student_name:      string
  student_id:        string
  substrand:         string
  intervention_type: string
  days_since:        number
  due_date:          string
}

export type CareerMicroMoment = {
  student_id:    string
  student_name:  string
  moment_type:   'capability_threshold' | 'pathway_readiness_cross'
  message:       string    // what to tell the teacher
  parent_note:   string    // what to include in parent pulse
}

export type ClassIntelligencePanel = {
  class_id:            string
  class_name:          string
  week_of:             string
  // Core intelligence
  students_needing_attention: StudentIntelligenceSummary[]
  class_trajectory:    string
  // New intelligence layers
  teaching_patterns:   TeachingPatternInsight[]    // teacher self-insight
  prerequisite_alerts: PrerequisiteAlert[]          // pre-lesson readiness
  pending_checkins:    InterventionCheckin[]         // 14-day follow-ups due
  career_moments:      CareerMicroMoment[]           // capability threshold events
  // Summary stats
  total_students:      number
  normal_count:        number
  watch_count:         number
  at_risk_count:       number
  critical_count:      number
  generated_at:        string
}
