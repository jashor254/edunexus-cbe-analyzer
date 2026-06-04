// lib/career/types.ts

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
  pathway: 'STEM' | 'Social' | 'Arts' | 'Creative' | 'Trades'
  disclaimer: string
  created_at: string
  updated_at: string
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

export type ClinicReport = {
  student_id: string
  student_name: string
  grade: number
  age: number
  curriculum_type: string
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
  recommended_pathway: string | null        // Junior: STEM/Social/Arts etc
  kjsea_composite?: number                  // Junior: KJSEA 2025 composite score
  stem_viable?: boolean                     // Junior: STEM within reach (one blocker)
  top_career: CareerMatchWithDetail | null  // Senior only
  top_career_detail: Career | null          // Senior only (for subject gaps)
  dream_career: string | null

  // Section 3 — Skill Timeline
  skill_timeline: SkillTimelineItem[]
  current_age_range: string
  current_phase: SkillTimelineItem | null
  next_phase: SkillTimelineItem | null

  // Section 4 — Parent Actions
  parent_actions: Array<{
    title: string
    why: string
    action: string
    link?: string
  }>

  disclaimer: string
}

export const STANDARD_DISCLAIMER =
  'These are informed estimates based on current Kenya market data and global trends. Technology is changing fast — especially AI. We update this information regularly and will always be honest with you about what\'s shifting. The goal is not to predict the future perfectly, but to help your child build skills that remain valuable no matter what changes.'
