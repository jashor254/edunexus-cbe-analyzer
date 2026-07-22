import { BaseRepository } from '@/lib/repositories/base'
import type { GrowthActivity, GrowthActivityType } from '@/lib/growth/types'

const ACTIVITY_COLS =
  'id, school_id, contact_id, type, notes, occurred_at, created_by, created_at'

export type ActivityInsert = {
  school_id: string
  contact_id: string | null
  type: GrowthActivityType
  notes: string | null
  occurred_at: string
  created_by: string
}

export class GrowthActivityRepository extends BaseRepository {
  async listBySchool(schoolId: string): Promise<GrowthActivity[]> {
    const { data, error } = await this.db
      .from('growth_activities')
      .select(ACTIVITY_COLS)
      .eq('school_id', schoolId)
      .order('occurred_at', { ascending: false })
    if (error) throw new Error(`GrowthActivityRepository.listBySchool: ${error.message}`)
    return data ?? []
  }

  /** Most recent activity across all schools, one row per school — used by "Waiting For" / "At Risk". */
  async lastActivityPerSchool(): Promise<Map<string, string>> {
    const { data, error } = await this.db
      .from('growth_activities')
      .select('school_id, occurred_at')
      .order('occurred_at', { ascending: false })
    if (error) throw new Error(`GrowthActivityRepository.lastActivityPerSchool: ${error.message}`)
    const result = new Map<string, string>()
    for (const row of data ?? []) {
      if (!result.has(row.school_id)) result.set(row.school_id, row.occurred_at)
    }
    return result
  }

  /**
   * Sprint PO-5 (Mission Control) — every activity logged since a given
   * instant, across all schools, one query. Backs the "This Week" counters
   * and the Recent Wins testimonial/referral-notes heuristic — both need to
   * scan recent activity globally, not per-school.
   */
  async listSince(sinceIso: string): Promise<GrowthActivity[]> {
    const { data, error } = await this.db
      .from('growth_activities')
      .select(ACTIVITY_COLS)
      .gte('occurred_at', sinceIso)
      .order('occurred_at', { ascending: false })
    if (error) throw new Error(`GrowthActivityRepository.listSince: ${error.message}`)
    return data ?? []
  }

  async insert(input: ActivityInsert): Promise<GrowthActivity> {
    const { data, error } = await this.db.from('growth_activities').insert(input).select(ACTIVITY_COLS).single()
    if (error) throw new Error(`GrowthActivityRepository.insert: ${error.message}`)
    return data
  }
}
