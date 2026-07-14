import { BaseRepository } from './base'

// Data access for Phase G — evidence purposes
// (docs/architecture/learner-record-layer-decisions.md Decision 2). Small,
// platform-governed, read-mostly — no create/update methods here, since no
// document ratified a write path for this table yet (it's seeded by
// migration only, same as curriculum_versions in Phase -1).

export type EvidencePurposeRow = {
  id: string
  code: string
  label: string
  applies_to: string[]
  created_at: string
}

const COLS = 'id, code, label, applies_to, created_at'

export class EvidencePurposeRepository extends BaseRepository {
  async findAll(): Promise<EvidencePurposeRow[]> {
    const { data, error } = await this.db.from('evidence_purposes').select(COLS).order('label', { ascending: true })
    if (error) throw new Error(`findAll: ${error.message}`)
    return data ?? []
  }

  async findByCode(code: string): Promise<EvidencePurposeRow | null> {
    const { data, error } = await this.db.from('evidence_purposes').select(COLS).eq('code', code).maybeSingle()
    if (error) throw new Error(`findByCode: ${error.message}`)
    return data
  }
}
