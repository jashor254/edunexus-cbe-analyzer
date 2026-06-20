export type FollowUp = 'none' | 'minor' | 'major'
export type ReflectionSource = 'manual' | 'edited_suggestion' | 'ai_suggestion'

export type RootCauseCode =
  | 'PACE_MISMATCH'
  | 'CONCEPT_LEAP'
  | 'PREREQUISITE_GAP'
  | 'LANGUAGE_BARRIER'
  | 'RESOURCE_MISMATCH'
  | 'TEACHER_STRATEGY'
  | 'UNKNOWN'

export type SubstrandHealthRow = {
  id: string
  sow_id: string
  teacher_id: string
  strand: string
  sub_strand: string
  struggle_count: number
  lessons_covered: number
  assessment_level: number | null
  remediated: boolean
  root_cause: string | null
  risk_score: number | null
  last_flagged: string | null
  resolved_at: string | null
}

export type EvaluatedPlan = {
  id: string
  week_number: number
  lesson_number: number
  strand: string
  sub_strand: string
  taught_date: string | null
  updated_at: string | null
  teacher_flagged_followup: FollowUp | null
  reflection_source: ReflectionSource | null
  teacher_self_evaluation: string | null
}

export type WeeklyIntelligenceData = {
  sow_id: string
  teacher_id: string
  week_number: number
  week_health_score: number
  lessons_analyzed: number
  new_flags: SubstrandHealthRow[]
  persistent_flags: SubstrandHealthRow[]
  resolved_flags: SubstrandHealthRow[]
  remedial_bank_items: SubstrandHealthRow[]
  teacher_note: string
}

export type QuickCheckContent = {
  id: string
  suggested_activity: string
  questions: string[]
  generated_at: string
}

export type RemedialCard = {
  substrand_health_id: string
  sow_id: string
  strand: string
  sub_strand: string
  struggle_count: number
  root_cause: RootCauseCode | null
  quick_check: QuickCheckContent | null
}
