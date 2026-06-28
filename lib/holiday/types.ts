// lib/holiday/types.ts

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
}

export type ClassHolidaySummary = {
  class_name:   string
  total_students: number
  common_gaps:  string[]       // gaps shared across most students
  plans_generated: number
}
