// lib/career/types.ts
import type { PathwayResult } from '@/lib/pathwayCalculator'
import type { ConfidenceLevel } from '@/lib/learnerIntelligence/insight'
export type { PathwayResult }

// ── COS Disclaimer ────────────────────────────────────────────────────────────
// Attached to every capability profile, career match, and COS output.
export const COS_DISCLAIMER =
  'These are informed estimates based on current Kenya market data, real assessment performance, and global career trends. ' +
  'Technology, job markets, and educational pathways change — sometimes rapidly. ' +
  'We review and update this information regularly and will always be transparent about what has shifted. ' +
  'The goal is not to predict the future perfectly, but to help you make better decisions with the best available information today.'

// ── Capability Engine Types ───────────────────────────────────────────────────

export type CapabilityLevel = 'emerging' | 'developing' | 'capable' | 'strong' | 'exceptional'
export type CapabilityTrendDirection = 'declining' | 'stable' | 'growing' | 'accelerating'

export type CapabilityScore = {
  level:      CapabilityLevel
  raw_score:  number              // 0.0–1.0
  trend:      CapabilityTrendDirection
  evidence:   string[]            // specific data points that drove this score
  confidence: number              // 0.0–1.0 — how much data we have
}

export type CapabilityProfile = {
  analytical_reasoning: CapabilityScore
  communication:        CapabilityScore
  creative_thinking:    CapabilityScore
  technical_aptitude:   CapabilityScore
  social_intelligence:  CapabilityScore
  resilience:           CapabilityScore
  dominant_cluster:     string[]  // top capabilities (raw_score >= 0.60)
  emerging_cluster:     string[]  // growing capabilities (0.40–0.60)
  computed_at:          string
  assessment_count:     number
  disclaimer:           string
}

export type CapabilityDimension =
  | 'analytical_reasoning'
  | 'communication'
  | 'creative_thinking'
  | 'technical_aptitude'
  | 'social_intelligence'
  | 'resilience'

export type CapabilityRequirement = {
  minimum: number   // 0.0–1.0 — below this, career is a major stretch
  ideal:   number   // 0.0–1.0 — above this, strong alignment
  weight:  number   // 0.0–1.0 — how much this capability matters for this career
  note:    string   // why this capability matters for this specific career
}

export type CareerCapabilityRequirements = Record<CapabilityDimension, CapabilityRequirement>

// ── Decision Intelligence Types ───────────────────────────────────────────────

export type KCSEMinimum = {
  overall_grade:      string                    // e.g. 'B+'
  subject_grades:     Record<string, string>    // e.g. { biology: 'A-', chemistry: 'A-' }
  alternative_routes: string[]
  note:               string
}

export type CostToQualify = {
  min:  number
  max:  number
  note: string
}

export type SocialReality = {
  prestige_level:       1 | 2 | 3 | 4 | 5
  common_misconception: string
  honest_reality_check: string
  parent_frame: {
    opening:           string
    key_points:        string[]
    honest_challenges: string[]
  }
}

export type CareerCategory =
  | 'technology'
  | 'health'
  | 'agriculture'
  | 'creative'
  | 'business'
  | 'trades'
  | 'education'
  | 'environment'
  | 'media'
  | 'finance'

export type DoorType = 'employment' | 'self_employment' | 'entrepreneurship' | 'ai_era'

// The 3 official CBC senior-school pathways — every career must fall under exactly one.
export type CareerPathway = 'STEM' | 'Social Sciences' | 'Arts & Sports Science'

export type AISovereignty = {
  the_shift: string
  what_you_can_build: string[]
  tools_to_learn: string[]
  sovereignty_example: string
}

export type EarlyStart = {
  age_14_16: string[]
  age_16_18: string[]
  first_win: string
}

export type SalaryTier = {
  min: number
  max: number
  label: string
}

export type SalaryTiers = {
  entry: SalaryTier
  mid: SalaryTier
  senior: SalaryTier
  note: string
  kenya_context?: string
  salary_growth_note?: string
}

