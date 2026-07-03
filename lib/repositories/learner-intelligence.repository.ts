// lib/repositories/learner-intelligence.repository.ts
// Handles all DB operations for remedial plans, weekly intelligence,
// formative signals, holiday plans, and parent pulse data.

import { BaseRepository } from './base'
import type { RemedialGroup, TeacherAllocation } from '@/lib/remedial/types'
import type { HolidayPlanData } from '@/lib/holiday/types'
import type { WeeklyIntelligenceData, EvaluatedPlan, SubstrandHealthRow } from '@/lib/teachingIntelligence/types'

// ── Column constants ──────────────────────────────────────────────────────────

const SUBSTRAND_HEALTH_COLS =
  'id, sow_id, teacher_id, strand, sub_strand, struggle_count, lessons_covered, assessment_level, remediated, root_cause, risk_score, last_flagged, resolved_at' as const

const LESSON_PLAN_EVAL_COLS =
  'id, week_number, lesson_number, strand, sub_strand, taught_date, updated_at, teacher_flagged_followup, reflection_source, teacher_self_evaluation' as const

const ROW_RECORD_COLS = 'id' as const

const REMEDIAL_PLAN_SAVE_COLS = 'id' as const

const FORMATIVE_SIGNAL_COLS = 'subject, sub_strand, got_it_ids, confused_ids, lost_ids' as const

const FORMATIVE_CONCERN_COLS = 'subject, sub_strand' as const

const COMPASS_PULSE_COLS = 'topic, subject, status' as const

const STUDENT_HOLIDAY_COLS = 'first_name, last_name, grade, dream_career' as const

const CLASS_ENROLLMENT_COLS = 'student_id' as const

// ── Types ─────────────────────────────────────────────────────────────────────

export type RemedialPlanUpsertPayload = {
  sow_id:       string
  teacher_id:   string
  class_id:     string | null
  term:         number
  year:         number
  week_start:   number
  week_end:     number
  subject:      string
  strand:       string
  sub_strand:   string
  groups:       RemedialGroup[]
  allocation:   TeacherAllocation
  check_in_week: number
}

export type FormativeSignalRow = {
  subject:      string
  sub_strand:   string
  got_it_ids:   string[]
  confused_ids: string[]
  lost_ids:     string[]
}

export type FormativeConcernRow = {
  subject:    string
  sub_strand: string
}

export type CompassPulseRow = {
  topic:   string | null
  subject: string
  status:  string
}

export type StudentHolidayRow = {
  first_name:   string | null
  last_name:    string | null
  grade:        number | null
  dream_career: string | null
}

export type RowRecord = {
  id: string
}

export class LearnerIntelligenceRepository extends BaseRepository {
  // ── Remedial plans ──────────────────────────────────────────────────────────

  async upsertRemedialPlan(payload: RemedialPlanUpsertPayload): Promise<string | null> {
    const { data, error } = await this.db
      .from('remedial_plans')
      .upsert({
        sow_id:        payload.sow_id,
        teacher_id:    payload.teacher_id,
        class_id:      payload.class_id,
        term:          payload.term,
        year:          payload.year,
        week_start:    payload.week_start,
        week_end:      payload.week_end,
        subject:       payload.subject,
        strand:        payload.strand,
        sub_strand:    payload.sub_strand,
        groups:        payload.groups,
        allocation:    payload.allocation,
        check_in_week: payload.check_in_week,
      }, { onConflict: 'sow_id,teacher_id,sub_strand,term,year' })
      .select(REMEDIAL_PLAN_SAVE_COLS)
      .single()

    if (error) throw new Error(`Failed to upsert remedial plan: ${error.message}`)

    return (data?.id as string | null) ?? null
  }

  // ── Substrand health ────────────────────────────────────────────────────────

  async getSubstrandHealth(
    sowId:      string,
    strand?:    string,
    subStrand?: string,
  ): Promise<SubstrandHealthRow[]> {
    let query = this.db
      .from('substrand_health')
      .select(SUBSTRAND_HEALTH_COLS)
      .eq('sow_id', sowId)

    if (strand)    query = query.eq('strand', strand)
    if (subStrand) query = query.eq('sub_strand', subStrand)

    const { data, error } = await query

    if (error) throw new Error(`Failed to fetch substrand health: ${error.message}`)

    return (data ?? []) as SubstrandHealthRow[]
  }

