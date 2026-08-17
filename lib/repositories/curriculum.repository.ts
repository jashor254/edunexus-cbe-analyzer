// lib/repositories/curriculum.repository.ts
// All DB access for the curriculum domain: SOW, lesson plans, records of work.

import { BaseRepository } from './base'
import type { GeneratedLesson, TimelineSlot } from '@/lib/sow/types'
import type { RecordOfWork, ROWEntry } from '@/lib/row/pdfRenderer'
import type { FollowUp, ReflectionSource } from '@/lib/teachingIntelligence/types'

// ── Column constants ───────────────────────────────────────────────────────────

const SOW_COLS =
  'id, teacher_id, school, grade, learning_area, term, year, lessons, timeline, breaks, teacher_name, tsc_number'

const SOW_META_COLS =
  'teacher_id, school, grade, learning_area, term, year'

const LESSON_PLAN_COLS =
  'id, sow_id, teacher_id, week_number, lesson_number, strand, sub_strand, status, learning_outcomes, key_inquiry_questions, learning_resources, organisation_of_learning, introduction, step_1, step_2, step_3, conclusion, extended_activities, reflection, teacher_self_evaluation, teacher_flagged_followup, taught_date, created_at, updated_at'

const LESSON_PLAN_STATUS_COLS =
  'status, sow_id, strand, sub_strand'

const ROW_LESSON_COLS =
  'week_number, lesson_number, taught_date, strand, sub_strand, step_1, teacher_self_evaluation'

const HEALTH_COLS =
  'id, struggle_count, lessons_covered'

// ── SOW record shape ──────────────────────────────────────────────────────────

type SOWRecord = {
  id: string
  teacher_id: string
  school: string
  grade: string
  learning_area: string
  term: string
  year: number
  teacher_name: string | null
  tsc_number: string | null
  lessons: GeneratedLesson[]
  timeline: TimelineSlot[]
  breaks: Array<{ startWeek: number; endWeek: number; title: string }>
}

type SOWMeta = {
  teacher_id: string
  school: string
  grade: string
  learning_area: string
  term: string
  year: number
}

type LessonPlanRow = {
  id: string
  sow_id: string
  teacher_id: string
  week_number: number
  lesson_number: number
  strand: string
  sub_strand: string
  status: string
  learning_outcomes: string[]
  key_inquiry_questions: string[]
  learning_resources: string[]
  organisation_of_learning: string | null
  introduction: string | null
  step_1: string | null
  step_2: string | null
  step_3: string | null
  conclusion: string | null
  extended_activities: string | null
  reflection: string | null
  teacher_self_evaluation: string | null
  teacher_flagged_followup: string | null
  taught_date: string | null
  created_at: string
  updated_at: string
}

type HealthRow = {
  id: string
  struggle_count: number
  lessons_covered: number
}

export class CurriculumRepository extends BaseRepository {
  // ── Scheme of Work ───────────────────────────────────────────────────────────

  async findSOWWithTimeline(sowId: string): Promise<SOWRecord> {
    const { data, error } = await this.db
      .from('schemes_of_work')
      .select(SOW_COLS)
      .eq('id', sowId)
      .single()

    if (error || !data) throw new Error(`SOW not found: ${sowId}`)
    return data as SOWRecord
  }

  async findSOWMeta(sowId: string): Promise<SOWMeta> {
    const { data, error } = await this.db
      .from('schemes_of_work')
      .select(SOW_META_COLS)
      .eq('id', sowId)
      .single()

    if (error || !data) throw new Error(`SOW not found: ${sowId}`)
    return data as SOWMeta
  }

  // Used to decide whether this teacher's next SOW generation is their
  // genuinely-first (free trial) or a subsequent one (bundle-priced).
  async countByTeacher(teacherId: string): Promise<number> {
    const { count, error } = await this.db
      .from('schemes_of_work')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)

