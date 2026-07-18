// lib/repositories/classCalendar.repository.ts
// Owns `class_calendar_events` and `class_announcements` exclusively
// (ADR-0021).

import { BaseRepository } from './base'

export type ClassCalendarEventRow = {
  id: string
  class_id: string
  teacher_id: string
  title: string
  description: string | null
  event_date: string
  created_at: string
  updated_at: string
}

export type ClassAnnouncementRow = {
  id: string
  class_id: string
  teacher_id: string
  title: string
  body: string
  created_at: string
  updated_at: string
}

export class ClassCalendarRepository extends BaseRepository {
  async createEvent(input: {
    classId: string
    teacherId: string
    title: string
    description?: string
    eventDate: string
  }): Promise<ClassCalendarEventRow> {
    const { data, error } = await this.db
      .from('class_calendar_events')
      .insert({
        class_id: input.classId,
        teacher_id: input.teacherId,
        title: input.title,
        description: input.description ?? null,
        event_date: input.eventDate,
      })
      .select()
      .single()
    if (error || !data) throw new Error('Failed to create calendar event')
    return data as ClassCalendarEventRow
  }

  async findEventsByClass(classId: string): Promise<ClassCalendarEventRow[]> {
    const { data, error } = await this.db
      .from('class_calendar_events')
      .select('id, class_id, teacher_id, title, description, event_date, created_at, updated_at')
      .eq('class_id', classId)
      .order('event_date', { ascending: true })
    if (error) throw new Error('Failed to fetch calendar events')
    return (data ?? []) as ClassCalendarEventRow[]
  }

  async findEventsByClassIds(classIds: string[]): Promise<ClassCalendarEventRow[]> {
    if (!classIds.length) return []
    const { data, error } = await this.db
      .from('class_calendar_events')
      .select('id, class_id, teacher_id, title, description, event_date, created_at, updated_at')
      .in('class_id', classIds)
      .order('event_date', { ascending: true })
    if (error) throw new Error('Failed to fetch calendar events')
    return (data ?? []) as ClassCalendarEventRow[]
  }

  async findEventById(id: string): Promise<ClassCalendarEventRow | null> {
    const { data } = await this.db
      .from('class_calendar_events')
      .select('id, class_id, teacher_id, title, description, event_date, created_at, updated_at')
      .eq('id', id)
      .maybeSingle()
    return (data as ClassCalendarEventRow) ?? null
  }

  async deleteEvent(id: string, teacherId: string): Promise<void> {
    const { error } = await this.db
      .from('class_calendar_events')
      .delete()
      .eq('id', id)
      .eq('teacher_id', teacherId)
    if (error) throw new Error('Failed to delete calendar event')
  }

  async createAnnouncement(input: {
    classId: string
    teacherId: string
    title: string
    body: string
  }): Promise<ClassAnnouncementRow> {
    const { data, error } = await this.db
      .from('class_announcements')
      .insert({ class_id: input.classId, teacher_id: input.teacherId, title: input.title, body: input.body })
      .select()
      .single()
    if (error || !data) throw new Error('Failed to create announcement')
    return data as ClassAnnouncementRow
  }

  async findAnnouncementsByClass(classId: string): Promise<ClassAnnouncementRow[]> {
    const { data, error } = await this.db
      .from('class_announcements')
      .select('id, class_id, teacher_id, title, body, created_at, updated_at')
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
    if (error) throw new Error('Failed to fetch announcements')
    return (data ?? []) as ClassAnnouncementRow[]
  }

  async findAnnouncementsByClassIds(classIds: string[]): Promise<ClassAnnouncementRow[]> {
    if (!classIds.length) return []
    const { data, error } = await this.db
      .from('class_announcements')
      .select('id, class_id, teacher_id, title, body, created_at, updated_at')
      .in('class_id', classIds)
      .order('created_at', { ascending: false })
    if (error) throw new Error('Failed to fetch announcements')
    return (data ?? []) as ClassAnnouncementRow[]
  }

  async findAnnouncementById(id: string): Promise<ClassAnnouncementRow | null> {
    const { data } = await this.db
      .from('class_announcements')
      .select('id, class_id, teacher_id, title, body, created_at, updated_at')
      .eq('id', id)
      .maybeSingle()
    return (data as ClassAnnouncementRow) ?? null
  }

  async deleteAnnouncement(id: string, teacherId: string): Promise<void> {
    const { error } = await this.db
      .from('class_announcements')
      .delete()
      .eq('id', id)
      .eq('teacher_id', teacherId)
    if (error) throw new Error('Failed to delete announcement')
  }
}
