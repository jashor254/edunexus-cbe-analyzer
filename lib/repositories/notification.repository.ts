// lib/repositories/notification.repository.ts
// Handles all DB operations for notification_log, whatsapp_inbound_log, and whatsapp_opt_ins.

import { BaseRepository } from './base'
import type { ReplyOutcome } from '@/lib/parentPulse/observationPipeline'

// ── Column constants ──────────────────────────────────────────────────────────

const NOTIFICATION_LOG_DEDUP_COLS = 'id' as const

const WHATSAPP_OPT_IN_COLS = 'student_id, students(parent_user_id)' as const

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationChannel = 'email' | 'whatsapp'

export type NotificationLogInsert = {
  user_id:             string | null
  type:                string
  reference_id:        string
  channel:             NotificationChannel
  phone_number?:       string
  email_address?:      string
  whatsapp_message_id?: string | null
  success:             boolean
  error_message?:      string | null
}

export type WhatsAppInboundLogInsert = {
  phone:         string
  raw_body:      string
  received_at:   string
  parsed_reply:  ReplyOutcome
  student_id?:   string | null
  parent_id?:    string | null
  processed:     boolean
  error_message?: string | null
}

export type WhatsAppOptInRow = {
  student_id: string
  students: { parent_user_id: string } | null
}

export class NotificationRepository extends BaseRepository {
  // ── Deduplication ───────────────────────────────────────────────────────────

  async isDuplicate(
    type:        string,
    referenceId: string,
    channel:     NotificationChannel,
  ): Promise<boolean> {
    const { data, error } = await this.db
      .from('notification_log')
      .select(NOTIFICATION_LOG_DEDUP_COLS)
      .eq('type', type)
      .eq('reference_id', referenceId)
      .eq('channel', channel)
      .eq('success', true)
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(`Failed to check notification duplicate: ${error.message}`)

    return data !== null
  }

  // ── Notification log ────────────────────────────────────────────────────────

  async insertNotificationLog(params: NotificationLogInsert): Promise<void> {
    const { error } = await this.db.from('notification_log').insert({
      user_id:             params.user_id,
      type:                params.type,
      reference_id:        params.reference_id,
      channel:             params.channel,
      phone_number:        params.phone_number       ?? null,
      email_address:       params.email_address      ?? null,
      whatsapp_message_id: params.whatsapp_message_id ?? null,
      success:             params.success,
      error_message:       params.error_message      ?? null,
    })

    if (error) throw new Error(`Failed to insert notification log: ${error.message}`)
  }

  // ── WhatsApp inbound log ────────────────────────────────────────────────────

  async insertWhatsAppInboundLog(params: WhatsAppInboundLogInsert): Promise<void> {
    const { error } = await this.db.from('whatsapp_inbound_log').insert({
      phone:         params.phone,
      raw_body:      params.raw_body,
      received_at:   params.received_at,
      parsed_reply:  params.parsed_reply,
      student_id:    params.student_id    ?? null,
      parent_id:     params.parent_id     ?? null,
      processed:     params.processed,
      error_message: params.error_message ?? null,
    })

    if (error) throw new Error(`Failed to insert WhatsApp inbound log: ${error.message}`)
  }

  // ── WhatsApp opt-ins ────────────────────────────────────────────────────────

  async getOptInByPhone(phone: string): Promise<WhatsAppOptInRow | null> {
    const { data, error } = await this.db
      .from('whatsapp_opt_ins')
      .select(WHATSAPP_OPT_IN_COLS)
      .eq('phone', phone)
      .eq('active', true)
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch WhatsApp opt-in: ${error.message}`)

    if (!data) return null

    return {
      student_id: data.student_id as string,
      students:   (data.students as unknown) as { parent_user_id: string } | null,
    }
  }

  async getAllActiveOptIns(limit = 500): Promise<Array<{
    student_id: string
    students: Record<string, unknown> | null
  }>> {
    const { data, error } = await this.db
      .from('whatsapp_opt_ins')
      .select('student_id, students(name, grade, parent_phone, parent_user_id)')
      .not('opted_in_at', 'is', null)
      .limit(limit)

    if (error) throw new Error(`Failed to fetch WhatsApp opt-ins: ${error.message}`)

    return (data ?? []).map(row => ({
      student_id: row.student_id as string,
      students:   (row.students as unknown) as Record<string, unknown> | null,
    }))
  }

  // ── Legacy notification tables (notify.ts) ────────────────────────────────────

  async findSubmissionById(id: string): Promise<{
    id: string; student_id: string; score: number | null; teacher_feedback: string | null; status: string
  } | null> {
    const { data } = await this.db
      .from('assignment_submissions')
      .select('id, student_id, score, teacher_feedback, status')
      .eq('id', id)
      .single()
    return data as typeof data ?? null
  }

  async findAssignmentById(id: string): Promise<{
    id: string; title: string; max_score: number; class_id: string; teacher_id: string
  } | null> {
    const { data } = await this.db
      .from('assignments')
      .select('id, title, max_score, class_id, teacher_id')
      .eq('id', id)
      .single()
    return data as typeof data ?? null
  }

  async findStudentNotificationData(id: string): Promise<{
    id: string; name: string; grade: number; curriculum_type: string; parent_email: string | null;
    notification_email: boolean | null; parent_phone: string | null; notification_whatsapp: boolean | null;
    whatsapp_opted_in: boolean | null; parent_first_name: string | null
  } | null> {
    const { data } = await this.db
      .from('students')
      .select('id, name, grade, curriculum_type, parent_email, notification_email, parent_phone, notification_whatsapp, whatsapp_opted_in, parent_first_name')
      .eq('id', id)
      .single()
    return data as typeof data ?? null
  }

  async findTeacherContact(id: string): Promise<{
    full_name: string | null; school: string | null; user_id: string | null
  } | null> {
    const { data } = await this.db
      .from('teachers')
      .select('full_name, school, user_id')
      .eq('id', id)
      .single()
    return data as typeof data ?? null
  }

  async findClassStudentParentId(
    studentId: string,
    classId:   string,
  ): Promise<{ parent_id: string } | null> {
    const { data } = await this.db
      .from('class_students')
      .select('parent_id')
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .maybeSingle()
    return data as typeof data ?? null
  }

  async findAnyClassStudentParentId(studentId: string): Promise<{ parent_id: string } | null> {
    const { data } = await this.db
      .from('class_students')
      .select('parent_id')
      .eq('student_id', studentId)
      .limit(1)
      .maybeSingle()
    return data as typeof data ?? null
  }

  async findStudentAlertById(id: string): Promise<{
    id: string; student_id: string; alert_type: string; message: string; teacher_id: string
  } | null> {
    const { data } = await this.db
      .from('student_alerts')
      .select('id, student_id, alert_type, message, teacher_id')
      .eq('id', id)
      .single()
    return data as typeof data ?? null
  }

  async insertStudentAlert(row: {
    student_id: string
    teacher_id: string
    alert_type: string
    message:    string
  }): Promise<void> {
    const { error } = await this.db
      .from('student_alerts')
      .insert({ ...row, is_resolved: false })
    if (error) throw new Error(`insertStudentAlert: ${error.message}`)
  }
}
