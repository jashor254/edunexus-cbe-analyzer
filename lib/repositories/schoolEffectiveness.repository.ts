import { BaseRepository } from './base'
import type { SourcedRating, SchoolEffectivenessProfile } from '@/lib/schoolEffectiveness/types'

// Data access for the School Effectiveness Check (ADR-0034). Its own
// dedicated repository per the Evidence Domain precedent — one repository per
// new domain concept, never bolted onto an existing mixed-bag surface. The
// table is Intelligence-owned (RAS §9); callers must already be authorized
// (the Application Layer's permission check) before reaching this repository.

export type SchoolEffectivenessCheckRow = {
  id: string
  school_id: string
  framework_version: string
  ratings: SourcedRating[]
  profile: SchoolEffectivenessProfile
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type NewSchoolEffectivenessCheck = {
  school_id: string
  framework_version: string
  ratings: SourcedRating[]
  profile: SchoolEffectivenessProfile
  created_by: string
}

const COLS =
  'id, school_id, framework_version, ratings, profile, created_by, updated_by, created_at, updated_at'

export class SchoolEffectivenessRepository extends BaseRepository {
  async create(input: NewSchoolEffectivenessCheck): Promise<SchoolEffectivenessCheckRow> {
    const { data, error } = await this.db
      .from('school_effectiveness_checks')
      .insert(input)
      .select(COLS)
      .single()
    if (error || !data) {
      throw new Error(`SchoolEffectivenessRepository.create failed: ${error?.message}`)
    }
    return data as SchoolEffectivenessCheckRow
  }

  async findLatestForSchool(schoolId: string): Promise<SchoolEffectivenessCheckRow | null> {
    const { data, error } = await this.db
      .from('school_effectiveness_checks')
      .select(COLS)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      throw new Error(`SchoolEffectivenessRepository.findLatestForSchool failed: ${error.message}`)
    }
    return (data as SchoolEffectivenessCheckRow | null) ?? null
  }
}