export type CareerDoor = {
  type: DoorType
  title: string
  description: string
  // Employment
  salary_tiers?: SalaryTiers
  employers?: string[]
  time_to_first_job?: string
  // Self-employment
  startup_cost_kes?: { min: number; max: number }
  platforms?: string[]
  // Entrepreneurship
  kenya_examples?: string[]
  market_size?: string
  earnings_note?: string    // replaces salary for entrepreneur door
  // AI era
  ai_opportunity?: string
  skills_needed?: string[]
  early_mover_advantage?: boolean
  ai_sovereignty?: AISovereignty
  // Entrepreneurship enhanced
  the_gap?: string
  example_ventures?: string[]
  market_note?: string
}

export type AIImpact = {
  level: 'low' | 'medium' | 'high' | 'transforming'
  replacing: string[]
  creating: string[]
  human_advantage: string[]
  timeline: string
  honest_summary: string
}

export type SkillTimelineItem = {
  age_range: string
  phase: string
  skills: string[]
  why: string
  parent_action: string
  activities?: string[]
}

// Kept as alias for backward compat with any legacy reads; new code uses SalaryTiers
export type SalaryRangeKES = SalaryTiers

export type KenyaExample = {
  name: string
  what_they_did: string
  started_from: string
  door?: DoorType
}

export type Career = {
  id: string
  slug: string
  title: string
  category: CareerCategory
  description: string
  doors: CareerDoor[]
  ai_impact: AIImpact
  kenya_market_outlook: string
  salary_range_kes: SalaryTiers | null
  required_subjects: string[]
  subject_importance: Record<string, 'critical' | 'important' | 'helpful'>
  skill_timeline: SkillTimelineItem[]
  future_skills: string[]
  kenya_examples: KenyaExample[] | null
  pathway: CareerPathway
  early_start?: EarlyStart
  university_courses?: string[]
  disclaimer: string
  created_at: string
  updated_at: string
  /**
   * When this career's FACTS were last confirmed — distinct from `updated_at`,
   * which any write moves. Null means never verified, which
   * `assessCareerKnowledge()` treats as unknown freshness, never as fresh.
   * Read it through lib/career/knowledgeLifecycle.ts, never bare.
   */
  knowledge_verified_at?: string | null
  knowledge_source_note?: string | null
  // ── COS Phase 1: Capability Intelligence ──────────────────────────────────
  required_capabilities?:      CareerCapabilityRequirements
  capability_cluster?:         string[]
  difficulty?:                 'accessible' | 'moderate' | 'hard' | 'very_hard'
  kenya_demand?:               'critical_shortage' | 'undersupplied' | 'balanced' | 'saturated'
  saturation_note?:            string | null
  kcse_minimum?:               KCSEMinimum | null
  time_to_income_years?:       number
  cost_to_qualify?:            CostToQualify | null
  risk_level?:                 'low' | 'medium' | 'high' | 'variable'
  prestige_level?:             1 | 2 | 3 | 4 | 5
  social_reality?:             SocialReality | null
  alternative_career_slugs?:   string[]
  complementary_career_slugs?: string[]
}

export type CareerSummary = Pick<
  Career,
  'id' | 'slug' | 'title' | 'category' | 'kenya_market_outlook' | 'salary_range_kes' | 'required_subjects' | 'pathway'
> & {
  description: string
  ai_impact: { level: AIImpact['level'] }
}

export type StudentCareerInterest = {
  id: string
  student_id: string
  career_id: string | null
  career_slug: string | null
  interest_level: number
  notes: string | null
  explored_at: string
  created_at: string
}

export type StudentCareerMatch = {
  id: string
  student_id: string
  career_id: string
  match_score: number
  match_reasoning: string
  subject_gaps: SubjectGap[] | null
  skill_gaps: string[] | null
  generated_at: string
}

export type SubjectGap = {
  subject: string
  current_score: number
  required_score: number
  gap: number
  advice: string
}

export type CareerMatchWithDetail = StudentCareerMatch & {
  career: CareerSummary
}

export type CareerSearchFilters = {
  q?: string
  category?: CareerCategory
  pathway?: CareerPathway
  ai_impact_level?: AIImpact['level']
  student_id?: string
}

