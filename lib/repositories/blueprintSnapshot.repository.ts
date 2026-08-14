// lib/repositories/blueprintSnapshot.repository.ts
//
// Owns blueprint_snapshots exclusively (Sprint 12K, ADR-0008 Part 3). No
// update/delete method exists here on purpose — the table's own DB triggers
// (trg_blueprint_snapshots_no_update/no_delete) enforce immutability even
// against a service-role caller; this repository's shape matches that by
// never offering a method that would only fail at the DB layer.

import { BaseRepository } from './base'
import type { LearnerBlueprint } from '@/lib/learnerBlueprint/types'
import type { LearnerId } from '@/lib/core/identityTypes'

export type BlueprintSnapshotType = 'report_card_publication' | 'end_of_term' | 'graduation'

export type BlueprintSnapshotProvenance = {
  trigger: BlueprintSnapshotType
  sourceRecordId: string | null
  actorUserId: string
}

export type BlueprintSnapshotRow = {
  id: string
  learner_id: LearnerId
  school_id: string
  academic_year_id: string | null
  term_id: string | null
  snapshot_type: BlueprintSnapshotType
  blueprint_payload: LearnerBlueprint
  provenance: BlueprintSnapshotProvenance
  schema_version: string
  created_at: string
  created_by: string | null
}

export type InsertBlueprintSnapshotInput = {
  learner_id: LearnerId
  school_id: string
  academic_year_id: string | null
  term_id: string | null
  snapshot_type: BlueprintSnapshotType
  blueprint_payload: LearnerBlueprint
  provenance: BlueprintSnapshotProvenance
  schema_version: string
  created_by: string | null
}

const SNAPSHOT_COLS =
  'id, learner_id, school_id, academic_year_id, term_id, snapshot_type, blueprint_payload, provenance, schema_version, created_at, created_by'

export class BlueprintSnapshotRepository extends BaseRepository {
  async insert(input: InsertBlueprintSnapshotInput): Promise<BlueprintSnapshotRow> {
    const { data, error } = await this.db
      .from('blueprint_snapshots')
      .insert(input)
      .select(SNAPSHOT_COLS)
      .single()
    if (error) throw new Error(`insertBlueprintSnapshot: ${error.message}`)
    return data as unknown as BlueprintSnapshotRow
  }

  async findById(snapshotId: string, schoolId: string): Promise<BlueprintSnapshotRow | null> {
    const { data, error } = await this.db
      .from('blueprint_snapshots')
      .select(SNAPSHOT_COLS)
      .eq('id', snapshotId)
      .eq('school_id', schoolId)
      .maybeSingle()
    if (error) throw new Error(`findBlueprintSnapshotById: ${error.message}`)
    return data as unknown as BlueprintSnapshotRow | null
  }

  async listForLearner(learnerId: string, schoolId: string): Promise<BlueprintSnapshotRow[]> {
    const { data, error } = await this.db
      .from('blueprint_snapshots')
      .select(SNAPSHOT_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`listBlueprintSnapshotsForLearner: ${error.message}`)
    return (data ?? []) as unknown as BlueprintSnapshotRow[]
  }

  /** Same ordering as {@link listForLearner}, limited to one row — no separate query shape, no new computation. */
  async getLatestForLearner(learnerId: string, schoolId: string): Promise<BlueprintSnapshotRow | null> {
    const { data, error } = await this.db
      .from('blueprint_snapshots')
      .select(SNAPSHOT_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`getLatestBlueprintSnapshotForLearner: ${error.message}`)
    return data as unknown as BlueprintSnapshotRow | null
  }
}
