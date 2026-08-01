// lib/repositories/learner-model.repository.ts
// All DB access for the Permanent Learner Memory (learner_profiles + related tables).

import { BaseRepository } from './base'
import type {
  LearnerProfile,
  KnowledgeState,
  CapabilityDimensions,
  CareerSignals,
  EngagementPatterns,
  RiskFlag,
  RiskLevel,
  FormativeSignalSnapshot,
  LearningBehaviour,
  BehaviourMetric,
  GrowthMilestone,
  RiskHistoryRecord,
  ParentObservation,
  PathwayReadiness,
  TermSnapshot,
} from '@/lib/learnerModel/types'

// ── Column constant ───────────────────────────────────────────────────────────

const COLUMNS = [
  'id', 'student_id',
  'learning_style', 'strengths', 'weaknesses', 'interests', 'profile_data',
  'knowledge_state', 'capability_dimensions', 'career_signals',
  'engagement_patterns', 'risk_flags', 'formative_signals',
  'overall_risk_level', 'last_assessment_date', 'current_term', 'current_year',
  'learning_behaviour', 'growth_milestones', 'risk_history',
  'confirmed_gaps', 'persistent_gaps', 'parent_observations',
  'pathway_readiness', 'term_snapshots',
  'created_at', 'updated_at',
].join(', ')

// ── Default value factories ───────────────────────────────────────────────────

function defaultLearningBehaviour(): LearningBehaviour {
  const defaultMetric = (): BehaviourMetric => ({
    score: 0.5, trend: 'stable', data_points: 0,
    last_updated: new Date().toISOString(),
  })
  return {
    persistence:  defaultMetric(),
    confidence:   defaultMetric(),
    velocity:     defaultMetric(),
    help_seeking: defaultMetric(),
    reflection:   defaultMetric(),
    consistency:  defaultMetric(),
  }
}

function defaultPathwayReadiness(): PathwayReadiness {
  const defaultScore = () => ({ score: 0, trend: 'stable' as const, last_updated: null })
  return {
    stem:            defaultScore(),
    social_sciences: defaultScore(),
    arts_sports:     defaultScore(),
    technical_tvet:  defaultScore(),
  }
}

function hydrateProfile(raw: Record<string, unknown>): LearnerProfile {
  return {
    ...raw,
    knowledge_state:       (raw.knowledge_state       ?? {}) as KnowledgeState,
    capability_dimensions: (raw.capability_dimensions ?? {}) as Partial<CapabilityDimensions>,
    career_signals:        (raw.career_signals         ?? {}) as Partial<CareerSignals>,
    engagement_patterns:   (raw.engagement_patterns    ?? {}) as Partial<EngagementPatterns>,
    risk_flags:            (raw.risk_flags             ?? []) as RiskFlag[],
    formative_signals:     (raw.formative_signals      ?? []) as FormativeSignalSnapshot[],
    overall_risk_level:    (raw.overall_risk_level     ?? 'normal') as RiskLevel,
    learning_behaviour:    (raw.learning_behaviour     ?? defaultLearningBehaviour()) as LearningBehaviour,
    growth_milestones:     (raw.growth_milestones      ?? []) as GrowthMilestone[],
    risk_history:          (raw.risk_history           ?? []) as RiskHistoryRecord[],
    confirmed_gaps:        (raw.confirmed_gaps         ?? []) as string[],
    persistent_gaps:       (raw.persistent_gaps        ?? []) as string[],
    parent_observations:   (raw.parent_observations    ?? []) as ParentObservation[],
    pathway_readiness:     (raw.pathway_readiness      ?? defaultPathwayReadiness()) as PathwayReadiness,
    term_snapshots:        (raw.term_snapshots         ?? []) as TermSnapshot[],
  } as LearnerProfile
}

export class LearnerModelRepository extends BaseRepository {
  // ── Read ──────────────────────────────────────────────────────────────────────

  async getLearnerProfile(studentId: string): Promise<LearnerProfile | null> {
    const { data, error } = await this.db
      .from('learner_profiles')
      .select(COLUMNS)
      .eq('student_id', studentId)
      .maybeSingle()

    if (error) throw new Error(`getLearnerProfile: ${error.message}`)
    if (!data) return null
    return hydrateProfile(data as unknown as Record<string, unknown>)
  }