  async getSubstrandHealthSingle(
    sowId:     string,
    strand:    string,
    subStrand: string,
  ): Promise<Pick<SubstrandHealthRow, 'struggle_count' | 'assessment_level' | 'root_cause' | 'risk_score' | 'lessons_covered'> | null> {
    const { data, error } = await this.db
      .from('substrand_health')
      .select('struggle_count, assessment_level, root_cause, risk_score, lessons_covered')
      .eq('sow_id', sowId)
      .eq('strand', strand)
      .eq('sub_strand', subStrand)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch substrand health: ${error.message}`)
    if (!data) return null

    return {
      struggle_count:    data.struggle_count    as number,
      assessment_level:  data.assessment_level  as number | null,
      root_cause:        data.root_cause        as string | null,
      risk_score:        data.risk_score        as number | null,
      lessons_covered:   data.lessons_covered   as number,
    }
  }

  // ── Lesson plan evaluations ─────────────────────────────────────────────────

  async getEvaluatedPlansForSOW(
    sowId:        string,
    since?:       string,
    overrideWeek?: number,
  ): Promise<EvaluatedPlan[]> {
    let query = this.db
      .from('lesson_plans')
      .select(LESSON_PLAN_EVAL_COLS)
      .eq('sow_id', sowId)
      .not('teacher_flagged_followup', 'is', null)

    if (overrideWeek !== undefined) {
      query = query.eq('week_number', overrideWeek) as typeof query
    } else if (since) {
      query = query.gte('updated_at', since) as typeof query
    }

    query = query.order('week_number').order('lesson_number') as typeof query

    const { data, error } = await query

    if (error) throw new Error(`Failed to fetch evaluated plans: ${error.message}`)

    return (data ?? []) as EvaluatedPlan[]
  }

  // ── Weekly intelligence ─────────────────────────────────────────────────────

  async upsertWeeklyIntelligence(payload: WeeklyIntelligenceData): Promise<void> {
    const { error } = await this.db
      .from('weekly_intelligence')
      .upsert(payload, { onConflict: 'sow_id,week_number' })

    if (error) throw new Error(`Failed to upsert weekly intelligence: ${error.message}`)
  }

  // ── Record of work entries ──────────────────────────────────────────────────

  async getRowRecordForSOW(sowId: string): Promise<RowRecord | null> {
    const { data, error } = await this.db
      .from('records_of_work')
      .select(ROW_RECORD_COLS)
      .eq('scheme_id', sowId)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch ROW record: ${error.message}`)

