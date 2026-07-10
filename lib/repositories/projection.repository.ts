import { BaseRepository } from './base'
import type { ProjectorType } from '@/lib/projection/types'

const PROJECTION_COLS =
  'id, learner_id, projector_type, projection_version, value, supporting_evidence_ids, confidence, ' +
  'evidence_count, evidence_diversity, latest_evidence_at, oldest_evidence_at, coverage, freshness_days, last_computed'

export type ProjectionRow = {
  id: string
  learner_id: string
  projector_type: ProjectorType
  projection_version: string
  value: unknown
  supporting_evidence_ids: string[]
  confidence: number
  evidence_count: number
  evidence_diversity: number
  latest_evidence_at: string | null
  oldest_evidence_at: string | null
  coverage: number | null
  freshness_days: number | null
  last_computed: string
}

export type UpsertProjectionInput = Omit<ProjectionRow, 'id'>

export class ProjectionRepository extends BaseRepository {
  async upsertProjection(input: UpsertProjectionInput): Promise<ProjectionRow> {
    const { data, error } = await this.db
      .from('learner_projections')
      .upsert(input, { onConflict: 'learner_id,projector_type' })
      .select(PROJECTION_COLS)
      .single()
    if (error) throw new Error(`upsertProjection: ${error.message}`)
    return data as unknown as ProjectionRow
  }

  async deleteProjection(learnerId: string, projectorType: ProjectorType): Promise<void> {
    const { error } = await this.db
      .from('learner_projections')
      .delete()
      .eq('learner_id', learnerId)
      .eq('projector_type', projectorType)
    if (error) throw new Error(`deleteProjection: ${error.message}`)
  }

  async findProjectionsForLearner(learnerId: string): Promise<ProjectionRow[]> {
    const { data, error } = await this.db
      .from('learner_projections')
      .select(PROJECTION_COLS)
      .eq('learner_id', learnerId)
    if (error) throw new Error(`findProjectionsForLearner: ${error.message}`)
    return data as unknown as ProjectionRow[]
  }

  async findProjectionsForLearners(learnerIds: string[]): Promise<ProjectionRow[]> {
    if (learnerIds.length === 0) return []
    const { data, error } = await this.db
      .from('learner_projections')
      .select(PROJECTION_COLS)
      .in('learner_id', learnerIds)
    if (error) throw new Error(`findProjectionsForLearners: ${error.message}`)
    return data as unknown as ProjectionRow[]
  }
}
