import { BaseRepository } from '@/lib/repositories/base'
import type { GrowthSchool, GrowthPipelineStage, GrowthSchoolStatus } from '@/lib/growth/types'

const SCHOOL_COLS =
  'id, name, county, category, students_count, status, pipeline_stage, next_action, next_action_date, owner_id, notes, contact_source, existing_ict_activity, selection_reason, phone, website, email, google_place_id, google_maps_url, google_rating, google_review_count, business_status, whatsapp_number, discovery_score, contact_quality, starred, last_contact_at, created_by, created_at, updated_at'

export type SchoolInsert = {
  name: string
  county: string | null
  category: string | null
  students_count: number | null
  notes: string | null
  contact_source: string | null
  existing_ict_activity: string | null
  selection_reason: string | null
  phone?: string | null
  website?: string | null
  email?: string | null
  google_place_id?: string | null
  google_maps_url?: string | null
  google_rating?: number | null
  google_review_count?: number | null
  business_status?: string | null
  whatsapp_number?: string | null
  discovery_score?: number | null
  contact_quality?: string | null
  created_by: string
}

export type SchoolUpdate = Partial<{
  name: string
  county: string | null
  category: string | null
  students_count: number | null
  status: GrowthSchoolStatus
  next_action: string | null
  next_action_date: string | null
  notes: string | null
  contact_source: string | null
  existing_ict_activity: string | null
  selection_reason: string | null
  last_contact_at: string
  pipeline_stage: GrowthPipelineStage
  starred: boolean
}>

export class GrowthSchoolRepository extends BaseRepository {
  async findById(id: string): Promise<GrowthSchool | null> {
    const { data, error } = await this.db.from('growth_schools').select(SCHOOL_COLS).eq('id', id).maybeSingle()
    if (error) throw new Error(`GrowthSchoolRepository.findById: ${error.message}`)
    return data
  }

  async list(): Promise<GrowthSchool[]> {
    const { data, error } = await this.db
      .from('growth_schools')
      .select(SCHOOL_COLS)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`GrowthSchoolRepository.list: ${error.message}`)
    return data ?? []
  }

  /** Fuzzy dedup check at creation — case/whitespace-insensitive exact-ish match on name. */
  async findByNameFuzzy(name: string): Promise<GrowthSchool | null> {
    const { data, error } = await this.db
      .from('growth_schools')
      .select(SCHOOL_COLS)
      .ilike('name', name.trim().replace(/\s+/g, ' '))
      .maybeSingle()
    if (error) throw new Error(`GrowthSchoolRepository.findByNameFuzzy: ${error.message}`)
    return data
  }

  /** Sprint PE-2 (Pilot Discovery Engine) — the importer's primary dedup key, enforced at the DB level by a partial unique index. */
  async findByPlaceId(placeId: string): Promise<GrowthSchool | null> {
    const { data, error } = await this.db
      .from('growth_schools')
      .select(SCHOOL_COLS)
      .eq('google_place_id', placeId)
      .maybeSingle()
    if (error) throw new Error(`GrowthSchoolRepository.findByPlaceId: ${error.message}`)
    return data
  }

  async insert(input: SchoolInsert): Promise<GrowthSchool> {
    const { data, error } = await this.db.from('growth_schools').insert(input).select(SCHOOL_COLS).single()
    if (error) throw new Error(`GrowthSchoolRepository.insert: ${error.message}`)
    return data
  }

  async update(id: string, patch: SchoolUpdate): Promise<GrowthSchool> {
    const { data, error } = await this.db
      .from('growth_schools')
      .update(patch)
      .eq('id', id)
      .select(SCHOOL_COLS)
      .single()
    if (error) throw new Error(`GrowthSchoolRepository.update: ${error.message}`)
    return data
  }
}
