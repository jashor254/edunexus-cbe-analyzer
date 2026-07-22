import { growthRepos } from '@/lib/growth/repositories'
import type { GrowthFollowUp, NewGrowthFollowUp } from '@/lib/growth/types'

export async function listFollowUpsForSchool(schoolId: string): Promise<GrowthFollowUp[]> {
  return growthRepos.followUps.listBySchool(schoolId)
}

/** The global "what's due" list — every open follow-up across every school, due-date ascending. */
export async function listOpenFollowUps(): Promise<GrowthFollowUp[]> {
  return growthRepos.followUps.listOpen()
}

export async function createFollowUp(input: NewGrowthFollowUp, createdBy: string): Promise<GrowthFollowUp> {
  return growthRepos.followUps.insert({
    school_id: input.schoolId,
    task: input.task,
    due_date: input.dueDate,
    priority: input.priority ?? 'normal',
    created_by: createdBy,
  })
}

export async function completeFollowUp(id: string): Promise<GrowthFollowUp> {
  return growthRepos.followUps.complete(id)
}

export async function rescheduleFollowUp(id: string, dueDate: string): Promise<GrowthFollowUp> {
  return growthRepos.followUps.reschedule(id, dueDate)
}
