// lib/school/types.ts
// School Intelligence Layer — aggregated intelligence for principals and HoDs.
//
// Privacy contract:
//   - Principal sees: aggregated counts, percentages, trends. NO individual student names.
//   - HoD sees: same, restricted to their subject.
//   - Teacher sees: their own class data only.
//   - Individual student PII never exposed at school level.

export type StrandHealthRecord = {
  subject:         string
  substrand:       string
  grade:           number
  pct_below_me:    number     // % of students at Level 1 or 2
  struggle_count:  number     // raw number of struggling students
  total_students:  number
  trend:           'improving' | 'stable' | 'declining'
  weeks_declining: number
  avg_level:       number     // 1–4
  teacher_count:   number     // how many teachers cover this substrand
}

export type GradeHealthRecord = {
  grade:           number
  subject?:        string     // null = all subjects aggregated
  total_students:  number
  normal_pct:      number
  watch_pct:       number
  at_risk_pct:     number
  critical_pct:    number
  avg_capability:  Record<string, number>   // dimension → 0–1 score
  trend:           'improving' | 'stable' | 'declining'
}

export type InterventionEfficacyRecord = {
  intervention_type:    string
  total_run:            number
  total_with_outcome:   number
  effective_count:      number
  efficacy_rate:        number    // 0–1
  avg_days_to_improve:  number | null
}

export type TeacherActivitySignal = {
  teacher_id:           string   // anonymised in principal view
  grade:                number
  subject:              string
  formative_signal_count_this_term: number
  at_risk_students:     number
  at_risk_resolved:     number
  intervention_efficacy: number  // 0–1
  last_active:          string
}

export type PersistentRiskStudent = {
  // No name — privacy. Teacher can look up from their own class view.
  student_id:       string   // only visible to assigned teacher
  grade:            number
  subject?:         string
  weeks_at_risk:    number
  risk_level:       string
  top_flag:         string
}

export type SchoolIntelligenceSummary = {
  school_id:        string
  week_of:          string
  // Overview
  total_students:   number
  total_teachers:   number
  total_classes:    number
  // Risk distribution
  risk_distribution: {
    normal:   number
    watch:    number
    at_risk:  number
    critical: number
  }
  risk_pcts: {
    normal:   number
    watch:    number
    at_risk:  number
    critical: number
  }
  risk_trend: 'improving' | 'stable' | 'declining'
  // Top intelligence
  top_struggling_strands: StrandHealthRecord[]   // top 5
  grade_health:           GradeHealthRecord[]
  persistent_risk_count:  number   // at_risk 4+ weeks — count only
  // Interventions
  interventions_this_term: number
  intervention_efficacy:   number   // school-wide efficacy rate 0–1
  // Capability school-wide averages
  avg_capability_dimensions: Record<string, number>
  // Timestamps
  generated_at: string
}

export type PrincipalDashboard = {
  summary:                SchoolIntelligenceSummary
  top_strand_concerns:    StrandHealthRecord[]
  grade_breakdown:        GradeHealthRecord[]
  intervention_efficacy:  InterventionEfficacyRecord[]
  teacher_activity:       TeacherActivitySignal[]
  trend_vs_last_term:     {
    risk_change_pct:      number    // positive = more at risk, negative = fewer
    top_improved_strand:  string | null
    top_declined_strand:  string | null
  }
}
