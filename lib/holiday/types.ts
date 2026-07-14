// lib/holiday/types.ts

// A published holiday plan is only surfaced as guidance for this many days
// after approval — shared by the Learner Blueprint (lib/learnerIntelligence/blueprint.ts)
// and the student Holiday page (app/api/holiday/mine) so both agree on when
// a plan has gone stale.
export const HOLIDAY_PLAN_RELEVANCE_DAYS = 45

export type HolidayWeek = {
  week:          number
  label:         string           // "Week 1 — Consolidate"
  compass_topics: string[]        // Compass sessions to assign
  parent_action: string           // one thing parent does this week
  student_task:  string           // one thing student does
  is_rest_week:  boolean
}

export type HolidayPlanData = {
  student_name:     string
  grade:            number
  holiday_period:   string
  priority_gaps:    string[]   // top 2-3 things to address
  career_note:      string | null  // career-aligned motivation
  weeks:            HolidayWeek[]
  whatsapp_message: string     // the exact WhatsApp message to send
  parent_summary:   string     // 2-3 sentence parent summary
  /**
   * Confidence behind `priority_gaps[0]` — the same Low/Medium/High label
   * every other intelligence consumer uses (lib/learnerIntelligence/insight.ts),
   * sourced from the Projection Engine's confidence for that subject. Null
   * when there were no priority gaps to begin with (a genuinely on-track
   * learner, not a confidence judgment).
   */
  evidence_confidence: 'Low' | 'Medium' | 'High' | null
}

export type ClassHolidaySummary = {
  class_name:   string
  total_students: number
  common_gaps:  string[]       // gaps shared across most students
  plans_generated: number
}