  async getOrCreateLearnerProfile(studentId: string): Promise<LearnerProfile> {
    const existing = await this.getLearnerProfile(studentId)
    if (existing) return existing

    // Upsert on the student_id uniqueness constraint rather than a plain
    // insert — two concurrent callers racing past the check above must not
    // be able to create two rows for the same student.
    const { data, error } = await this.db
      .from('learner_profiles')
      .upsert({ student_id: studentId }, { onConflict: 'student_id', ignoreDuplicates: false })
      .select(COLUMNS)
      .single()

    if (error) throw new Error(`getOrCreateLearnerProfile: ${error.message}`)
    return hydrateProfile(data as unknown as Record<string, unknown>)
  }

  async getClassLearnerProfiles(classId: string): Promise<LearnerProfile[]> {
    const { data: enrollment } = await this.db
      .from('class_students')
      .select('student_id')
      .eq('class_id', classId)

    if (!enrollment?.length) return []
    const studentIds = enrollment.map(e => e.student_id as string)

    const { data, error } = await this.db
      .from('learner_profiles')
      .select(COLUMNS)
      .in('student_id', studentIds)

    if (error) throw new Error(`getClassLearnerProfiles: ${error.message}`)

    const profileMap = new Map(
      (data ?? []).map(p => {
        const hydrated = hydrateProfile(p as unknown as Record<string, unknown>)
        return [hydrated.student_id, hydrated]
      }),
    )

    const missing = studentIds.filter(id => !profileMap.has(id))
    if (missing.length > 0) {
      const { data: created } = await this.db
        .from('learner_profiles')
        .insert(missing.map(id => ({ student_id: id })))
        .select(COLUMNS)
      for (const p of created ?? []) {
        const hydrated = hydrateProfile(p as unknown as Record<string, unknown>)
        profileMap.set(hydrated.student_id, hydrated)
      }
    }

    return [...profileMap.values()]
  }

  // ── Patch helpers ─────────────────────────────────────────────────────────────

  async patchKnowledgeState(
    studentId: string,
    patch: Partial<KnowledgeState>,
  ): Promise<void> {
    const profile = await this.getOrCreateLearnerProfile(studentId)
    const merged  = { ...profile.knowledge_state, ...patch }

    const { error } = await this.db
      .from('learner_profiles')
      .update({ knowledge_state: merged })
      .eq('student_id', studentId)

    if (error) throw new Error(`patchKnowledgeState: ${error.message}`)
  }

  async patchCapabilityDimensions(
    studentId:  string,
    dimensions: Partial<CapabilityDimensions>,
  ): Promise<void> {
    const { error } = await this.db
      .from('learner_profiles')
      .update({ capability_dimensions: dimensions })
      .eq('student_id', studentId)

    if (error) throw new Error(`patchCapabilityDimensions: ${error.message}`)
  }

  async patchCareerSignals(
    studentId: string,
    signals:   Partial<CareerSignals>,
  ): Promise<void> {
    // Must ensure the row exists first (like patchKnowledgeState/
    // patchEngagementPatterns) — without this, a learner whose
    // learner_profiles row hasn't been created yet gets a silent 0-row
    // UPDATE (Postgrest doesn't error on that), so refreshCareerSignals()
    // "succeeds" while never actually writing career_signals. Found via
    // lib/projection/careerPropagation.integration.test.ts.
    await this.getOrCreateLearnerProfile(studentId)

    const { error } = await this.db
      .from('learner_profiles')
      .update({ career_signals: signals })
      .eq('student_id', studentId)

    if (error) throw new Error(`patchCareerSignals: ${error.message}`)
  }

  async patchEngagementPatterns(
    studentId: string,
    patterns:  Partial<EngagementPatterns>,
  ): Promise<void> {
    const profile = await this.getOrCreateLearnerProfile(studentId)
    const merged  = { ...profile.engagement_patterns, ...patterns }

    const { error } = await this.db
      .from('learner_profiles')
      .update({ engagement_patterns: merged })
      .eq('student_id', studentId)

    if (error) throw new Error(`patchEngagementPatterns: ${error.message}`)
  }

  async patchLearningBehaviour(
    studentId: string,
    patch:     Partial<LearningBehaviour>,
  ): Promise<void> {
    const profile = await this.getOrCreateLearnerProfile(studentId)
    const merged  = { ...profile.learning_behaviour, ...patch }

    const { error } = await this.db
      .from('learner_profiles')
      .update({ learning_behaviour: merged })
      .eq('student_id', studentId)

    if (error) throw new Error(`patchLearningBehaviour: ${error.message}`)
  }

