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

export type AIImpactLevel = 'low' | 'medium' | 'high' | 'transforming'

export type PathwayType = 'university' | 'college' | 'tvet' | 'self_taught' | 'entrepreneurial' | 'apprenticeship'

export type CareerPathway = {
  type: PathwayType
  description: string
  cost_kes: { min: number; max: number; note: string }
  duration_years: number
  institutions: string[]
  entry_requirements?: string
}

export type SkillTimelineItem = {
  age_range: string
  skills: string[]
  why: string
  activities?: string[]
}

export type SalaryRangeKES = {
  min: number
  max: number
  note: string
  senior_max?: number
}

export type KenyaExample = {
  name: string
  what_they_did: string
  started_from: string
}

export type Career = {
  id: string
  slug: string
  title: string
  category: CareerCategory
  description: string
  ai_impact: string
  ai_impact_level: AIImpactLevel
  kenya_market_outlook: string
  salary_range_kes: SalaryRangeKES | null
  pathways: CareerPathway[]
  required_subjects: string[]
  skill_timeline: SkillTimelineItem[]
  future_skills: string[]
  obsolete_skills: string[] | null
  kenya_examples: KenyaExample[] | null
  created_at: string
  updated_at: string
}

export type CareerSummary = Pick<
  Career,
  'id' | 'slug' | 'title' | 'category' | 'ai_impact_level' | 'kenya_market_outlook' | 'salary_range_kes' | 'required_subjects'
> & {
  description: string
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
  ai_impact_level?: AIImpactLevel
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
