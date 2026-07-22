import { BaseRepository } from '@/lib/repositories/base'
import type { GrowthFollowUp, GrowthFollowUpPriority } from '@/lib/growth/types'

const FOLLOW_UP_COLS =
  'id, school_id, task, due_date, priority, completed, completed_at, created_by, created_at, updated_at'

export type FollowUpInsert = {
  school_id: string
  task: string
  due_date: string
  priority: GrowthFollowUpPriority
  created_by: string
}

export class GrowthFollowUpRepository extends BaseRepository {
  async listBySchool(schoolId: string): Promise<GrowthFollowUp[]> {
    const { data, error } = await this.db
      .from('growth_follow_ups')
      .select(FOLLOW_UP_COLS)
      .eq('school_id', schoolId)
      .order('due_date', { ascending: true })
    if (error) throw new Error(`GrowthFollowUpRepository.listBySchool: ${error.message}`)
    return data ?? []
  }

  /** Every open follow-up across all schools, due-date ascending — the global Follow-ups list. */
  async listOpen(): Promise<GrowthFollowUp[]> {
    const { data, error } = await this.db
      .from('growth_follow_ups')
      .select(FOLLOW_UP_COLS)
      .eq('completed', false)
      .order('due_date', { ascending: true })
    if (error) throw new Error(`GrowthFollowUpRepository.listOpen: ${error.message}`)
    return data ?? []
  }

  async insert(input: FollowUpInsert): Promise<GrowthFollowUp> {
    const { data, error } = await this.db.from('growth_follow_ups').insert(input).select(FOLLOW_UP_COLS).single()
    if (error) throw new Error(`GrowthFollowUpRepository.insert: ${error.message}`)
    return data
  }

  async complete(id: string): Promise<GrowthFollowUp> {
    const { data, error } = await this.db
      .from('growth_follow_ups')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', id)
      .select(FOLLOW_UP_COLS)
      .single()
    if (error) throw new Error(`GrowthFollowUpRepository.complete: ${error.message}`)
    return data
  }

  async reschedule(id: string, dueDate: string): Promise<GrowthFollowUp> {
    const { data, error } = await this.db
      .from('growth_follow_ups')
      .update({ due_date: dueDate })
      .eq('id', id)
      .select(FOLLOW_UP_COLS)
      .single()
    if (error) throw new Error(`GrowthFollowUpRepository.reschedule: ${error.message}`)
    return data
  }
}