  async patchPathwayReadiness(
    studentId: string,
    patch:     Partial<PathwayReadiness>,
  ): Promise<void> {
    const profile = await this.getOrCreateLearnerProfile(studentId)
    const merged  = { ...profile.pathway_readiness, ...patch }

    const { error } = await this.db
      .from('learner_profiles')
      .update({ pathway_readiness: merged })
      .eq('student_id', studentId)

    if (error) throw new Error(`patchPathwayReadiness: ${error.message}`)
  }

  async addFormativeSignal(
    studentId: string,
    signal:    FormativeSignalSnapshot,
  ): Promise<void> {
    const profile  = await this.getOrCreateLearnerProfile(studentId)
    const signals  = [signal, ...profile.formative_signals].slice(0, 20)

    const { error } = await this.db
      .from('learner_profiles')
      .update({ formative_signals: signals })
      .eq('student_id', studentId)

    if (error) throw new Error(`addFormativeSignal: ${error.message}`)
  }

  async addParentObservation(
    studentId:   string,
    observation: ParentObservation,
  ): Promise<void> {
    const profile      = await this.getOrCreateLearnerProfile(studentId)
    const observations = [observation, ...profile.parent_observations].slice(0, 12)

    const { error } = await this.db
      .from('learner_profiles')
      .update({ parent_observations: observations })
      .eq('student_id', studentId)

    if (error) throw new Error(`addParentObservation: ${error.message}`)
  }

  async addGrowthMilestone(
    studentId: string,
    milestone: GrowthMilestone,
  ): Promise<void> {
    const profile    = await this.getOrCreateLearnerProfile(studentId)
    const milestones = [milestone, ...profile.growth_milestones]

    const { error } = await this.db
      .from('learner_profiles')
      .update({ growth_milestones: milestones })
      .eq('student_id', studentId)

    if (error) throw new Error(`addGrowthMilestone: ${error.message}`)
  }

  async markGrowthMilestonesNotified(
    studentId:   string,
    milestones:  GrowthMilestone[],
  ): Promise<void> {
    const { error } = await this.db
      .from('learner_profiles')
      .update({ growth_milestones: milestones })
      .eq('student_id', studentId)

    if (error) throw new Error(`markGrowthMilestonesNotified: ${error.message}`)
  }

  async updateRiskProfile(
    studentId:   string,
    flags:       RiskFlag[],
    riskLevel:   RiskLevel,
    riskHistory: RiskHistoryRecord[],
  ): Promise<void> {
    const { error } = await this.db
      .from('learner_profiles')
      .update({
        risk_flags:         flags,
        overall_risk_level: riskLevel,
        risk_history:       riskHistory,
      })
      .eq('student_id', studentId)

    if (error) throw new Error(`updateRiskProfile: ${error.message}`)
  }

  async updateConfirmedGaps(
    studentId:      string,
    confirmedGaps:  string[],
    persistentGaps: string[],
  ): Promise<void> {
    const { error } = await this.db
      .from('learner_profiles')
      .update({ confirmed_gaps: confirmedGaps, persistent_gaps: persistentGaps })
      .eq('student_id', studentId)

    if (error) throw new Error(`updateConfirmedGaps: ${error.message}`)
  }

  async markAssessmentDate(
    studentId:  string,
    assessedAt: string,
    term:       number,
    year:       number,
  ): Promise<void> {
    const { error } = await this.db
      .from('learner_profiles')
      .update({
        last_assessment_date: assessedAt,
        current_term:         term,
        current_year:         year,
      })
      .eq('student_id', studentId)

    if (error) throw new Error(`markAssessmentDate: ${error.message}`)
  }