export type MatchEngineInput = {
  student_id: string
  student_name: string
  grade: number
  age: number
  subject_scores: Record<string, number>
  interests: string[]
  dream_career?: string
  candidate_slugs?: string[]  // restrict match pool to these careers (cluster-based)
}

export type MatchEngineResult = {
  top_matches: Array<{
    career_slug: string
    career_title: string
    match_score: number
    reasoning: string
    subject_gaps: SubjectGap[]
    skill_gaps: string[]
  }>
  generated_at: string
}

export type ParentCareerSummary = {
  student_name: string
  student_age: number
  top_careers: CareerMatchWithDetail[]
  current_age_skills: Record<string, string[]>
  next_age_skills: Record<string, string[]>
  overall_readiness: string
  parent_actions: string[]
}

// ── Clinic Report Types ───────────────────────────────────────────────────────

export type ClinicReportSection = 'junior' | 'senior'

export type SubjectScoreRow = {
  subject: string
  display_name: string
  score: number
  required?: number
  gap?: number
  status: 'strong' | 'meets' | 'needs_work' | 'critical'
}

export type RoadmapStep = {
  subject: string
  fromLevel: number
  toLevel: number
}

export type FutureOpportunity = {
  name: string
  alignment: string
  futureTrend: string
  aiReality: string
}

export type PlanAction = {
  action: string
}

export type ParentPlan = {
  thisWeek: PlanAction[]
  thisMonth: PlanAction[]
  thisTerm: PlanAction[]
}

export type CompassPrescription = {
  focusTopics: string[]
  sessionFrequency: string
  estimatedWindow: string
}

export type ClinicReport = {
  student_id: string
  student_name: string
  grade: number
  age: number
  curriculum_type: string
  /** Resolved by resolveCurriculumFraming() (lib/curriculum/gradeLabel.ts) — the one curriculum-aware label every renderer must display instead of deriving its own. */
  curriculumLabel: string
  /** Whether CBC Senior School pathway vocabulary (STEM/Social Sciences/Arts & Sports Science/Business) may be shown for this learner. False for 8-4-4 and any unrecognised curriculum. */
  cbcPathwayAdmissible: boolean
  section: ClinicReportSection
  generated_at: string

  // Section 1 — Learner Snapshot
  overall_score: number
  overall_level: 1 | 2 | 3 | 4
  overall_label: string
  top_subjects: SubjectScoreRow[]
  weak_subjects: SubjectScoreRow[]
  summary_sentence: string

  // Section 2 — Career / Pathway
  recommended_pathway: string | null        // Junior: STEM/Social/Arts etc; Senior: chosen pathway
  kjsea_composite?: number                  // Junior: KJSEA 2025 composite score
  stem_viable?: boolean                     // Junior: STEM within reach (one blocker)
  pathwayGapAnalysis?: PathwayResult        // Junior: two-step pathway gap detail
  top_career: CareerMatchWithDetail | null  // Senior only
  career_gap_rows?: SubjectScoreRow[]       // Senior: career-required subjects with gap data
  top_career_detail: Career | null          // Senior only (for subject gaps)
  dream_career: string | null

  // Section 3 — Skill Timeline
  skill_timeline: SkillTimelineItem[]
  current_age_range: string
  current_phase: SkillTimelineItem | null
  next_phase: SkillTimelineItem | null

  // Section 4 — Parent Actions (legacy flat list — kept for junior + in-app view)
  parent_actions: Array<{
    title: string
    why: string
    action: string
    link?: string
  }>

  // Senior school academic diagnosis fields
  academicHealthStatus?: string
  academicDiagnosis?: string
  pathwayReadinessLabel?: 'Developing' | 'On Track' | 'Strong'
  readinessScore?: number
  strongContributors?: SubjectScoreRow[]
  currentConstraints?: SubjectScoreRow[]
  nextLevelRoadmap?: RoadmapStep[]
  futureOpportunities?: FutureOpportunity[]
  parentPlan?: ParentPlan
  expectedOutcome?: string[]
  compassPrescription?: CompassPrescription

  disclaimer: string
}

// ── Phase 2: Capability-to-Career Bridge types ───────────────────────────────