    if (error) throw new Error(`Failed to count SOWs for teacher: ${error.message}`)
    return count ?? 0
  }

  async findActiveSOW(
    teacherId: string,
    grade: number,
    subject: string,
  ): Promise<{ id: string } | null> {
    const { data } = await this.db
      .from('schemes_of_work')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('grade', grade)
      .eq('subject', subject)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return data ?? null
  }

  // ── Lesson Plans ─────────────────────────────────────────────────────────────

  async findLessonPlanStatus(
    planId: string,
    teacherId: string,
  ): Promise<{ status: string; sow_id: string; strand: string; sub_strand: string } | null> {
    const { data } = await this.db
      .from('lesson_plans')
      .select(LESSON_PLAN_STATUS_COLS)
      .eq('id', planId)
      .eq('teacher_id', teacherId)
      .single()

    return data ?? null
  }

  async updateLessonPlanEvaluation(
    planId: string,
    teacherId: string,
    evaluation: string,
    followUp: FollowUp,
    reflectionSource?: ReflectionSource,
  ): Promise<Record<string, unknown>> {
    const { data, error } = await this.db
      .from('lesson_plans')
      .update({
        teacher_self_evaluation:  evaluation,
        teacher_flagged_followup: followUp,
        ...(reflectionSource ? { reflection_source: reflectionSource } : {}),
      })
      .eq('id', planId)
      .eq('teacher_id', teacherId)
      .select()
      .single()

    if (error || !data) throw new Error(`Failed to save evaluation: ${error?.message ?? 'unknown'}`)
    return data as Record<string, unknown>
  }

  async insertLessonPlans(
    rows: Array<{
      sow_id: string
      teacher_id: string
      week_number: number
      lesson_number: number
      strand: string
      sub_strand: string
      sub_strand_id: string | null
      learning_outcomes: string[]
      key_inquiry_questions: string[]
      learning_resources: string[]
      organisation_of_learning: string | null
      introduction: string | null
      step_1: string | null
      step_2: string | null
      step_3: string | null
      conclusion: string | null
      extended_activities: string | null
      reflection: string | null
      status: string
    }>,
  ): Promise<void> {
    const { error } = await this.db.from('lesson_plans').insert(rows)
    if (error) throw new Error(`Failed to save lesson plans: ${error.message}`)
  }

  async findLessonPlansByWeek(
    sowId: string,
    weekNumber: number,
  ): Promise<Array<{
    week_number: number
    lesson_number: number
    taught_date: string | null
    strand: string
    sub_strand: string
    step_1: string | null
    teacher_self_evaluation: string | null
  }>> {
    const { data, error } = await this.db
      .from('lesson_plans')
      .select(ROW_LESSON_COLS)
      .eq('sow_id', sowId)
      .eq('week_number', weekNumber)
      .order('lesson_number', { ascending: true })

    if (error) throw new Error(`Failed to fetch lesson plans: ${error.message}`)
    if (!data?.length) throw new Error(`No lesson plans for SOW ${sowId} week ${weekNumber}`)

    return data
  }

  // ── Substrand Health ─────────────────────────────────────────────────────────

  async findSubstrandHealth(
    sowId: string,
    strand: string,
    subStrand: string,
  ): Promise<HealthRow | null> {
    const { data } = await this.db
      .from('substrand_health')
      .select(HEALTH_COLS)
      .eq('sow_id', sowId)
      .eq('strand', strand)
      .eq('sub_strand', subStrand)
      .maybeSingle()

    return (data as HealthRow | null) ?? null
  }

  async updateSubstrandHealth(
    id: string,
    updates: {
      lessons_covered: number
      struggle_count?: number
      last_flagged?: string
      updated_at: string
    },
  ): Promise<void> {
    await this.db.from('substrand_health').update(updates).eq('id', id)
  }

  async insertSubstrandHealth(row: {
    sow_id: string
    teacher_id: string
    strand: string
    sub_strand: string
    lessons_covered: number
    struggle_count: number
    last_flagged?: string
  }): Promise<void> {
    await this.db.from('substrand_health').insert(row)
  }

  async triggerComputeSubstrandHealth(params: {
    p_sow_id: string
    p_teacher_id: string
    p_class_id: string
    p_subject: string
    p_strand: string
    p_sub_strand: string
  }): Promise<void> {
    await this.db.rpc('compute_substrand_health', params)
  }

  // ── Teacher lookup ────────────────────────────────────────────────────────────

  async findTeacherName(teacherId: string): Promise<string | null> {
    const { data } = await this.db
      .from('teachers')
      .select('full_name')
      .eq('id', teacherId)
      .maybeSingle()
    return data?.full_name ?? null
  }

  // ── Weekly Intelligence ───────────────────────────────────────────────────────

  async findWeeklyIntelligenceNote(
    sowId: string,
    weekNumber: number,
  ): Promise<string | null> {
    const { data } = await this.db
      .from('weekly_intelligence')
      .select('teacher_note')
      .eq('sow_id', sowId)
      .eq('week_number', weekNumber)
      .maybeSingle()
    return data?.teacher_note ?? null
  }

  // ── Record of Work composite ──────────────────────────────────────────────────

  async buildRecordOfWork(sowId: string, weekNumber: number): Promise<RecordOfWork> {
    const [plans, sowMeta, teacherNote] = await Promise.all([
      this.findLessonPlansByWeek(sowId, weekNumber),
      this.findSOWMeta(sowId),
      this.findWeeklyIntelligenceNote(sowId, weekNumber),
    ])

    const teacher = await this.findTeacherName(sowMeta.teacher_id)
    const weekFallback = teacherNote ?? ''

    const toTitleCase = (s: string) =>
      s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())

    const firstSentence = (s: string | null) =>
      s ? s.split(/[.!?]/)[0] ?? '' : ''

    const entries: ROWEntry[] = plans.map(p => ({
      week_number:   p.week_number,
      lesson_number: p.lesson_number,
      date_taught:   p.taught_date,
      strand:        p.strand,
      sub_strand:    p.sub_strand,
      work_done:     firstSentence(p.step_1) || p.sub_strand,
      reflection:    p.teacher_self_evaluation ?? weekFallback,
    }))

    return {
      teacher_name:  toTitleCase(teacher ?? ''),
      school:        toTitleCase(sowMeta.school),
      grade:         sowMeta.grade,
      learning_area: sowMeta.learning_area,
      term:          sowMeta.term,
      year:          sowMeta.year,
      entries,
    }
  }

  // ── Topic selector — sow_grades/learning_areas/strands/substrands ────────────

  async findGradeIdsByGrade(grade: number): Promise<Array<{ id: string }>> {
    const { data, error } = await this.db
      .from('sow_grades')
      .select('id')
      .eq('numeric_grade', grade)
    if (error) throw new Error(`Failed to find grade ids: ${error.message}`)
    return (data ?? []) as Array<{ id: string }>
  }

  async findLearningAreasByGradeIds(
    gradeIds:  string[],
    subject:   string,
    exactName: boolean,
  ): Promise<Array<{ id: string; name: string }>> {
    let query = this.db
      .from('sow_learning_areas')
      .select('id, name')
      .in('grade_id', gradeIds)
      .order('name')
      .limit(5)

    query = exactName
      ? (query.ilike('name', subject) as typeof query)
      : (query.ilike('name', `%${subject}%`) as typeof query)

    const { data, error } = await query
    if (error) throw new Error(`Failed to find learning areas: ${error.message}`)
    return (data ?? []) as Array<{ id: string; name: string }>
  }

  async findStrandsByLearningAreaIds(
    laIds: string[],
  ): Promise<Array<{ id: string; title: string; learning_area_id: string; order_index: number }>> {
    const { data, error } = await this.db
      .from('sow_strands')
      .select('id, title, learning_area_id, order_index')
      .in('learning_area_id', laIds)
      .order('order_index')
    if (error) throw new Error(`Failed to find strands: ${error.message}`)
    return (data ?? []) as Array<{ id: string; title: string; learning_area_id: string; order_index: number }>
  }

  async findSubstrandsByStrandIds(
    strandIds: string[],
  ): Promise<Array<{ id: string; title: string; strand_id: string; order_index: number }>> {
    const { data, error } = await this.db
      .from('sow_substrands')
      .select('id, title, strand_id, order_index')
      .in('strand_id', strandIds)
      .order('order_index')
      .limit(200)
    if (error) throw new Error(`Failed to find substrands: ${error.message}`)
    return (data ?? []) as Array<{ id: string; title: string; strand_id: string; order_index: number }>
  }

  async findLearningAreaGradeIds(subject: string): Promise<Array<{ grade_id: string }>> {
    const { data, error } = await this.db
      .from('sow_learning_areas')
      .select('grade_id')
      .ilike('name', `%${subject}%`)
    if (error) throw new Error(`Failed to find learning area grade ids: ${error.message}`)
    return (data ?? []) as Array<{ grade_id: string }>
  }

  async findGradesByIds(gradeIds: string[]): Promise<Array<{ numeric_grade: number }>> {
    const { data, error } = await this.db
      .from('sow_grades')
      .select('numeric_grade')
      .in('id', gradeIds)
      .order('numeric_grade')
    if (error) throw new Error(`Failed to find grades: ${error.message}`)
    return (data ?? []) as Array<{ numeric_grade: number }>
  }

  /** Real, seeded Specific Learning Outcomes for a substrand — Curriculum Grounding Layer. */
  async findLearningOutcomesBySubstrandId(
    substrandId: string,
  ): Promise<Array<{ id: string; outcome: string; outcome_type: string | null }>> {
    const { data, error } = await this.db
      .from('sow_learning_outcomes')
      .select('id, outcome, outcome_type')
      .eq('substrand_id', substrandId)
      .order('order_index')
    if (error) throw new Error(`Failed to find learning outcomes: ${error.message}`)
    return (data ?? []) as Array<{ id: string; outcome: string; outcome_type: string | null }>
  }

  async findSubstrandById(
    substrandId: string,
  ): Promise<{ id: string; title: string; strand_id: string } | null> {
    const { data, error } = await this.db
      .from('sow_substrands')
      .select('id, title, strand_id')
      .eq('id', substrandId)
      .maybeSingle()
    if (error) throw new Error(`Failed to find substrand: ${error.message}`)
    return data as { id: string; title: string; strand_id: string } | null
  }

  async findSubstrandsByTitle(
    searchTerm: string,
  ): Promise<Array<{ id: string; title: string; strand_id: string }>> {
    const { data, error } = await this.db
      .from('sow_substrands')
      .select('id, title, strand_id')
      .ilike('title', `%${searchTerm}%`)
      .limit(5)
    if (error) throw new Error(`Failed to find substrands by title: ${error.message}`)
    return (data ?? []) as Array<{ id: string; title: string; strand_id: string }>
  }

  async findStrandsByIds(
    strandIds: string[],
  ): Promise<Array<{ id: string; learning_area_id: string; title: string }>> {
    const { data, error } = await this.db
      .from('sow_strands')
      .select('id, learning_area_id, title')
      .in('id', strandIds)
    if (error) throw new Error(`Failed to find strands by ids: ${error.message}`)
    return (data ?? []) as Array<{ id: string; learning_area_id: string; title: string }>
  }

  // ── SOW generator tree lookups (grades/learning-areas/strands/kicd-context routes) ──

  async findPrimaryLevelId(curriculumType: string): Promise<{ id: string } | null> {
    const { data, error } = await this.db
      .from('sow_levels')
      .select('id')
      .eq('curriculum_type', curriculumType)
      .order('order_index')
      .limit(1)
    if (error) throw new Error(`Failed to find primary level: ${error.message}`)
    return data?.[0] ?? null
  }

  async findActiveGradesByLevelId(
    levelId: string,
  ): Promise<Array<{ id: string; level_id: string; name: string; numeric_grade: number; order_index: number }>> {
    const { data, error } = await this.db
      .from('sow_grades')
      .select('id, level_id, name, numeric_grade, order_index')
      .eq('level_id', levelId)
      .eq('is_active', true)
      .order('numeric_grade')
    if (error) throw new Error(`Failed to find active grades: ${error.message}`)
    return (data ?? []) as Array<{ id: string; level_id: string; name: string; numeric_grade: number; order_index: number }>
  }

  async findActiveGradeByNamePrefix(
    levelId: string,
    gradePrefix: string,
  ): Promise<{ id: string } | null> {
    const { data, error } = await this.db
      .from('sow_grades')
      .select('id')
      .eq('level_id', levelId)
      .eq('is_active', true)
      .ilike('name', `${gradePrefix}%`)
      .order('order_index')
      .limit(1)
    if (error) throw new Error(`Failed to find grade by name prefix: ${error.message}`)
    return data?.[0] ?? null
  }

  async findLearningAreasByGradeId(
    gradeId: string,
  ): Promise<Array<{ id: string; name: string }>> {
    const { data, error } = await this.db
      .from('sow_learning_areas')
      .select('id, name')
      .eq('grade_id', gradeId)
      .order('order_index')
    if (error) throw new Error(`Failed to find learning areas for grade: ${error.message}`)
    return (data ?? []) as Array<{ id: string; name: string }>
  }

  async findStrandsForGeneration(
    learningAreaId: string,
  ): Promise<Array<{ id: string; title: string; order_index: number }>> {
    const { data, error } = await this.db
      .from('sow_strands')
      .select('id, title, order_index')
      .eq('learning_area_id', learningAreaId)
      .order('order_index')
      .limit(500)
    if (error) throw new Error(`Failed to find strands for generation: ${error.message}`)
    return (data ?? []) as Array<{ id: string; title: string; order_index: number }>
  }

  /** Paginated substrand fetch (avoids PostgREST's 1000-row cap) — for SOW generation, which needs every substrand. */
  async findAllSubstrandsByStrandIds(
    strandIds: string[],
  ): Promise<Array<{ id: string; strand_id: string; title: string; suggested_lessons: number; order_index: number }>> {
    const PAGE = 1000
    let from = 0
    const all: Array<{ id: string; strand_id: string; title: string; suggested_lessons: number; order_index: number }> = []

    while (true) {
      const { data, error } = await this.db
        .from('sow_substrands')
        .select('id, strand_id, title, suggested_lessons, order_index')
        .in('strand_id', strandIds)
        .order('order_index')
        .range(from, from + PAGE - 1)

      if (error) throw new Error(`Failed to find substrands: ${error.message}`)
      if (data) all.push(...data)
      if (!data || data.length < PAGE) break
      from += PAGE
    }

    return all
  }

  async findKicdContextBySubjectName(subject: string): Promise<{
    area: { kicd_subject_data: Record<string, unknown> | null } | null
    strands: Array<{ title: string; kicd_data: Record<string, unknown> | null }>
  }> {
    const [{ data: area }, { data: strands }] = await Promise.all([
      this.db
        .from('sow_learning_areas')
        .select('kicd_subject_data')
        .ilike('name', `%${subject}%`)
        .limit(1)
        .maybeSingle(),
      this.db
        .from('sow_strands')
        .select('title, kicd_data')
        .ilike('title', `%${subject}%`),
    ])

    return {
      area: (area ?? null) as { kicd_subject_data: Record<string, unknown> | null } | null,
      strands: (strands ?? []) as Array<{ title: string; kicd_data: Record<string, unknown> | null }>,
    }
  }

  // ── Search ────────────────────────────────────────────────────────────────────

  async searchSOWsByQuery(
    q:         string,
    teacherId: string,
  ): Promise<Array<{ id: string; title: string; subject: string; grade: number; term: number; year: number; status: string }>> {
    const { data } = await this.db
      .from('schemes_of_work')
      .select('id, title, subject, grade, term, year, status')
      .eq('teacher_id', teacherId)
      .or(`title.ilike.%${q}%,subject.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(10)
    return (data ?? []) as Array<{ id: string; title: string; subject: string; grade: number; term: number; year: number; status: string }>
  }

  async searchLessonPlansByQuery(
    q:         string,
    teacherId: string,
  ): Promise<Array<{ id: string; title: string; subject: string; grade: number; strand: string; sub_strand: string }>> {
    const { data } = await this.db
      .from('lesson_plans')
      .select('id, title, subject, grade, strand, sub_strand')
      .eq('teacher_id', teacherId)
      .or(`title.ilike.%${q}%,strand.ilike.%${q}%,sub_strand.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(10)
    return (data ?? []) as Array<{ id: string; title: string; subject: string; grade: number; strand: string; sub_strand: string }>
  }
}

export const curriculumRepository = new CurriculumRepository()