  async snapshotTermEnd(
    studentId: string,
    term:      number,
    year:      number,
  ): Promise<void> {
    const profile = await this.getOrCreateLearnerProfile(studentId)

    const snapshot: TermSnapshot = {
      term,
      year,
      snapped_at:  new Date().toISOString(),
      risk_level:  profile.overall_risk_level,
      capability_summary: Object.fromEntries(
        Object.entries(profile.capability_dimensions as Record<string, { level: string; raw_score: number }>)
          .map(([k, v]) => [k, { level: v?.level ?? 'emerging', score: v?.raw_score ?? 0 }]),
      ),
      knowledge_summary: Object.fromEntries(
        Object.entries(profile.knowledge_state)
          .map(([k, v]) => [k, v.level]),
      ),
      pathway_readiness: {
        stem:            profile.pathway_readiness.stem.score,
        social_sciences: profile.pathway_readiness.social_sciences.score,
        arts_sports:     profile.pathway_readiness.arts_sports.score,
        technical_tvet:  profile.pathway_readiness.technical_tvet.score,
      },
    }

    const snapshots = [snapshot, ...profile.term_snapshots].slice(0, 12)

    const { error } = await this.db
      .from('learner_profiles')
      .update({ term_snapshots: snapshots })
      .eq('student_id', studentId)

    if (error) throw new Error(`snapshotTermEnd: ${error.message}`)
  }

  // ── Strand assessments (for capability history) ───────────────────────────────

  async findStudentAccessInfo(studentId: string): Promise<{
    user_id:        string | null
    parent_user_id: string | null
    teacher_id:     string | null
  } | null> {
    const { data, error } = await this.db
      .from('students')
      .select('user_id, parent_user_id, teacher_id')
      .eq('id', studentId)
      .maybeSingle()

    if (error) throw new Error(`findStudentAccessInfo: ${error.message}`)
    if (!data) return null

    return {
      user_id:        data.user_id as string | null,
      parent_user_id: data.parent_user_id as string | null,
      teacher_id:     data.teacher_id as string | null,
    }
  }

  async findStudentBasicInfo(studentId: string): Promise<{
    name:            string
    grade:           number
    school:          string | null
    term:            number | null
    year:            number | null
    current_pathway: string | null
  } | null> {
    const { data, error } = await this.db
      .from('students')
      .select('name, grade, school, term, year, current_pathway')
      .eq('id', studentId)
      .maybeSingle()

    if (error) throw new Error(`findStudentBasicInfo: ${error.message}`)
    if (!data) return null

    return {
      name:            data.name as string,
      grade:           data.grade as number,
      school:          data.school as string | null,
      term:            data.term as number | null,
      year:            data.year as number | null,
      current_pathway: data.current_pathway as string | null,
    }
  }

