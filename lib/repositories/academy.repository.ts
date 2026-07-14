// lib/repositories/academy.repository.ts
// All DB queries for the EduNexus Academy — modules, lessons, progress, cohorts,
// competencies, evidence, missions, reflections, and XP events.

import { BaseRepository } from './base'
import type {
  AcademyModule,
  AcademyLesson,
  AcademyProgress,
  LessonStub,
  AcademyReflection,
  ReflectionInput,
  ReflectionFeedback,
  AcademyMission,
  MissionCompletion,
  MissionVerdict,
  AcademyEvidence,
  EvidenceInput,
  RecentPlan,
} from '@/lib/academy/types'

// ── Column constants ──────────────────────────────────────────────────────────

const MODULE_COLS =
  'id, title, slug, phase, order, description, estimated_mins, color, published, created_at'

const LESSON_STUB_COLS =
  'id, module_id, title, order, created_at'

const LESSON_FULL_COLS =
  'id, module_id, title, order, content, practice_prompt, practice_link, created_at'

const PROGRESS_COLS =
  'id, teacher_id, lesson_id, completed_at'

const REFLECTION_COLS =
  'id, teacher_id, lesson_id, module_id, tried, worked, failed, surprised, next_action, ai_feedback, quality_score, is_fallback, word_count, created_at, updated_at'

const MISSION_COLS =
  'id, module_id, phase, title, description, instructions, mission_type, tool_a_label, tool_b_label, tool_a_prompt, tool_b_link, evaluation_rubric, xp_reward, order, published, created_at'

const COMPLETION_COLS =
  'id, teacher_id, mission_id, tool_a_output, tool_b_output, comparison_notes, self_scores, ai_score, ai_verdict, is_fallback, completed_at, updated_at'

const EVIDENCE_COLS =
  'id, teacher_id, lesson_id, evidence_type, content, linked_id, linked_title, description, created_at, updated_at'

const COHORT_COLS =
  'id, name, school, join_code, lead_teacher_id, created_at'

const COMPETENCY_COLS =
  'id, label, description, category, color'

// ── Repository ────────────────────────────────────────────────────────────────

export class AcademyRepository extends BaseRepository {
  // ── Modules ──────────────────────────────────────────────────────────────────

  /**
   * Fetch all published academy modules ordered by phase then order.
   */
  async findPublishedModules(): Promise<AcademyModule[]> {
    const { data, error } = await this.db
      .from('academy_modules')
      .select(MODULE_COLS)
      .eq('published', true)
      .order('phase')
      .order('order')

    if (error) throw new Error(`Failed to fetch academy modules: ${error.message}`)
    return (data ?? []) as AcademyModule[]
  }

  /**
   * Fetch a single published module by its slug.
   */
  async findModuleBySlug(slug: string): Promise<AcademyModule | null> {
    const { data, error } = await this.db
      .from('academy_modules')
      .select(MODULE_COLS)
      .eq('slug', slug)
      .eq('published', true)
      .single()

    if (error || !data) return null
    return data as AcademyModule
  }

  /**
   * Fetch published module ids for a given phase.
   */
  async findModuleIdsByPhase(phase: number): Promise<string[]> {
    const { data } = await this.db
      .from('academy_modules')
      .select('id')
      .eq('published', true)
      .eq('phase', phase)

    return (data ?? []).map(m => m.id)
  }

  /**
   * Fetch the previous and next published module slugs relative to a position in a phase.
   */
  async findAdjacentModules(
    currentOrder: number,
    phase: number
  ): Promise<{
    prev: { slug: string; title: string } | null
    next: { slug: string; title: string } | null
  }> {
    const [prevRes, nextRes] = await Promise.all([
      this.db
        .from('academy_modules')
        .select('slug, title')
        .eq('phase', phase)
        .eq('published', true)
        .lt('order', currentOrder)
        .order('order', { ascending: false })
        .limit(1),
      this.db
        .from('academy_modules')
        .select('slug, title')
        .eq('phase', phase)
        .eq('published', true)
        .gt('order', currentOrder)
        .order('order', { ascending: true })
        .limit(1),
    ])

    return {
      prev: prevRes.data?.[0] ?? null,
      next: nextRes.data?.[0] ?? null,
    }
  }