export type CapabilityMatchTier = 'primary' | 'stretch' | 'alternative' | 'entrepreneurial'

export type GapSeverity = 'none' | 'minor' | 'moderate' | 'significant'

export type CapabilityGap = {
  dimension:        CapabilityDimension
  student_level:    CapabilityLevel
  student_score:    number
  required_minimum: number
  required_ideal:   number
  gap_severity:     GapSeverity
  narrative:        string   // plain-English gap description
}

export type CapabilityStrength = {
  dimension: CapabilityDimension
  level:     CapabilityLevel
  narrative: string
}

export type RealityCheck = {
  kcse_achievable:      boolean
  cost_barrier:         'low' | 'medium' | 'high'
  time_to_income_years: number
  risk_level:           string
  difficulty:           string
  kenya_demand:         string
}

export type CapabilityCareerMatch = {
  career_slug:       string
  career_title:      string
  career_category:   CareerCategory
  pathway:           CareerPathway
  tier:              CapabilityMatchTier
  alignment_score:   number                              // 0.0–1.0
  /**
   * Same Low/Medium/High label every other consumer uses
   * (lib/learnerIntelligence/insight.ts), derived from the same
   * assessment-count thresholds scoreCareer() already uses to cap
   * alignment_score — not a second scoring scheme, just labeling the one
   * that already exists so evidence quality travels with the match.
   */
  confidence:        ConfidenceLevel
  dimension_scores:  Partial<Record<CapabilityDimension, number>>
  gaps:              CapabilityGap[]
  strengths:         CapabilityStrength[]
  reality_check:     RealityCheck
  narrative:         string                              // 2-sentence honest summary
  disclaimer:        string
}

export type CapabilityMatchReport = {
  student_id:             string
  primary:                CapabilityCareerMatch[]        // score >= 0.70
  stretch:                CapabilityCareerMatch[]        // 0.50–0.70
  alternative:            CapabilityCareerMatch[]        // 0.35–0.50
  entrepreneurial:        CapabilityCareerMatch[]        // cluster-routed entrepreneur tier
  total_careers_scored:   number
  assessment_count:       number
  dominant_cluster:       string[]
  generated_at:           string
  disclaimer:             string
}

export const STANDARD_DISCLAIMER =
  'These are informed estimates based on current Kenya market data and global trends. Technology is changing fast — especially AI. We update this information regularly and will always be honest with you about what\'s shifting. The goal is not to predict the future perfectly, but to help your child build skills that remain valuable no matter what changes.'

// ── Phase 5: Life Simulation Engine ──────────────────────────────────────────

export type CareerPhaseLabel = 'studying' | 'entry' | 'mid' | 'senior'

export type LifeSimulationYear = {
  age:                number
  year_offset:        number
  phase:              CareerPhaseLabel
  monthly_income_kes: number
  annual_cost_kes:    number
  net_this_year_kes:  number
  cumulative_net_kes: number
  milestone?:         string
}

export type LifeSimulation = {
  career_slug:              string
  career_title:             string
  education_start_age:      number
  income_start_age:         number
  breakeven_age:            number | null
  total_education_cost_kes: number
  peak_monthly_kes:         number
  entry_monthly_kes:        number
  mid_monthly_kes:          number
  senior_monthly_kes:       number
  simulation:               LifeSimulationYear[]
  disclaimer:               string
}

// ── Phase 6: Parent Intelligence ─────────────────────────────────────────────

export type ParentIntelligenceReport = {
  student_id:            string
  student_name:          string
  profile_summary:       string
  top_strengths:         string[]
  growth_areas:          string[]
  /** Grade 10-12 only — Junior always gets `career_families` instead, never a ranked/percentage career prediction. */
  recommended_careers:   CapabilityCareerMatch[]
  /** Grade 7-9 only — broad exploration families (Career Principle: Junior learners are exploring, never predicted). */
  career_families?:      import('@/lib/learnerIntelligence/careerIntelligence').CareerFamilyInsight[]
  mode:                  'exploration' | 'planning'
  conversation_starters: string[]
  support_actions:       string[]
  weekly_habits:         string[]
  red_flags:             string[]
  generated_at:          string
  disclaimer:            string
}

