// lib/repositories/career.repository.ts
// All DB access for the career domain.

import { BaseRepository } from './base'
import type {
  Career,
  CareerSummary,
  StudentCareerInterest,
  CareerMatchWithDetail,
  CareerSearchFilters,
  CapabilityProfile,
} from '@/lib/career/types'

// ── Column constants ───────────────────────────────────────────────────────────

const CAREER_FULL_COLS = [
  'id', 'slug', 'title', 'category', 'description',
  'doors', 'ai_impact', 'subject_importance',
  'kenya_market_outlook', 'salary_range_kes',
  'required_subjects', 'skill_timeline', 'future_skills',
  'kenya_examples', 'pathway', 'disclaimer',
  'created_at', 'updated_at',
].join(', ')

const CAREER_SUMMARY_COLS = [
  'id', 'slug', 'title', 'category', 'description',
  'ai_impact', 'kenya_market_outlook',
  'salary_range_kes', 'required_subjects', 'pathway',
].join(', ')

const CAREER_COS_COLS = [
  'id', 'slug', 'title', 'category', 'pathway', 'description',
  'doors', 'ai_impact', 'kenya_market_outlook', 'salary_range_kes',
  'required_subjects', 'disclaimer',
  'required_capabilities', 'capability_cluster', 'difficulty', 'kenya_demand',
  'saturation_note', 'kcse_minimum', 'time_to_income_years', 'cost_to_qualify',
  'risk_level', 'prestige_level', 'social_reality',
  'alternative_career_slugs', 'complementary_career_slugs',
].join(', ')

const INTEREST_COLS =
  'id, student_id, career_id, career_slug, interest_level, notes, explored_at, created_at'

// ── Careers ────────────────────────────────────────────────────────────────────

export class CareerRepository extends BaseRepository {
  async findCareerBySlug(slug: string): Promise<Career | null> {
    const { data, error } = await this.db
      .from('careers')
      .select(CAREER_FULL_COLS)
      .eq('slug', slug)
      .single()

    if (error || !data) return null
    return data as unknown as Career
  }

  async findCareerBySlugWithCOS(slug: string): Promise<Career | null> {
    const { data, error } = await this.db
      .from('careers')
      .select(CAREER_COS_COLS)
      .eq('slug', slug)
      .single()

    if (error || !data) return null
    return data as unknown as Career
  }

  async findCareerByTitleLike(title: string): Promise<Career | null> {
    const { data } = await this.db
      .from('careers')
      .select(CAREER_FULL_COLS)
      .ilike('title', `%${title}%`)
      .limit(1)
      .maybeSingle()
    return (data as unknown as Career) ?? null
  }

  async searchCareers(filters: CareerSearchFilters): Promise<CareerSummary[]> {
    let query = this.db.from('careers').select(CAREER_SUMMARY_COLS)

    if (filters.q) {
      query = query.or(`title.ilike.%${filters.q}%,description.ilike.%${filters.q}%`)
    }
    if (filters.category) {
      query = query.eq('category', filters.category)
    }
    if (filters.pathway) {
      query = query.eq('pathway', filters.pathway)
    }

    const { data, error } = await query.order('title').limit(20)
    if (error) throw new Error(`Career search failed: ${error.message}`)

    return (data ?? []).map(d => ({
      ...(d as object),
      ai_impact: { level: ((d as { ai_impact?: { level?: string } }).ai_impact?.level) ?? 'medium' },
    })) as unknown as CareerSummary[]
  }

  async getAllCareers(): Promise<CareerSummary[]> {
    const { data, error } = await this.db
      .from('careers')
      .select(CAREER_SUMMARY_COLS)
      .order('title')

    if (error) throw new Error(`Failed to load careers: ${error.message}`)
    return (data ?? []).map(d => ({
      ...(d as object),
      ai_impact: { level: ((d as { ai_impact?: { level?: string } }).ai_impact?.level) ?? 'medium' },
    })) as unknown as CareerSummary[]
  }

  async getAllCareersWithCOS(): Promise<Career[]> {
    const { data, error } = await this.db
      .from('careers')
      .select(CAREER_COS_COLS)
      .order('title')

    if (error) throw new Error(`Failed to load careers with COS data: ${error.message}`)
    return (data ?? []) as unknown as Career[]
  }