  // ── Lessons ───────────────────────────────────────────────────────────────────

  /**
   * Fetch lesson stubs (no content) for a set of module ids.
   */
  async findLessonStubsByModuleIds(moduleIds: string[]): Promise<LessonStub[]> {
    if (!moduleIds.length) return []

    const { data, error } = await this.db
      .from('academy_lessons')
      .select(LESSON_STUB_COLS)
      .in('module_id', moduleIds)
      .order('order')

    if (error) throw new Error(`Failed to fetch lessons: ${error.message}`)
    return (data ?? []) as LessonStub[]
  }

  /**
   * Fetch full lesson records (including content) for a module.
   */
  async findLessonsByModule(moduleId: string): Promise<AcademyLesson[]> {
    const { data, error } = await this.db
      .from('academy_lessons')
      .select(LESSON_FULL_COLS)
      .eq('module_id', moduleId)
      .order('order')

    if (error) throw new Error(`Failed to fetch lessons: ${error.message}`)
    return (data ?? []) as AcademyLesson[]
  }

  /**
   * Fetch lesson id stubs for a set of module ids (id + module_id only).
   */
  async findLessonIdsByModuleIds(moduleIds: string[]): Promise<Array<{ id: string; module_id: string }>> {
    if (!moduleIds.length) return []

    const { data } = await this.db
      .from('academy_lessons')
      .select('id, module_id')
      .in('module_id', moduleIds)

    return (data ?? []) as Array<{ id: string; module_id: string }>
  }

  // ── Progress ──────────────────────────────────────────────────────────────────

  /**
   * Fetch all progress records for a teacher (lesson_id only).
   */
  async findProgressByTeacher(teacherId: string): Promise<Array<{ lesson_id: string }>> {
    const { data } = await this.db
      .from('academy_progress')
      .select('lesson_id')
      .eq('teacher_id', teacherId)

    return (data ?? []) as Array<{ lesson_id: string }>
  }

  /**
   * Fetch progress records for a teacher filtered to specific lesson ids.
   */
  async findProgressForLessons(
    teacherId: string,
    lessonIds: string[]
  ): Promise<Array<{ lesson_id: string; completed_at: string }>> {
    if (!lessonIds.length) return []

    const { data } = await this.db
      .from('academy_progress')
      .select('lesson_id, completed_at')
      .eq('teacher_id', teacherId)
      .in('lesson_id', lessonIds)

    return (data ?? []) as Array<{ lesson_id: string; completed_at: string }>
  }

  /**
   * Count completed lessons for a teacher within a specific lesson id set.
   */
  async countCompletedLessons(teacherId: string, lessonIds: string[]): Promise<number> {
    if (!lessonIds.length) return 0

    const { count } = await this.db
      .from('academy_progress')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .in('lesson_id', lessonIds)

    return count ?? 0
  }

  /**
   * Fetch progress rows for a set of teacher ids (for cohort leaderboard).
   */
  async findProgressByTeacherIds(
    teacherIds: string[]
  ): Promise<Array<{ teacher_id: string }>> {
    if (!teacherIds.length) return []

    const { data } = await this.db
      .from('academy_progress')
      .select('teacher_id')
      .in('teacher_id', teacherIds)

    return (data ?? []) as Array<{ teacher_id: string }>
  }

  /**
   * Upsert a lesson completion for a teacher.
   */
  async upsertLessonProgress(teacherId: string, lessonId: string): Promise<void> {
    const { error } = await this.db
      .from('academy_progress')
      .upsert(
        { teacher_id: teacherId, lesson_id: lessonId },
        { onConflict: 'teacher_id,lesson_id' }
      )

    if (error) throw new Error(`Failed to mark lesson complete: ${error.message}`)
  }

  // ── Reflections ───────────────────────────────────────────────────────────────