  async findAssessmentHistory(
    studentId: string,
  ): Promise<Array<{ subject_scores: Record<string, number>; created_at: string }>> {
    // NOTE: capability scoring reads term-level subject_scores from `assessments`,
    // not per-topic ratings from `strand_assessments` (that table has no
    // subject_scores column at all — verified against the live schema).
    //
    // `created_at` is returned (Phase H, additive) so callers blending this
    // history with another chronological source (Projection's evidence-derived
    // history, via projectionToTimestampedScoreHistory) can interleave both
    // in true time order rather than concatenating two separately-sorted
    // arrays — see lib/career/careerEngine.ts's recomputeAndSaveCapabilityProfile.
    const { data, error } = await this.db
      .from('assessments')
      .select('subject_scores, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true })

    if (error) throw new Error(`findAssessmentHistory: ${error.message}`)
    return (data ?? [])
      .filter(r => r.subject_scores && typeof r.subject_scores === 'object')
      .map(r => ({ subject_scores: r.subject_scores as Record<string, number>, created_at: r.created_at }))
  }

  // ── Capability history ────────────────────────────────────────────────────────

  async insertCapabilityHistory(row: {
    student_id:         string
    capability_profile: Record<string, unknown>
    assessment_count:   number
    computed_at:        string
  }): Promise<void> {
    await this.db.from('capability_history').insert(row)
  }

  // ── Class enrollment ─────────────────────────────────────────────────────────

  async findClassEnrollment(
    studentId: string,
  ): Promise<{
    class_id: string
    teacher_classes: {
      id: string
      teacher_id: string
      subject: string
      grade: number
    } | null
  } | null> {
    const { data } = await this.db
      .from('class_students')
      .select('class_id, teacher_classes(id, teacher_id, subject, grade)')
      .eq('student_id', studentId)
      .limit(1)
      .maybeSingle()

    if (!data) return null

    const rawCls = data.teacher_classes
    const cls = (Array.isArray(rawCls) ? rawCls[0] : rawCls) as {
      id: string
      teacher_id: string
      subject: string
      grade: number
    } | null

    return {
      class_id:        data.class_id as string,
      teacher_classes: cls,
    }
  }

  // A student can be enrolled in more than one class (different subjects) —
  // unlike findClassEnrollment's single-row shortcut above, this returns
  // every class_id so cache invalidation doesn't miss any of them.
  async findClassIdsForStudent(studentId: string): Promise<string[]> {
    const { data } = await this.db
      .from('class_students')
      .select('class_id')
      .eq('student_id', studentId)
    return (data ?? []).map(r => r.class_id as string)
  }

  // Forces the next Monday Panel request for these classes to recompute
  // instead of serving a stale (up to 24h) cached snapshot — called whenever
  // an evidence correction changes a projection for a student in the class.
  async invalidateMondayPanelCache(classIds: string[]): Promise<void> {
    if (classIds.length === 0) return
    await this.db.from('monday_panel_cache').delete().in('class_id', classIds)
  }

  // ── Knowledge graph prerequisite check ───────────────────────────────────────

  async findWeakKnowledgeNodes(
    concepts: string[],
  ): Promise<Array<{ id: string; concept: string }>> {
    if (concepts.length === 0) return []
    const { data } = await this.db
      .from('knowledge_nodes')
      .select('id, concept')
      .in('concept', concepts.slice(0, 10))
    return data ?? []
  }

  async findPrerequisiteEdges(
    dependentNodeIds: string[],
  ): Promise<Array<{ prerequisite_node_id: string; dependent_node_id: string }>> {
    if (dependentNodeIds.length === 0) return []
    const { data } = await this.db
      .from('knowledge_edges')
      .select('prerequisite_node_id, dependent_node_id')
      .in('dependent_node_id', dependentNodeIds)
    return data ?? []
  }

  async findPrerequisiteNodes(
    nodeIds: string[],
    limit = 3,
  ): Promise<Array<{ id: string; concept: string }>> {
    if (nodeIds.length === 0) return []
    const { data } = await this.db
      .from('knowledge_nodes')
      .select('id, concept')
      .in('id', nodeIds)
      .limit(limit)
    return data ?? []
  }

  // ── Career signals refresh helpers ────────────────────────────────────────────

  async findRecentCareerInterests(
    studentId: string,
    limit = 10,
  ): Promise<Array<{ career_slug: string; interest_level: number }>> {
    const { data } = await this.db
      .from('student_career_interests')
      .select('career_slug, interest_level')
      .eq('student_id', studentId)
      .order('explored_at', { ascending: false })
      .limit(limit)
    return (data ?? []) as Array<{ career_slug: string; interest_level: number }>
  }

  async findLatestStrandAssessment(
    studentId: string,
  ): Promise<{ subject_scores: Record<string, number> } | null> {
    const { data } = await this.db
      .from('strand_assessments')
      .select('subject_scores')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) return null
    return { subject_scores: (data.subject_scores as Record<string, number>) ?? {} }
  }

  async findFormativeSignalsForStudent(
    studentId: string,
    since:     string,
    limit = 5,
  ): Promise<Array<{ subject: string | null; sub_strand: string | null; got_it_ids: string[]; confused_ids: string[]; lost_ids: string[] }>> {
    const { data } = await this.db
      .from('formative_signals')
      .select('subject, sub_strand, got_it_ids, confused_ids, lost_ids')
      .contains('got_it_ids', [studentId])
      .gte('recorded_at', since)
      .limit(limit)
    return (data ?? []).map(r => ({
      subject:      r.subject      as string | null,
      sub_strand:   r.sub_strand   as string | null,
      got_it_ids:   (r.got_it_ids  as string[]) ?? [],
      confused_ids: (r.confused_ids as string[]) ?? [],
      lost_ids:     (r.lost_ids    as string[]) ?? [],
    }))
  }

  async findConcernFormativeSignals(
    studentId: string,
    since:     string,
    limit = 3,
  ): Promise<Array<{ subject: string | null; sub_strand: string | null }>> {
    const { data } = await this.db
      .from('formative_signals')
      .select('subject, sub_strand')
      .contains('lost_ids', [studentId])
      .gte('recorded_at', since)
      .limit(limit)
    return (data ?? []).map(r => ({
      subject:    r.subject    as string | null,
      sub_strand: r.sub_strand as string | null,
    }))
  }
}

export const learnerModelRepository = new LearnerModelRepository()
