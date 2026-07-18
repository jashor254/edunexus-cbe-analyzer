// lib/calendar/calendar.ts
// Server-only — DB access. Pure merge logic lives in calendarPure.ts.

import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { mergeCalendar, type CalendarEntry } from './calendarPure'

export type { CalendarEntry } from './calendarPure'

export async function buildClassCalendar(classId: string): Promise<CalendarEntry[]> {
  const db = createServiceClient()
  const [events, { data: assignments }] = await Promise.all([
    repos.classCalendar.findEventsByClass(classId),
    db.from('assignments').select('id, class_id, title, due_date').eq('class_id', classId),
  ])
  return mergeCalendar({ events, assignments: assignments ?? [] })
}

export async function buildCalendarForClassIds(classIds: string[]): Promise<CalendarEntry[]> {
  if (!classIds.length) return []
  const db = createServiceClient()
  const [events, { data: assignments }] = await Promise.all([
    repos.classCalendar.findEventsByClassIds(classIds),
    db.from('assignments').select('id, class_id, title, due_date').in('class_id', classIds),
  ])
  return mergeCalendar({ events, assignments: assignments ?? [] })
}
