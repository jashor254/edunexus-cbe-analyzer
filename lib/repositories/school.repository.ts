import { BaseRepository } from './base'
import type { School, SchoolSettings, AcademicYear, Term, SchoolReportCard, ReportCardWithSubjects, CbcLevel } from '@/types/core'
import type {
  SchoolIntelligenceSummary,
  StrandHealthRecord,
  GradeHealthRecord,
  InterventionEfficacyRecord,
  TeacherActivitySignal,
} from '@/lib/school/types'

const SCHOOL_COLS =
  'id, school_name, nemis_code, school_type, county, sub_county, ward, address, contact_phone, contact_email, logo_url, motto, subscription_tier, is_active, created_at, updated_at'

const SETTINGS_COLS =
  'id, school_id, curriculum_type, cbc_levels, grade_boundaries, school_open_days, report_footer, intelligence_enabled, intelligence_enabled_at, sms_enabled, timezone, created_at, updated_at'

const ACADEMIC_YEAR_COLS =
  'id, school_id, name, start_date, end_date, is_current, created_at, updated_at'

const TERM_COLS =
  'id, school_id, academic_year_id, term_number, name, start_date, end_date, is_current, created_at, updated_at'

const REPORT_COLS =
  'id, school_id, learner_id, term_id, class_id, overall_score, overall_cbc_level, position_in_class, total_learners, days_present, days_absent, class_teacher_comment, headteacher_comment, pdf_url, is_published, published_at, generated_at, created_at, updated_at'

export class SchoolRepository extends BaseRepository {
  // ── Schools ────────────────────────────────────────────────────────────────

  async findById(schoolId: string): Promise<School> {
    const { data, error } = await this.db
      .from('schools')
      .select(SCHOOL_COLS)
      .eq('id', schoolId)
      .single()
    if (error) throw new Error(`getSchool: ${error.message}`)
    return data
  }

  async update(
    schoolId: string,
    updates: Partial<Pick<School, 'school_name' | 'nemis_code' | 'school_type' | 'county' | 'sub_county' | 'ward' | 'address' | 'contact_phone' | 'contact_email' | 'logo_url' | 'motto'>>
  ): Promise<School> {
    const { data, error } = await this.db
      .from('schools')
      .update(updates)
      .eq('id', schoolId)
      .select(SCHOOL_COLS)
      .single()
    if (error) throw new Error(`updateSchool: ${error.message}`)
    return data
  }

  // ── School Settings ────────────────────────────────────────────────────────

  async findSettings(schoolId: string): Promise<SchoolSettings> {
    const { data, error } = await this.db
      .from('school_settings')
      .select(SETTINGS_COLS)
      .eq('school_id', schoolId)
      .single()
    if (error) throw new Error(`getSchoolSettings: ${error.message}`)
    return data
  }

  async upsertSettings(
    schoolId: string,
    settings: Partial<Omit<SchoolSettings, 'id' | 'school_id' | 'created_at' | 'updated_at'>>
  ): Promise<SchoolSettings> {
    const { data, error } = await this.db
      .from('school_settings')
      .upsert({ school_id: schoolId, ...settings }, { onConflict: 'school_id' })
      .select(SETTINGS_COLS)
      .single()
    if (error) throw new Error(`upsertSchoolSettings: ${error.message}`)
    return data
  }

  async enableIntelligence(schoolId: string): Promise<void> {
    const { error } = await this.db
      .from('school_settings')
      .update({ intelligence_enabled: true, intelligence_enabled_at: new Date().toISOString() })
      .eq('school_id', schoolId)
    if (error) throw new Error(`enableIntelligence: ${error.message}`)
  }

  // ── Academic Years ─────────────────────────────────────────────────────────