  /**
   * Upsert a reflection and store AI feedback.
   */
  async upsertReflection(
    teacherId: string,
    input: ReflectionInput,
    feedback: ReflectionFeedback,
    wordCount: number
  ): Promise<AcademyReflection> {
    const { data, error } = await this.db
      .from('academy_reflections')
      .upsert(
        {
          teacher_id:    teacherId,
          lesson_id:     input.lesson_id,
          module_id:     input.module_id,
          tried:         input.tried,
          worked:        input.worked,
          failed:        input.failed,
          surprised:     input.surprised,
          next_action:   input.next_action,
          ai_feedback:   feedback.feedback_text,
          quality_score: feedback.quality_score,
          is_fallback:   feedback.isFallback,
          word_count:    wordCount,
          updated_at:    new Date().toISOString(),
        },
        { onConflict: 'teacher_id,lesson_id' }
      )
      .select(REFLECTION_COLS)
      .single()

    if (error) throw new Error(`Failed to save reflection: ${error.message}`)
    return data as AcademyReflection
  }

  /**
   * Fetch all reflections for a teacher in a module.
   */
  async findReflectionsByModule(
    teacherId: string,
    moduleId: string
  ): Promise<AcademyReflection[]> {
    const { data, error } = await this.db
      .from('academy_reflections')
      .select(REFLECTION_COLS)
      .eq('teacher_id', teacherId)
      .eq('module_id', moduleId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch reflections: ${error.message}`)
    return (data ?? []) as AcademyReflection[]
  }

  /**
   * Fetch a single reflection for a specific lesson.
   */
  async findReflectionForLesson(
    teacherId: string,
    lessonId: string
  ): Promise<AcademyReflection | null> {
    const { data } = await this.db
      .from('academy_reflections')
      .select(REFLECTION_COLS)
      .eq('teacher_id', teacherId)
      .eq('lesson_id', lessonId)
      .maybeSingle()

    return (data as AcademyReflection) ?? null
  }

  /**
   * Fetch quality_score and created_at for all a teacher's reflections.
   * Used to compute reflection stats.
   */
  async findReflectionScores(
    teacherId: string
  ): Promise<Array<{ quality_score: number | null; created_at: string }>> {
    const { data, error } = await this.db
      .from('academy_reflections')
      .select('quality_score, created_at')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch reflection stats: ${error.message}`)
    return (data ?? []) as Array<{ quality_score: number | null; created_at: string }>
  }

  // ── Missions ──────────────────────────────────────────────────────────────────

  /**
   * Fetch published missions for a module.
   */
  async findMissionsByModule(moduleId: string): Promise<AcademyMission[]> {
    const { data, error } = await this.db
      .from('academy_missions')
      .select(MISSION_COLS)
      .eq('module_id', moduleId)
      .eq('published', true)
      .order('order')

    if (error) throw new Error(`Failed to fetch missions: ${error.message}`)
    return (data ?? []) as AcademyMission[]
  }