  async upsertCareer(
    career: Omit<Career, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Career> {
    const { data, error } = await this.db
      .from('careers')
      .upsert(career, { onConflict: 'slug' })
      .select(CAREER_COS_COLS)
      .single()

    if (error) throw new Error(`Failed to save generated career: ${error.message}`)
    return data as unknown as Career
  }

  async findCareerIdsBySlug(slugs: string[]): Promise<Array<{ id: string; slug: string }>> {
    if (slugs.length === 0) return []
    const { data, error } = await this.db
      .from('careers')
      .select('id, slug')
      .in('slug', slugs)
    if (error) throw new Error(`Failed to look up career IDs: ${error.message}`)
    return (data ?? []) as Array<{ id: string; slug: string }>
  }

  // ── Student career matches ────────────────────────────────────────────────────

  async findMatchesForStudent(studentId: string): Promise<CareerMatchWithDetail[]> {
    const { data, error } = await this.db
      .from('student_career_matches')
      .select(
        `id, student_id, career_id, match_score, match_reasoning, subject_gaps, skill_gaps, generated_at,
         career:careers(id, slug, title, category, description, ai_impact, kenya_market_outlook, salary_range_kes, required_subjects, pathway)`,
      )
      .eq('student_id', studentId)
      .order('match_score', { ascending: false })
      .limit(5)

    if (error) throw new Error(`Failed to load matches: ${error.message}`)

    return (data ?? []).map(d => ({
      ...(d as object),
      career: {
        ...((d as { career: object }).career as object),
        ai_impact: { level: ((d as { career: { ai_impact?: { level?: string } } }).career?.ai_impact?.level) ?? 'medium' },
      },
    })) as unknown as CareerMatchWithDetail[]
  }

  async upsertCareerMatches(
    rows: Array<{
      student_id:      string
      career_id:       string
      match_score:     number
      match_reasoning: string
      subject_gaps:    unknown
      skill_gaps:      unknown
      generated_at:    string
    }>,
  ): Promise<void> {
    const { error } = await this.db
      .from('student_career_matches')
      .upsert(rows, { onConflict: 'student_id,career_id' })
    if (error) throw new Error(`Failed to save matches: ${error.message}`)
  }

  // ── Student interests ─────────────────────────────────────────────────────────

  async findInterestsForStudent(studentId: string): Promise<StudentCareerInterest[]> {
    const { data, error } = await this.db
      .from('student_career_interests')
      .select(INTEREST_COLS)
      .eq('student_id', studentId)
      .order('explored_at', { ascending: false })

    if (error) throw new Error(`Failed to load interests: ${error.message}`)
    return (data ?? []) as StudentCareerInterest[]
  }

  async findCareerIdBySlug(slug: string): Promise<{ id: string } | null> {
    const { data } = await this.db
      .from('careers')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    return data ?? null
  }

  async insertCareerInterest(row: {
    student_id:     string
    career_id:      string | null
    career_slug:    string
    interest_level: number
    notes:          string | null
    explored_at:    string
  }): Promise<StudentCareerInterest> {
    const { data, error } = await this.db
      .from('student_career_interests')
      .insert(row)
      .select(INTEREST_COLS)
      .single()

    if (error) throw new Error(`Failed to save interest: ${error.message}`)
    return data as StudentCareerInterest
  }

  // ── Capability profile ────────────────────────────────────────────────────────

  async updateStudentCapabilityProfile(
    studentId: string,
    profile:   CapabilityProfile,
  ): Promise<void> {
    const { error } = await this.db
      .from('students')
      .update({
        capability_profile:     profile,
        capability_computed_at: profile.computed_at,
      })
      .eq('id', studentId)

    if (error) throw new Error(`saveCapabilityProfile update failed: ${error.message}`)
  }

  async insertCapabilityHistory(row: {
    student_id:         string
    capability_profile: CapabilityProfile
    assessment_count:   number
    computed_at:        string
  }): Promise<void> {
    const { error } = await this.db
      .from('capability_history')
      .insert(row)
    if (error) throw new Error(`saveCapabilityProfile history insert failed: ${error.message}`)
  }

  async findStudentCapabilityProfile(
    studentId: string,
  ): Promise<CapabilityProfile | null> {
    const { data, error } = await this.db
      .from('students')
      .select('capability_profile')
      .eq('id', studentId)
      .single()

    if (error) throw new Error(`getCapabilityProfile failed: ${error.message}`)
    return (data?.capability_profile as CapabilityProfile) ?? null
  }

  async findCapabilityHistory(
    studentId: string,
    limit = 10,
  ): Promise<Array<{ computed_at: string; profile: CapabilityProfile }>> {
    const { data, error } = await this.db
      .from('capability_history')
      .select('computed_at, capability_profile')
      .eq('student_id', studentId)
      .order('computed_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(`getCapabilityHistory failed: ${error.message}`)
    return (data ?? []).map(row => ({
      computed_at: row.computed_at as string,
      profile:     row.capability_profile as CapabilityProfile,
    }))
  }

  // ── Clinic reports ────────────────────────────────────────────────────────────

  async findStudentBasicInfo(
    studentId: string,
  ): Promise<{ id: string; name: string; date_of_birth: string | null } | null> {
    const { data, error } = await this.db
      .from('students')
      .select('id, name, date_of_birth')
      .eq('id', studentId)
      .single()

    if (error || !data) return null
    return data as { id: string; name: string; date_of_birth: string | null }
  }

  async upsertClinicReport(row: {
    student_id:    string
    report_data:   Record<string, unknown>
    generated_at:  string
  }): Promise<void> {
    const { error } = await this.db
      .from('student_clinic_reports')
      .upsert(row, { onConflict: 'student_id' })
    if (error) throw new Error(`Failed to save clinic report: ${error.message}`)
  }

  async findClinicReport(
    studentId: string,
  ): Promise<{ report_data: Record<string, unknown>; generated_at: string } | null> {
    const { data } = await this.db
      .from('student_clinic_reports')
      .select('report_data, generated_at')
      .eq('student_id', studentId)
      .maybeSingle()
    if (!data) return null
    return {
      report_data:  data.report_data as Record<string, unknown>,
      generated_at: data.generated_at as string,
    }
  }

  // ── Market cache ──────────────────────────────────────────────────────────────
  //
  // The four read/write helpers that lived here were removed with the
  // DuckDuckGo market lookup they existed to serve (see
  // lib/academicClinic/careerEngine.ts). The `career_market_cache` table and its
  // 15 rows are deliberately left in place so the removal stays reversible; when
  // a real labour-market feed arrives it gets a purpose-built accessor rather
  // than these.

  async updateCareerBySlug(
    slug: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.db
      .from('careers')
      .update(data)
      .eq('slug', slug)
    if (error) throw new Error(`Failed to update career ${slug}: ${error.message}`)
  }

  // ── Assessment pipeline — student + learning context ──────────────────────────

  async findStudentForPipeline(studentId: string): Promise<{
    id: string; name: string; grade: number; curriculum_type: string | null;
    school: string | null; current_pathway: string | null; parent_user_id: string | null;
    parent_email: string | null; parent_phone: string | null; parent_first_name: string | null;
    notification_email: boolean | null; notification_whatsapp: boolean | null;
    whatsapp_opted_in: boolean | null;
  } | null> {
    const { data } = await this.db
      .from('students')
      .select('id, name, grade, curriculum_type, school, current_pathway, parent_user_id, parent_email, parent_phone, parent_first_name, notification_email, notification_whatsapp, whatsapp_opted_in')
      .eq('id', studentId)
      .maybeSingle()
    return data as typeof data ?? null
  }

  async upsertStudentLearningContext(
    row: Record<string, unknown>,
    opts: { onConflict: string },
  ): Promise<void> {
    const { error } = await this.db
      .from('student_learning_context')
      .upsert(row, { onConflict: opts.onConflict })
    if (error) throw new Error(`Failed to upsert student learning context: ${error.message}`)
  }

  async findStudentInviteToken(studentId: string): Promise<string | null> {
    const { data } = await this.db
      .from('invitations')
      .select('token')
      .eq('student_id', studentId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return (data?.token as string | null) ?? null
  }

  async upsertStudentClinicReport(row: {
    student_id:       string
    teacher_id?:      string
    class_id?:        string | null
    assessment_id?:   string
    term?:            number
    year?:            number
    whatsapp_sent_at?: string | null
    email_sent_at?:   string | null
  }): Promise<void> {
    const { error } = await this.db
      .from('student_clinic_reports')
      .upsert(row, { onConflict: 'student_id,assessment_id' })
    if (error) throw new Error(`Failed to upsert clinic report: ${error.message}`)
  }
}

export const careerRepository = new CareerRepository()
