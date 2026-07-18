// lib/calendar/calendarPure.ts
// Pure types + merge logic — no Supabase import, safe for client
// components. Calendar entries come from two sources merged at read time,
// never duplicated: teacher-authored class_calendar_events rows, and
// assignments.due_date (the single source of truth for a due date already
// owned by the Assignments domain — ADR-0021 explicitly forbids copying it
// into a second table).

export type CalendarEntry = {
  id: string
  kind: 'event' | 'assignment_due'
  title: string
  description: string | null
  date: string // ISO date (yyyy-mm-dd)
  classId: string
}

export function mergeCalendar(input: {
  events: Array<{ id: string; class_id: string; title: string; description: string | null; event_date: string }>
  assignments: Array<{ id: string; class_id: string; title: string; due_date: string }>
}): CalendarEntry[] {
  const entries: CalendarEntry[] = [
    ...input.events.map(e => ({
      id: e.id, kind: 'event' as const, title: e.title, description: e.description, date: e.event_date, classId: e.class_id,
    })),
    ...input.assignments.map(a => ({
      id: a.id, kind: 'assignment_due' as const, title: `${a.title} due`, description: null,
      date: a.due_date.slice(0, 10), classId: a.class_id,
    })),
  ]
  return entries.sort((a, b) => a.date.localeCompare(b.date))
}