  /**
   * Fetch a single published mission by id.
   */
  async findMission(missionId: string): Promise<AcademyMission | null> {
    const { data, error } = await this.db
      .from('academy_missions')
      .select(MISSION_COLS)
      .eq('id', missionId)
      .eq('published', true)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch mission: ${error.message}`)
    return (data as AcademyMission) ?? null
  }

  /**
   * Fetch completions for a teacher filtered to a set of mission ids.
   */
  async findMissionCompletions(
    teacherId: string,
    missionIds: string[]
  ): Promise<MissionCompletion[]> {
    if (!missionIds.length) return []

    const { data } = await this.db
      .from('academy_mission_completions')
      .select(COMPLETION_COLS)
      .eq('teacher_id', teacherId)
      .in('mission_id', missionIds)

    return (data ?? []) as MissionCompletion[]
  }

  /**
   * Fetch a single mission completion.
   */
  async findMissionCompletion(
    teacherId: string,
    missionId: string
  ): Promise<MissionCompletion | null> {
    const { data } = await this.db
      .from('academy_mission_completions')
      .select(COMPLETION_COLS)
      .eq('teacher_id', teacherId)
      .eq('mission_id', missionId)
      .maybeSingle()

    return (data as MissionCompletion) ?? null
  }

  /**
   * Upsert a mission completion with AI verdict.
   */
  async upsertMissionCompletion(
    teacherId: string,
    missionId: string,
    toolAOutput: string,
    toolBOutput: string,
    comparisonNotes: string,
    selfScores: Record<string, number>,
    verdict: MissionVerdict
  ): Promise<MissionCompletion> {
    const { data, error } = await this.db
      .from('academy_mission_completions')
      .upsert(
        {
          teacher_id:       teacherId,
          mission_id:       missionId,
          tool_a_output:    toolAOutput,
          tool_b_output:    toolBOutput,
          comparison_notes: comparisonNotes,
          self_scores:      selfScores,
          ai_score:         verdict.ai_score,
          ai_verdict:       verdict.ai_verdict,
          is_fallback:      verdict.isFallback,
          updated_at:       new Date().toISOString(),
        },
        { onConflict: 'teacher_id,mission_id' }
      )
      .select(COMPLETION_COLS)
      .single()

    if (error) throw new Error(`Failed to save mission completion: ${error.message}`)
    return data as MissionCompletion
  }

  /**
   * Fetch ai_score for all completions for a teacher.
   * Used to compute avgAiScore in portfolio.
   */
  async findMissionCompletionScores(
    teacherId: string
  ): Promise<Array<{ ai_score: number | null }>> {
    const { data } = await this.db
      .from('academy_mission_completions')
      .select('ai_score')
      .eq('teacher_id', teacherId)

    return (data ?? []) as Array<{ ai_score: number | null }>
  }

  // ── XP Events ─────────────────────────────────────────────────────────────────

  /**
   * Insert an XP event record.
   */
  async insertXpEvent(
    teacherId: string,
    eventType: string,
    xpEarned: number,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const { error } = await this.db
      .from('academy_xp_events')
      .insert({ teacher_id: teacherId, event_type: eventType, xp_earned: xpEarned, metadata })

    if (error) throw new Error(`Failed to record XP: ${error.message}`)
  }

  /**
   * Sum total XP for a teacher.
   */
  async findTotalXp(teacherId: string): Promise<number> {
    const { data } = await this.db
      .from('academy_xp_events')
      .select('xp_earned')
      .eq('teacher_id', teacherId)

    return (data ?? []).reduce((sum, e) => sum + ((e.xp_earned as number) ?? 0), 0)
  }

  /**
   * Fetch XP events for a set of teacher ids (for cohort leaderboard).
   */
  async findXpByTeacherIds(
    teacherIds: string[]
  ): Promise<Array<{ teacher_id: string; xp: number }>> {
    if (!teacherIds.length) return []

    const { data } = await this.db
      .from('academy_xp_events')
      .select('teacher_id, xp_earned')
      .in('teacher_id', teacherIds)

    return (data ?? []).map(r => ({
      teacher_id: r.teacher_id as string,
      xp:         (r.xp_earned as number) ?? 0,
    }))
  }

  // ── Evidence ──────────────────────────────────────────────────────────────────

  /**
   * Fetch all evidence for a specific lesson.
   */
  async findEvidenceForLesson(
    teacherId: string,
    lessonId: string
  ): Promise<AcademyEvidence[]> {
    const { data, error } = await this.db
      .from('academy_evidence')
      .select(EVIDENCE_COLS)
      .eq('teacher_id', teacherId)
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch evidence: ${error.message}`)
    return (data ?? []) as AcademyEvidence[]
  }

  /**
   * Fetch evidence for a set of lesson ids (module-level view).
   */
  async findEvidenceForLessons(
    teacherId: string,
    lessonIds: string[]
  ): Promise<AcademyEvidence[]> {
    if (!lessonIds.length) return []

    const { data, error } = await this.db
      .from('academy_evidence')
      .select(EVIDENCE_COLS)
      .eq('teacher_id', teacherId)
      .in('lesson_id', lessonIds)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch module evidence: ${error.message}`)
    return (data ?? []) as AcademyEvidence[]
  }

  /**
   * Insert a new evidence record.
   */
  async insertEvidence(teacherId: string, input: EvidenceInput): Promise<AcademyEvidence> {
    const { data, error } = await this.db
      .from('academy_evidence')
      .insert({
        teacher_id:    teacherId,
        lesson_id:     input.lesson_id,
        evidence_type: input.evidence_type,
        content:       input.content || null,
        linked_id:     input.linked_id || null,
        linked_title:  input.linked_title || null,
        description:   input.description,
      })
      .select(EVIDENCE_COLS)
      .single()

    if (error) throw new Error(`Failed to add evidence: ${error.message}`)
    return data as AcademyEvidence
  }

  /**
   * Delete an evidence record (ownership enforced by teacher_id guard).
   */
  async deleteEvidence(teacherId: string, evidenceId: string): Promise<void> {
    const { error } = await this.db
      .from('academy_evidence')
      .delete()
      .eq('id', evidenceId)
      .eq('teacher_id', teacherId)

    if (error) throw new Error(`Failed to delete evidence: ${error.message}`)
  }

  /**
   * Fetch evidence_type for all a teacher's evidence (for stats).
   */
  async findEvidenceTypes(
    teacherId: string
  ): Promise<Array<{ evidence_type: string }>> {
    const { data, error } = await this.db
      .from('academy_evidence')
      .select('evidence_type')
      .eq('teacher_id', teacherId)

    if (error) throw new Error(`Failed to fetch evidence stats: ${error.message}`)
    return (data ?? []) as Array<{ evidence_type: string }>
  }

  // ── Cohorts ───────────────────────────────────────────────────────────────────

  /**
   * Find a cohort by join code.
   */
  async findCohortByCode(
    code: string
  ): Promise<{
    id: string
    name: string
    school: string | null
    join_code: string
    lead_teacher_id: string
    created_at: string
  } | null> {
    const { data, error } = await this.db
      .from('academy_cohorts')
      .select(COHORT_COLS)
      .eq('join_code', code.toUpperCase().trim())
      .maybeSingle()

    if (error) return null
    return data ?? null
  }

  /**
   * Find a cohort by id.
   */
  async findCohortById(cohortId: string): Promise<{
    id: string
    name: string
    school: string | null
    join_code: string
    lead_teacher_id: string
    created_at: string
  } | null> {
    const { data } = await this.db
      .from('academy_cohorts')
      .select(COHORT_COLS)
      .eq('id', cohortId)
      .single()

    return data ?? null
  }

  /**
   * Check if a join code is already in use.
   */
  async findCohortByJoinCode(joinCode: string): Promise<{ id: string } | null> {
    const { data } = await this.db
      .from('academy_cohorts')
      .select('id')
      .eq('join_code', joinCode)
      .maybeSingle()

    return data ?? null
  }

  /**
   * Insert a new cohort row.
   */
  async insertCohort(row: {
    name: string
    school: string | null
    join_code: string
    lead_teacher_id: string
  }): Promise<{
    id: string
    name: string
    school: string | null
    join_code: string
    lead_teacher_id: string
    created_at: string
  }> {
    const { data, error } = await this.db
      .from('academy_cohorts')
      .insert(row)
      .select(COHORT_COLS)
      .single()

    if (error || !data) throw new Error(error?.message ?? 'Failed to create cohort')
    return data
  }

  /**
   * Upsert a cohort membership row.
   */
  async upsertCohortMember(cohortId: string, teacherId: string): Promise<void> {
    const { error } = await this.db
      .from('academy_cohort_members')
      .upsert(
        { cohort_id: cohortId, teacher_id: teacherId },
        { onConflict: 'cohort_id,teacher_id' }
      )

    if (error) throw new Error(error.message)
  }

  /**
   * Fetch cohort ids for a teacher.
   */
  async findCohortIdsByTeacher(teacherId: string): Promise<string[]> {
    const { data } = await this.db
      .from('academy_cohort_members')
      .select('cohort_id')
      .eq('teacher_id', teacherId)

    return (data ?? []).map(m => m.cohort_id as string)
  }

  /**
   * Fetch cohorts by a list of ids.
   */
  async findCohortsByIds(cohortIds: string[]): Promise<Array<{
    id: string
    name: string
    school: string | null
    join_code: string
    lead_teacher_id: string
    created_at: string
  }>> {
    if (!cohortIds.length) return []

    const { data } = await this.db
      .from('academy_cohorts')
      .select(COHORT_COLS)
      .in('id', cohortIds)
      .order('created_at', { ascending: false })

    return (data ?? []) as Array<{
      id: string
      name: string
      school: string | null
      join_code: string
      lead_teacher_id: string
      created_at: string
    }>
  }

  /**
   * Check if a teacher is a member of a cohort.
   */
  async findCohortMembership(
    cohortId: string,
    teacherId: string
  ): Promise<{ id: string } | null> {
    const { data } = await this.db
      .from('academy_cohort_members')
      .select('id')
      .eq('cohort_id', cohortId)
      .eq('teacher_id', teacherId)
      .maybeSingle()

    return data ?? null
  }

  /**
   * Fetch all members of a cohort with joined_at.
   */
  async findCohortMembers(
    cohortId: string
  ): Promise<Array<{ teacher_id: string; joined_at: string }>> {
    const { data } = await this.db
      .from('academy_cohort_members')
      .select('teacher_id, joined_at')
      .eq('cohort_id', cohortId)

    return (data ?? []) as Array<{ teacher_id: string; joined_at: string }>
  }

  /**
   * Remove a teacher from a cohort.
   */
  async deleteCohortMember(cohortId: string, teacherId: string): Promise<void> {
    await this.db
      .from('academy_cohort_members')
      .delete()
      .eq('cohort_id', cohortId)
      .eq('teacher_id', teacherId)
  }

  /**
   * Fetch teacher profile stubs for cohort display.
   */
  async findTeacherProfiles(
    teacherIds: string[]
  ): Promise<Array<{ id: string; full_name: string | null; school: string | null }>> {
    if (!teacherIds.length) return []

    const { data } = await this.db
      .from('teachers')
      .select('id, full_name, school')
      .in('id', teacherIds)

    return (data ?? []) as Array<{ id: string; full_name: string | null; school: string | null }>
  }

  // ── Competencies ──────────────────────────────────────────────────────────────

  /**
   * Fetch all competency definitions.
   */
  async findCompetencies(): Promise<Array<{
    id: string
    label: string
    description: string
    category: string
    color: string
  }>> {
    const { data, error } = await this.db
      .from('academy_competencies')
      .select(COMPETENCY_COLS)
      .order('id')

    if (error) throw new Error(`Failed to fetch competencies: ${error.message}`)
    return (data ?? []) as Array<{
      id: string
      label: string
      description: string
      category: string
      color: string
    }>
  }

  /**
   * Fetch module-to-competency mappings.
   */
  async findModuleCompetencyMappings(): Promise<Array<{
    module_id: string
    competency_id: string
  }>> {
    const { data, error } = await this.db
      .from('academy_module_competencies')
      .select('module_id, competency_id')

    if (error) throw new Error(`Failed to fetch competency mappings: ${error.message}`)
    return (data ?? []) as Array<{ module_id: string; competency_id: string }>
  }

  // ── Portfolio helpers ─────────────────────────────────────────────────────────

  /**
   * Fetch teacher record for portfolio display.
   */
  async findTeacher(teacherId: string): Promise<{
    id: string
    full_name: string | null
    school: string | null
    created_at: string
  } | null> {
    const { data } = await this.db
      .from('teachers')
      .select('id, full_name, school, created_at')
      .eq('id', teacherId)
      .single()

    return data ?? null
  }

  /**
   * Count lesson plans, schemes of work, and records of work for a teacher.
   */
  async findToolUsageCounts(teacherId: string): Promise<{
    lessonPlans: number
    schemesOfWork: number
    recordsOfWork: number
  }> {
    const [lpRes, sowRes, rowRes] = await Promise.all([
      this.db
        .from('lesson_plans')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', teacherId),
      this.db
        .from('schemes_of_work')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', teacherId),
      this.db
        .from('records_of_work')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', teacherId),
    ])

    return {
      lessonPlans:   lpRes.count  ?? 0,
      schemesOfWork: sowRes.count ?? 0,
      recordsOfWork: rowRes.count ?? 0,
    }
  }

  // ── Recent plans (evidence linking) ──────────────────────────────────────────

  /**
   * Fetch recent lesson plans for evidence linking.
   */
  async findRecentPlans(teacherId: string, limit = 20): Promise<RecentPlan[]> {
    const { data, error } = await this.db
      .from('lesson_plans')
      .select('id, strand, sub_strand, week_number, lesson_number, taught_date, created_at')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(`Failed to fetch plans: ${error.message}`)
    return (data ?? []) as RecentPlan[]
  }
}
