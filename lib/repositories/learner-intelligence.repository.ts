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

// students has a single `name` column (no first_name/last_name split) and no
// dream_career column at all — both were referenced incorrectly before this fix.
const STUDENT_HOLIDAY_COLS = 'name, grade' as const

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
  name:  string | null
  grade: number | null
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
        // Regenerating replaces the content, so it goes back to draft —
        // whatever was previously approved no longer reflects what's saved.
        is_published:   false,
        published_at:   null,
      },
      { onConflict: 'student_id,term,year' },
    )

    if (error) throw new Error(`Failed to upsert holiday plan: ${error.message}`)
  }

  /**
   * All generated holiday plans for a set of students in one term/year —
   * used to render the Holiday Planner tab's results once a background
   * batch (see app/api/holiday/generate/route.ts) has written them, since
   * the batch job's own progress record only carries counts, not full plan
   * content (WhatsApp message, weeks) for every student.
   */
  async findHolidayPlansForStudents(
    studentIds: string[],
    term:       number,
    year:       number,
  ): Promise<Array<{ student_id: string; plan_data: HolidayPlanData; is_published: boolean }>> {
    if (studentIds.length === 0) return []
    const { data, error } = await this.db
      .from('holiday_plans')
      .select('student_id, plan_data, is_published')
      .in('student_id', studentIds)
      .eq('term', term)
      .eq('year', year)

    if (error) throw new Error(`Failed to fetch holiday plans: ${error.message}`)
    return (data ?? []) as Array<{ student_id: string; plan_data: HolidayPlanData; is_published: boolean }>
  }

  async publishHolidayPlans(params: {
    teacherId: string
    term:      number
    year:      number
    studentIds: string[]
  }): Promise<number> {
    if (params.studentIds.length === 0) return 0

    const { data, error } = await this.db
      .from('holiday_plans')
      .update({ is_published: true, published_at: new Date().toISOString() })
      .eq('teacher_id', params.teacherId)
      .eq('term', params.term)
      .eq('year', params.year)
      .in('student_id', params.studentIds)
      .select('id')

    if (error) throw new Error(`Failed to publish holiday plans: ${error.message}`)
    return data?.length ?? 0
  }

  // Only a recently-published plan is still relevant guidance — an old
  // holiday's plan shouldn't nag a parent forever once that break is over.
  async findPublishedHolidayPlan(studentId: string, publishedSinceIso: string): Promise<HolidayPlanData & { published_at: string } | null> {
    const { data, error } = await this.db
      .from('holiday_plans')
      .select('plan_data, published_at')
      .eq('student_id', studentId)
      .eq('is_published', true)
      .gte('published_at', publishedSinceIso)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch published holiday plan: ${error.message}`)
    if (!data) return null

    return { ...(data.plan_data as HolidayPlanData), published_at: data.published_at as string }
  }

  async findDraftHolidayPlansOlderThan(cutoff: string): Promise<Array<{ id: string; teacher_id: string | null; student_id: string; term: number; year: number }>> {
    const { data, error } = await this.db
      .from('holiday_plans')
      .select('id, teacher_id, student_id, term, year')
      .eq('is_published', false)
      .lt('created_at', cutoff)

    if (error) throw new Error(`Failed to fetch stale draft holiday plans: ${error.message}`)
    return data ?? []
  }

  async publishHolidayPlanIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const { error } = await this.db
      .from('holiday_plans')
      .update({ is_published: true, published_at: new Date().toISOString() })
      .in('id', ids)

    if (error) throw new Error(`Failed to auto-publish holiday plans: ${error.message}`)
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
      name:  data.name  as string | null,
      grade: data.grade as number | null,
    }
  }

  async getStudentNameById(studentId: string): Promise<{ name: string | null } | null> {
    const { data, error } = await this.db
      .from('students')
      .select('name')
      .eq('id', studentId)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch student name: ${error.message}`)
    if (!data) return null

    return { name: data.name as string | null }
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

  /** Batch name lookup — avoids the N+1 pattern of calling getStudentNameById in a loop. */
  async getStudentNamesByIds(studentIds: string[]): Promise<Array<{ id: string; name: string | null }>> {
    if (studentIds.length === 0) return []
    const { data, error } = await this.db
      .from('students')
      .select('id, name')
      .in('id', studentIds)

    if (error) throw new Error(`Failed to fetch student names: ${error.message}`)
    return (data ?? []).map(row => ({ id: row.id as string, name: row.name as string | null }))
  }

  // ── Class differentiation plans ─────────────────────────────────────────────
  // Adaptive Learning v2 Architecture §3/§9/§10 (FROZEN). Stored separately
  // from remedial_plans — see 20260708_class_differentiation_plans.sql for why.

  async upsertClassDifferentiationPlan(params: {
    class_id:   string
    teacher_id: string
    subject:    string
    term:       number
    year:       number
    plan_data:  unknown
  }): Promise<string> {
    const { data, error } = await this.db
      .from('class_differentiation_plans')
      .upsert(
        {
          class_id:   params.class_id,
          teacher_id: params.teacher_id,
          subject:    params.subject,
          term:       params.term,
          year:       params.year,
          plan_data:  params.plan_data,
          // Regenerating/re-saving replaces the content, so it goes back to
          // draft — same rule as upsertHolidayPlan: whatever was previously
          // approved no longer reflects what's saved.
          is_published: false,
          published_at: null,
        },
        { onConflict: 'class_id,subject,term,year' },
      )
      .select('id')
      .single()

    if (error) throw new Error(`Failed to upsert class differentiation plan: ${error.message}`)
    return data.id as string
  }

  async getClassDifferentiationPlan(params: {
    class_id: string
    subject:  string
    term:     number
    year:     number
  }): Promise<{ id: string; plan_data: unknown; is_published: boolean; published_at: string | null } | null> {
    const { data, error } = await this.db
      .from('class_differentiation_plans')
      .select('id, plan_data, is_published, published_at')
      .eq('class_id', params.class_id)
      .eq('subject', params.subject)
      .eq('term', params.term)
      .eq('year', params.year)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch class differentiation plan: ${error.message}`)
    if (!data) return null
    return {
      id: data.id as string,
      plan_data: data.plan_data,
      is_published: data.is_published as boolean,
      published_at: data.published_at as string | null,
    }
  }

  /** Ownership enforced by filtering on teacher_id — returns 0 if the plan doesn't belong to this teacher. */
  async publishClassDifferentiationPlan(params: {
    class_id:   string
    teacher_id: string
    subject:    string
    term:       number
    year:       number
    plan_data?: unknown
  }): Promise<number> {
    const update: Record<string, unknown> = { is_published: true, published_at: new Date().toISOString() }
    if (params.plan_data !== undefined) update.plan_data = params.plan_data

    const { data, error } = await this.db
      .from('class_differentiation_plans')
      .update(update)
      .eq('class_id', params.class_id)
      .eq('teacher_id', params.teacher_id)
      .eq('subject', params.subject)
      .eq('term', params.term)
      .eq('year', params.year)
      .select('id')

    if (error) throw new Error(`Failed to publish class differentiation plan: ${error.message}`)
    return (data ?? []).length
  }

  // ── Holiday returns ──────────────────────────────────────────────────────────
  // Adaptive Learning v2 Architecture §4/§7/§10 (FROZEN). Operational
  // tracking row for a returned holiday pack — separate from the Evidence
  // itself (lib/holiday/return.ts persists that via evidenceLifecycle.ts).

  async upsertHolidayReturn(params: {
    student_id:       string
    teacher_id:       string
    ingestion_run_id: string | null
    term:             number
    year:             number
    weeks_assigned:   number
    weeks_completed:  number
    teacher_comment:  string | null
  }): Promise<string> {
    const { data, error } = await this.db
      .from('holiday_returns')
      .upsert(
        {
          student_id:       params.student_id,
          teacher_id:       params.teacher_id,
          ingestion_run_id: params.ingestion_run_id,
          term:             params.term,
          year:             params.year,
          weeks_assigned:   params.weeks_assigned,
          weeks_completed:  params.weeks_completed,
          teacher_comment:  params.teacher_comment,
        },
        { onConflict: 'student_id,term,year' },
      )
      .select('id')
      .single()

    if (error) throw new Error(`Failed to upsert holiday return: ${error.message}`)
    return data.id as string
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
