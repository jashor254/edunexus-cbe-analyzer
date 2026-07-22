import { BaseRepository } from '@/lib/repositories/base'
import type { GrowthContact, GrowthContactRole, GrowthPreferredContact } from '@/lib/growth/types'

const CONTACT_COLS =
  'id, school_id, role, full_name, phone, email, preferred_contact, relationship_score, notes, created_at, updated_at'

export type ContactInsert = {
  school_id: string
  full_name: string
  role: GrowthContactRole | null
  phone: string | null
  email: string | null
  preferred_contact: GrowthPreferredContact | null
  relationship_score: number | null
  notes: string | null
}

export class GrowthContactRepository extends BaseRepository {
  async listBySchool(schoolId: string): Promise<GrowthContact[]> {
    const { data, error } = await this.db
      .from('growth_contacts')
      .select(CONTACT_COLS)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(`GrowthContactRepository.listBySchool: ${error.message}`)
    return data ?? []
  }

  async insert(input: ContactInsert): Promise<GrowthContact> {
    const { data, error } = await this.db.from('growth_contacts').insert(input).select(CONTACT_COLS).single()
    if (error) throw new Error(`GrowthContactRepository.insert: ${error.message}`)
    return data
  }

  /**
   * Sprint PO-5 (Mission Control) — one batched query for "which schools have
   * at least one contact on file," used to compute the At Risk section's
   * "missing contact" reason without a per-school query loop (CLAUDE.md: no
   * queries inside a loop).
   */
  async listDistinctSchoolIdsWithContacts(): Promise<Set<string>> {
    const { data, error } = await this.db.from('growth_contacts').select('school_id')
    if (error) throw new Error(`GrowthContactRepository.listDistinctSchoolIdsWithContacts: ${error.message}`)
    return new Set((data ?? []).map((r) => r.school_id as string))
  }

  /**
   * Sprint PE-6 (Pilot Targeting Engine) — one batched query for "who do we
   * ask for at each school," so next-action phrasing ("WhatsApp the
   * deputy") never costs a query per school (CLAUDE.md: no queries inside
   * a loop). First-added contact per school wins — same "earliest, not
   * newest" convention as growth_activities' lastActivityPerSchool uses in
   * reverse.
   */
  async listFirstContactPerSchool(): Promise<Map<string, GrowthContact>> {
    const { data, error } = await this.db
      .from('growth_contacts')
      .select(CONTACT_COLS)
      .order('created_at', { ascending: true })
    if (error) throw new Error(`GrowthContactRepository.listFirstContactPerSchool: ${error.message}`)
    const result = new Map<string, GrowthContact>()
    for (const row of data ?? []) {
      if (!result.has(row.school_id)) result.set(row.school_id, row)
    }
    return result
  }
}