  async listAcademicYears(schoolId: string): Promise<AcademicYear[]> {
    const { data, error } = await this.db
      .from('academic_years')
      .select(ACADEMIC_YEAR_COLS)
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false })
    if (error) throw new Error(`listAcademicYears: ${error.message}`)
    return data
  }

  async insertAcademicYear(
    schoolId: string,
    input: Pick<AcademicYear, 'name' | 'start_date' | 'end_date'>
  ): Promise<AcademicYear> {
    const { data, error } = await this.db
      .from('academic_years')
      .insert({ school_id: schoolId, ...input })
      .select(ACADEMIC_YEAR_COLS)
      .single()
    if (error) throw new Error(`createAcademicYear: ${error.message}`)
    return data
  }

  async clearCurrentAcademicYear(schoolId: string): Promise<void> {
    await this.db
      .from('academic_years')
      .update({ is_current: false })
      .eq('school_id', schoolId)
  }

  async setCurrentAcademicYear(schoolId: string, yearId: string): Promise<void> {
    const { error } = await this.db
      .from('academic_years')
      .update({ is_current: true })
      .eq('id', yearId)
      .eq('school_id', schoolId)
    if (error) throw new Error(`setCurrentAcademicYear: ${error.message}`)
  }

  async findCurrentAcademicYear(schoolId: string): Promise<AcademicYear | null> {
    const { data } = await this.db
      .from('academic_years')
      .select(ACADEMIC_YEAR_COLS)
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .single()
    return data
  }

  // ── Terms ──────────────────────────────────────────────────────────────────

  async listTerms(schoolId: string, academicYearId?: string): Promise<Term[]> {
    let query = this.db
      .from('terms')
      .select(TERM_COLS)
      .eq('school_id', schoolId)
      .order('term_number')
    if (academicYearId) query = query.eq('academic_year_id', academicYearId)
    const { data, error } = await query
    if (error) throw new Error(`listTerms: ${error.message}`)
    return data
  }

  async insertTerm(
    schoolId: string,
    input: Pick<Term, 'academic_year_id' | 'term_number' | 'name' | 'start_date' | 'end_date'>
  ): Promise<Term> {
    const { data, error } = await this.db
      .from('terms')
      .insert({ school_id: schoolId, ...input })
      .select(TERM_COLS)
      .single()
    if (error) throw new Error(`createTerm: ${error.message}`)
    return data
  }

  async clearCurrentTerm(schoolId: string): Promise<void> {
    await this.db
      .from('terms')
      .update({ is_current: false })
      .eq('school_id', schoolId)
  }

  async setCurrentTerm(schoolId: string, termId: string): Promise<void> {
    const { error } = await this.db
      .from('terms')
      .update({ is_current: true })
      .eq('id', termId)
      .eq('school_id', schoolId)
    if (error) throw new Error(`setCurrentTerm: ${error.message}`)
  }

  async findCurrentTerm(schoolId: string): Promise<Term | null> {
    const { data } = await this.db
      .from('terms')
      .select(TERM_COLS)
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .single()
    return data
  }

  // ── Report Cards ───────────────────────────────────────────────────────────

  async findActiveEnrollmentsByClass(
    classId: string,
    termId: string
  ): Promise<{ learner_id: string }[]> {
    const { data } = await this.db
      .from('learner_enrollments')
      .select('learner_id')
      .eq('class_id', classId)
      .eq('term_id', termId)
      .eq('status', 'active')
    return data ?? []
  }

  async findTermSubjectSummaries(
    classId: string,
    termId: string,
    learnerIds: string[]
  ): Promise<{ learner_id: string; weighted_score: number | null; cbc_level: string | null }[]> {
    const { data } = await this.db
      .from('term_subject_summaries')
      .select('learner_id, weighted_score, cbc_level')
      .eq('class_id', classId)
      .eq('term_id', termId)
      .in('learner_id', learnerIds)
    return data ?? []
  }

  async upsertReportCards(rows: {
    school_id: string
    learner_id: string
    term_id: string
    class_id: string
    overall_score: number
    overall_cbc_level: CbcLevel
    position_in_class: number
    total_learners: number
    is_published: boolean
    generated_at: string
  }[]): Promise<void> {
    const { error } = await this.db
      .from('school_report_cards')
      .upsert(rows, { onConflict: 'learner_id,term_id' })
    if (error) throw new Error(`generateReportCards: ${error.message}`)
  }

  async updateReportCard(
    reportId: string,
    schoolId: string,
    updates: Pick<SchoolReportCard, 'class_teacher_comment' | 'headteacher_comment' | 'days_present' | 'days_absent'>
  ): Promise<SchoolReportCard> {
    const { data, error } = await this.db
      .from('school_report_cards')
      .update(updates)
      .eq('id', reportId)
      .eq('school_id', schoolId)
      .select(REPORT_COLS)
      .single()
    if (error) throw new Error(`updateReportCard: ${error.message}`)
    return data
  }

  async publishReportCards(
    schoolId: string,
    termId: string,
    classId?: string
  ): Promise<{ published: number }> {
    let query = this.db
      .from('school_report_cards')
      .update({ is_published: true, published_at: new Date().toISOString() })
      .eq('school_id', schoolId)
      .eq('term_id', termId)
      .eq('is_published', false)
    if (classId) query = query.eq('class_id', classId)
    const { data, error } = await query.select('id')
    if (error) throw new Error(`publishReportCards: ${error.message}`)
    return { published: data?.length ?? 0 }
  }

  async findReportCardWithSubjects(
    learnerId: string,
    termId: string
  ): Promise<ReportCardWithSubjects | null> {
    const { data } = await this.db
      .from('school_report_cards')
      .select(`
        ${REPORT_COLS},
        learners (id, first_name, middle_name, last_name, admission_number),
        term_subject_summaries (
          id, subject_id, weighted_score, cbc_level, position_in_class, teacher_comment,
          subjects (id, name, code)
        )
      `)
      .eq('learner_id', learnerId)
      .eq('term_id', termId)
      .single()
    return data as unknown as ReportCardWithSubjects | null
  }

  async listClassReportCards(classId: string, termId: string): Promise<SchoolReportCard[]> {
    const { data, error } = await this.db
      .from('school_report_cards')
      .select(REPORT_COLS)
      .eq('class_id', classId)
      .eq('term_id', termId)
      .order('position_in_class')
    if (error) throw new Error(`listClassReportCards: ${error.message}`)
    return data
  }

  async updateReportPdfUrl(reportId: string, pdfUrl: string): Promise<void> {
    const { error } = await this.db
      .from('school_report_cards')
      .update({ pdf_url: pdfUrl })
      .eq('id', reportId)
    if (error) throw new Error(`updatePdfUrl: ${error.message}`)
  }

  // ── Intelligence Snapshots ─────────────────────────────────────────────────

  async findLatestIntelligenceSnapshot(
    schoolId: string
  ): Promise<{ at_risk_count: number; critical_count: number; total_students: number } | null> {
    const { data } = await this.db
      .from('school_intelligence_snapshots')
      .select('at_risk_count, critical_count, total_students')
      .eq('school_id', schoolId)
      .is('grade', null)
      .is('subject', null)
      .order('week_of', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data as { at_risk_count: number; critical_count: number; total_students: number } | null
  }

  async findPreviousIntelligenceSnapshot(
    schoolId: string
  ): Promise<{ at_risk_count: number; critical_count: number; total_students: number; top_struggling_substrands: unknown } | null> {
    const { data } = await this.db
      .from('school_intelligence_snapshots')
      .select('at_risk_count, critical_count, total_students, top_struggling_substrands')
      .eq('school_id', schoolId)
      .is('grade', null)
      .is('subject', null)
      .order('week_of', { ascending: false })
      .range(1, 2)
      .maybeSingle()
    return data as { at_risk_count: number; critical_count: number; total_students: number; top_struggling_substrands: unknown } | null
  }

  async upsertIntelligenceSnapshot(params: {
    school_id: string
    week_of: string
    grade: number | null
    subject: string | null
    total_students: number
    normal_count: number
    watch_count: number
    at_risk_count: number
    critical_count: number
    top_struggling_substrands: StrandHealthRecord[]
    interventions_run: number
    interventions_effective: number
    avg_capability_dimensions: Record<string, number>
    risk_trend: 'improving' | 'stable' | 'declining'
  }): Promise<void> {
    await this.db
      .from('school_intelligence_snapshots')
      .upsert(params, { onConflict: 'school_id,week_of,grade,subject', ignoreDuplicates: false })
  }

  // ── Intelligence: raw data reads ───────────────────────────────────────────

  async findVerifiedTeachers(
    schoolId: string
  ): Promise<{ id: string; user_id: string; grade_levels: unknown; subjects: unknown }[]> {
    const { data } = await this.db
      .from('teachers')
      .select('id, user_id, grade_levels, subjects')
      .eq('school_name', schoolId)
      .eq('is_verified', true)
    return (data ?? []) as { id: string; user_id: string; grade_levels: unknown; subjects: unknown }[]
  }

  async findTeacherClasses(
    teacherIds: string[]
  ): Promise<{ id: string; grade: unknown; subject: unknown; teacher_id: unknown }[]> {
    const { data } = await this.db
      .from('teacher_classes')
      .select('id, grade, subject, teacher_id')
      .in('teacher_id', teacherIds)
    return (data ?? []) as { id: string; grade: unknown; subject: unknown; teacher_id: unknown }[]
  }

  async findClassStudents(
    classIds: string[]
  ): Promise<{ student_id: string; class_id: string }[]> {
    const { data } = await this.db
      .from('class_students')
      .select('student_id, class_id')
      .in('class_id', classIds)
    return data ?? []
  }

  async findLearnerProfiles(
    studentIds: string[]
  ): Promise<{
    student_id: string
    overall_risk_level: unknown
    capability_dimensions: unknown
    risk_history: unknown
    knowledge_state: unknown
  }[]> {
    const { data } = await this.db
      .from('learner_profiles')
      .select('student_id, overall_risk_level, capability_dimensions, risk_history, knowledge_state')
      .in('student_id', studentIds)
    return (data ?? []) as {
      student_id: string
      overall_risk_level: unknown
      capability_dimensions: unknown
      risk_history: unknown
      knowledge_state: unknown
    }[]
  }

  async findTopStrugglingSubstrands(
    classIds: string[]
  ): Promise<{
    subject: unknown
    sub_strand: unknown
    strand: unknown
    struggle_count: unknown
    total_students: unknown
    assessment_level: unknown
    trend: unknown
    risk_score: unknown
  }[]> {
    const { data } = await this.db
      .from('substrand_health')
      .select('subject, sub_strand, strand, struggle_count, total_students, assessment_level, trend, risk_score')
      .in('class_id', classIds)
      .gt('risk_score', 30)
      .order('risk_score', { ascending: false })
      .limit(5)
    return (data ?? []) as {
      subject: unknown
      sub_strand: unknown
      strand: unknown
      struggle_count: unknown
      total_students: unknown
      assessment_level: unknown
      trend: unknown
      risk_score: unknown
    }[]
  }

  async findInterventions(
    teacherUserIds: string[]
  ): Promise<{ intervention_type: unknown; was_effective: unknown; checkin_completed_at: unknown; intervened_at?: unknown }[]> {
    const { data } = await this.db
      .from('intervention_log')
      .select('intervention_type, was_effective, checkin_completed_at, intervened_at')
      .in('teacher_id', teacherUserIds)
      .not('checkin_completed_at', 'is', null)
    return (data ?? []) as { intervention_type: unknown; was_effective: unknown; checkin_completed_at: unknown; intervened_at?: unknown }[]
  }

  async findAllInterventions(
    teacherUserIds: string[]
  ): Promise<{ intervention_type: unknown; was_effective: unknown; checkin_completed_at: unknown }[]> {
    const { data } = await this.db
      .from('intervention_log')
      .select('intervention_type, was_effective, checkin_completed_at')
      .in('teacher_id', teacherUserIds)
    return (data ?? []) as { intervention_type: unknown; was_effective: unknown; checkin_completed_at: unknown }[]
  }

  async findTeacherInterventions(
    teacherUserId: string
  ): Promise<{ was_effective: unknown }[]> {
    const { data } = await this.db
      .from('intervention_log')
      .select('was_effective')
      .eq('teacher_id', teacherUserId)
      .not('checkin_completed_at', 'is', null)
    return (data ?? []) as { was_effective: unknown }[]
  }

  async countFormativeSignals(teacherId: string, termStart: string): Promise<number> {
    const { count } = await this.db
      .from('formative_signals')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .gte('recorded_at', termStart)
    return count ?? 0
  }

  async findEnrolledStudents(
    classId: string
  ): Promise<{ student_id: unknown }[]> {
    const { data } = await this.db
      .from('class_students')
      .select('student_id')
      .eq('class_id', classId)
    return (data ?? []) as { student_id: unknown }[]
  }

  async findLearnerRiskProfiles(
    studentIds: string[]
  ): Promise<{ overall_risk_level: unknown; risk_history: unknown }[]> {
    const { data } = await this.db
      .from('learner_profiles')
      .select('overall_risk_level, risk_history')
      .in('student_id', studentIds)
    return (data ?? []) as { overall_risk_level: unknown; risk_history: unknown }[]
  }
}