// ── Career Intelligence Engine (13-section framework) ────────────────────────

export type HiddenStrength = {
  strength:         string
  evidence:         string
  career_relevance: string
}

export type GrowthBarrier = {
  barrier:                 string
  explanation:             string
  opportunity_if_improved: string
}

export type OpportunityEntry = {
  career: string
  reason: string
}

export type StretchOpportunityEntry = {
  career:          string
  what_to_improve: string
}

export type UnlikelyOpportunityEntry = {
  career:                    string
  what_would_make_realistic: string
}

export type CIEAIRealityCheck = {
  career_title:                  string
  tasks_ai_will_automate:        string[]
  tasks_humans_still_do:         string[]
  skills_becoming_valuable:      string[]
  skills_becoming_less_valuable: string[]
  how_to_prepare:                string
}

export type CIEFourDoors = {
  employment:       string
  self_employment:  string
  business_creation: string
  ai_augmented:     string
}

export type EducationChain = {
  subject: string
  chain:   string[]
}

export type CIETeacherInsight = {
  subjects_requiring_intervention:    string[]
  hidden_strengths:                   string[]
  suggested_classroom_opportunities:  string[]
  suggested_responsibilities:         string[]
  how_to_nurture_confidence:          string
}

export type LearnerChallenge = {
  challenge:   string
  why:         string
  how_to_do_it: string
}

export type CareerIntelligenceReport = {
  student_id:   string
  student_name: string
  grade:        number
  age:          number
  pathway:      string | null
  dream_career: string | null
  /** Career Principle gate — Junior (Grade 7-9) = exploration, Senior (10-12) = planning. */
  mode:         'exploration' | 'planning'
  generated_at: string

  // S1: Career Readiness Snapshot
  readiness_score:      number
  readiness_label:      string
  readiness_summary:    string
  current_strengths:    string[]
  current_challenges:   string[]
  learning_habits_note: string

  // S2: Hidden Strengths
  hidden_strengths: HiddenStrength[]

  // S3: Growth Barriers
  growth_barriers: GrowthBarrier[]

  // S4: Future Opportunity Landscape
  strong_fit_now:        OpportunityEntry[]
  fit_after_improvement: StretchOpportunityEntry[]
  unlikely_today:        UnlikelyOpportunityEntry[]

  // S5: AI Reality Check (from top career's ai_impact)
  ai_reality_check: CIEAIRealityCheck | null

  // S6: Four Career Doors (from top career's doors)
  four_doors: CIEFourDoors | null

  // S7: Education → Opportunity Map
  education_chains: EducationChain[]

  // S8: Domain Expertise (AI-generated)
  domain_expertise: string

  // S9: Career Flexibility (AI-generated)
  career_flexibility: string

  // S10: Parent Guidance
  parent_this_week:       string[]
  parent_this_month:      string[]
  parent_long_term_habit: string

  // S11: Teacher Insight (AI-generated)
  teacher_insight: CIETeacherInsight

  // S12: Learner Challenge (AI-generated)
  learner_challenge: LearnerChallenge

  // S13: Career Intelligence Summary (AI-generated)
  intelligence_summary: string

  // Signature section
  if_learning_continues: string

  disclaimer: string
}

// ── Phase 7: Student Growth Engine ───────────────────────────────────────────

export type GrowthDirection = 'improved' | 'stable' | 'declined'

export type DimensionGrowth = {
  dimension:        CapabilityDimension
  previous_level:   CapabilityLevel
  current_level:    CapabilityLevel
  previous_score:   number
  current_score:    number
  delta:            number
  direction:        GrowthDirection
  weeks_since_last: number
}

export type CapabilityGrowthReport = {
  student_id:           string
  current_computed_at:  string
  previous_computed_at: string | null
  dimensions:           DimensionGrowth[]
  overall_direction:    GrowthDirection
  biggest_win:          DimensionGrowth | null
  biggest_drop:         DimensionGrowth | null
  highlight:            string
  weeks_tracked:        number
  disclaimer:           string
}
