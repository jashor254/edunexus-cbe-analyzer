import { repos } from '@/lib/repositories'
import { publishEvent } from '@/lib/events'
import type {
  AcademyMission,
  MissionCompletion,
  MissionWithCompletion,
  MissionVerdict,
} from './types'

export async function getMissionsForModule(
  moduleId: string,
  teacherId: string
): Promise<MissionWithCompletion[]> {
  const missions = await repos.academy.findMissionsByModule(moduleId)
  if (!missions.length) return []

  const missionIds = missions.map(m => m.id)
  const completions = await repos.academy.findMissionCompletions(teacherId, missionIds)

  const completionMap = new Map(
    completions.map(c => [c.mission_id, c])
  )

  return missions.map(m => ({
    ...(m as AcademyMission),
    completion: completionMap.get(m.id) ?? null,
  }))
}

export async function getMission(
  missionId: string,
  teacherId: string
): Promise<MissionWithCompletion | null> {
  const mission = await repos.academy.findMission(missionId)
  if (!mission) return null

  const completion = await repos.academy.findMissionCompletion(teacherId, missionId)

  return {
    ...(mission as AcademyMission),
    completion: (completion as MissionCompletion) ?? null,
  }
}

export async function upsertMissionCompletion(
  teacherId: string,
  missionId: string,
  toolAOutput: string,
  toolBOutput: string,
  comparisonNotes: string,
  selfScores: Record<string, number>,
  verdict: MissionVerdict
): Promise<MissionCompletion> {
  // Fetch mission to get module_id for the event payload
  const mission = await repos.academy.findMission(missionId)
  const moduleId = (mission as AcademyMission | null)?.module_id ?? ''

  const completion = await repos.academy.upsertMissionCompletion(
    teacherId,
    missionId,
    toolAOutput,
    toolBOutput,
    comparisonNotes,
    selfScores,
    verdict
  )

  void publishEvent({
    event_type:      'student.milestone.achieved',
    resource_type:   'mission_completion',
    resource_id:     completion.id,
    actor_id:        teacherId,
    payload: {
      mission_id: missionId,
      teacher_id: teacherId,
      module_id:  moduleId,
    },
    idempotency_key: `student.milestone.achieved:${missionId}:${completion.id}`,
  }).catch(err => console.error('[events] student.milestone.achieved:', err instanceof Error ? err.message : String(err)))

  return completion
}

export async function recordXpEvent(
  teacherId: string,
  eventType: string,
  xpEarned: number,
  metadata: Record<string, unknown>
): Promise<void> {
  await repos.academy.insertXpEvent(teacherId, eventType, xpEarned, metadata)
}

export async function getTotalXp(teacherId: string): Promise<number> {
  return repos.academy.findTotalXp(teacherId)
}
