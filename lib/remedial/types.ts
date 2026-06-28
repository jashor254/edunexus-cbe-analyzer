// lib/remedial/types.ts

export type RemedialGroupType =
  | 'prerequisite_gap'   // Missing foundational concept — re-teach first
  | 'concept_confusion'  // Understands prerequisite but confused on this concept
  | 'on_track'           // No remediation needed — extension/peer teaching role
  | 'critical_gap'       // Severe: multiple prerequisites missing, needs 1-on-1

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
