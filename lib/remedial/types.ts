// lib/remedial/types.ts

// Kenya's real CBC 4-level competency rubric — the same BE/AE/ME/EE codes
// used platform-wide for report cards and KNEC export. Mirrors
// lib/adaptiveLearning/recommend.ts's AdaptiveGroupType exactly (this type
// exists separately only so lib/remedial/ has no import-time dependency on
// the adaptiveLearning module for its own plan-shape types).
export type RemedialGroupType =
  | 'BE'   // Below Expectations — missing foundational concepts, needs 1-on-1
  | 'AE'   // Approaching Expectations — missing prerequisite, re-teach first
  | 'ME'   // Meeting Expectations — understands prerequisite, confused on this concept
  | 'EE'   // Exceeding Expectations — no remediation needed, extension/peer teaching role

export type RemedialStudent = {
  student_id:   string | null  // null if student not yet linked
  student_name: string
  gap_detail:   string         // specific thing they are missing
  root_cause:   string | null  // from root cause classifier
  compass_topic?: string       // Compass session to auto-assign
}

export type RemedialGroup = {
  type:            RemedialGroupType
  label:           string            // "Group A — Prerequisite Gap"
  students:        RemedialStudent[]
  teaching_action: string            // what the teacher does with this group
  compass_action?: string            // what gets auto-assigned in Compass
  peer_pairs?:     [string, string][] // [helper_name, learner_name] pairs
  lessons_needed:  number
  suggested_activity: string
}

export type TeacherAllocation = {
  total_remedial_weeks: number
  week_by_week:         string[]   // one sentence per week
  compass_assignments:  number     // number of Compass sessions to assign
  check_in_week:        number     // which week to reassess
}

export type RemedialPlan = {
  id?:         string
  sow_id:      string
  teacher_id:  string
  class_id:    string | null
  term:        number
  year:        number
  week_start:  number
  week_end:    number
  subject:     string
  strand:      string
  sub_strand:  string
  groups:      RemedialGroup[]
  allocation:  TeacherAllocation
  generated_at: string
}