    return data ? { id: data.id as string } : null
  }

  async updateRowEntryReflection(
    rowId:      string,
    weekNumber: number,
    substrand:  string,
    reflection: string,
  ): Promise<void> {
    const { error } = await this.db
      .from('row_entries')
      .update({ reflection })
      .eq('row_id', rowId)
      .eq('week', weekNumber)
      .eq('substrand', substrand)

    if (error) throw new Error(`Failed to update row entry reflection: ${error.message}`)
  }

  // ── Formative signals ───────────────────────────────────────────────────────

  async getFormativeSignalsForStudent(
    studentId: string,
    since:     string,
    limit = 5,
  ): Promise<FormativeSignalRow[]> {
    const { data, error } = await this.db
      .from('formative_signals')
      .select(FORMATIVE_SIGNAL_COLS)
      .contains('got_it_ids', [studentId])
      .gte('recorded_at', since)
      .limit(limit)

    if (error) throw new Error(`Failed to fetch formative signals: ${error.message}`)

    return (data ?? []).map(row => ({
      subject:      row.subject      as string,
      sub_strand:   row.sub_strand   as string,
      got_it_ids:   row.got_it_ids   as string[],
      confused_ids: row.confused_ids as string[],
      lost_ids:     row.lost_ids     as string[],
    }))
  }

  async getFormativeConcernsForStudent(
    studentId: string,
    since:     string,
    limit = 3,
  ): Promise<FormativeConcernRow[]> {
    const { data, error } = await this.db
      .from('formative_signals')
      .select(FORMATIVE_CONCERN_COLS)
      .contains('lost_ids', [studentId])
      .gte('recorded_at', since)
      .limit(limit)

    if (error) throw new Error(`Failed to fetch formative concerns: ${error.message}`)

    return (data ?? []).map(row => ({
      subject:    row.subject    as string,
      sub_strand: row.sub_strand as string,
    }))
  }

  // ── Compass sessions (parent pulse) ────────────────────────────────────────

  async getRecentCompletedSessions(
    studentId: string,
    limit = 3,
  ): Promise<CompassPulseRow[]> {
    const { data, error } = await this.db
      .from('compass_sessions')
      .select(COMPASS_PULSE_COLS)
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(`Failed to fetch compass sessions: ${error.message}`)

    return (data ?? []).map(row => ({
      topic:   row.topic   as string | null,
      subject: row.subject as string,
      status:  row.status  as string,
    }))
  }

  // ── Holiday plans ───────────────────────────────────────────────────────────

  async upsertHolidayPlan(params: {
    student_id:    string
    teacher_id:    string
    school_id:     string | null
    term:          number
    year:          number
    holiday_period: string
    holiday_days:  number
    plan_data:     HolidayPlanData
  }): Promise<void> {
    const { error } = await this.db.from('holiday_plans').upsert(
      {
        student_id:     params.student_id,
        teacher_id:     params.teacher_id,
        school_id:      params.school_id,
        term:           params.term,
        year:           params.year,
        holiday_period: params.holiday_period,
        holiday_days:   params.holiday_days,
        plan_data:      params.plan_data,
      },
      { onConflict: 'student_id,term,year' },
    )

    if (error) throw new Error(`Failed to upsert holiday plan: ${error.message}`)
  }

  // ── Student data (holiday planner) ─────────────────────────────────────────

  async getStudentHolidayData(studentId: string): Promise<StudentHolidayRow | null> {
    const { data, error } = await this.db
      .from('students')
      .select(STUDENT_HOLIDAY_COLS)
      .eq('id', studentId)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch student data: ${error.message}`)
    if (!data) return null

    return {
      first_name:   data.first_name   as string | null,
      last_name:    data.last_name    as string | null,
      grade:        data.grade        as number | null,
      dream_career: data.dream_career as string | null,
    }
  }

  async getStudentNameById(studentId: string): Promise<{ first_name: string | null; last_name: string | null } | null> {
    const { data, error } = await this.db
      .from('students')
      .select('first_name, last_name')
      .eq('id', studentId)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch student name: ${error.message}`)
    if (!data) return null

    return {
      first_name: data.first_name as string | null,
      last_name:  data.last_name  as string | null,
    }
  }

  // ── Class enrollment ────────────────────────────────────────────────────────

  async getClassEnrollment(classId: string): Promise<string[]> {
    const { data, error } = await this.db
      .from('class_students')
      .select(CLASS_ENROLLMENT_COLS)
      .eq('class_id', classId)

    if (error) throw new Error(`Failed to fetch class enrollment: ${error.message}`)

    return (data ?? []).map(row => row.student_id as string)
  }

  // ── Career lookup ───────────────────────────────────────────────────────────

  async getCareerBySlug(slug: string): Promise<{
    title: string
    required_subjects: string[] | null
  } | null> {
    const { data, error } = await this.db
      .from('careers')
      .select('title, required_subjects')
      .eq('slug', slug)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch career: ${error.message}`)
    if (!data) return null

    return {
      title:             data.title             as string,
      required_subjects: data.required_subjects as string[] | null,
    }
  }

  async getCareerTitleBySlug(slug: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('careers')
      .select('title')
      .eq('slug', slug)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch career title: ${error.message}`)

    return (data?.title as string | null) ?? null
  }

  // ── Learner profiles (parent pulse) ────────────────────────────────────────

  async getLearnerProfileForPulse(studentId: string): Promise<{
    parent_observations: Array<{ substrand: string; week_of: string }>
    confirmed_gaps:      string[]
  } | null> {
    const { data, error } = await this.db
      .from('learner_profiles')
      .select('parent_observations, confirmed_gaps')
      .eq('student_id', studentId)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch learner profile: ${error.message}`)
    if (!data) return null

    return {
      parent_observations: (data.parent_observations ?? []) as Array<{ substrand: string; week_of: string }>,
      confirmed_gaps:      (data.confirmed_gaps ?? []) as string[],
    }
  }

  // ── Parent profile lookup ───────────────────────────────────────────────────

  async getParentFullName(parentUserId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('profiles')
      .select('full_name')
      .eq('id', parentUserId)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch parent profile: ${error.message}`)

    return (data?.full_name as string | null) ?? null
  }

  async findWeeklyIntelligenceForTeacher(
    teacherId: string,
    sowId:     string | undefined,
    limit:     number,
  ): Promise<Array<{ sow_id: string; remedial_bank_items: SubstrandHealthRow[] }>> {
    let query = this.db
      .from('weekly_intelligence')
      .select('sow_id, remedial_bank_items')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (sowId) {
      query = query.eq('sow_id', sowId) as typeof query
    }

    const { data, error } = await query

    if (error) throw new Error(`Failed to fetch weekly intelligence: ${error.message}`)

    return (data ?? []).map(row => ({
      sow_id:             row.sow_id as string,
      remedial_bank_items: (row.remedial_bank_items as SubstrandHealthRow[]) ?? [],
    }))
  }
}
