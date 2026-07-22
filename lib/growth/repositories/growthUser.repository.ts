import { BaseRepository } from '@/lib/repositories/base'

const COLS = 'id, full_name, role, created_at, updated_at'

export type GrowthUserRow = {
  id: string
  full_name: string
  role: 'founder'
  created_at: string
  updated_at: string
}

export class GrowthUserRepository extends BaseRepository {
  async findById(id: string): Promise<GrowthUserRow | null> {
    const { data, error } = await this.db.from('growth_users').select(COLS).eq('id', id).maybeSingle()
    if (error) throw new Error(`GrowthUserRepository.findById: ${error.message}`)
    return data
  }

  /** Self-registers the caller as the (Mode 1: sole) Growth OS user on first use. */
  async ensure(id: string, fullName: string): Promise<GrowthUserRow> {
    const existing = await this.findById(id)
    if (existing) return existing
    const { data, error } = await this.db
      .from('growth_users')
      .insert({ id, full_name: fullName })
      .select(COLS)
      .single()
    if (error) throw new Error(`GrowthUserRepository.ensure: ${error.message}`)
    return data
  }

  /**
   * Sprint PE-2 (Pilot Discovery Engine) — the CSV importer runs as a script,
   * not a request, so it has no authenticated caller to attribute imported
   * rows to. Mode 1 (docs/growth-os/edunexus-growth-engine-specification.md)
   * guarantees exactly one founder row exists; this is the one place that
   * assumption is relied on directly.
   */
  async findSole(): Promise<GrowthUserRow> {
    const { data, error } = await this.db.from('growth_users').select(COLS).limit(2)
    if (error) throw new Error(`GrowthUserRepository.findSole: ${error.message}`)
    if (!data || data.length === 0) {
      throw new Error('No growth_users row exists yet — sign in to the Growth Engine once before running the importer.')
    }
    if (data.length > 1) {
      throw new Error('More than one growth_users row exists — findSole() assumes Mode 1 (single founder) and cannot pick one automatically.')
    }
    return data[0]
  }
}
