import { createServiceClient } from '@/utils/supabase/service'
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
  const db = createServiceClient()

  const { data: missions, error } = await db
    .from('academy_missions')
    .select('id, module_id, phase, title, description, instructions, mission_type, tool_a_label, tool_b_label, tool_a_prompt, tool_b_link, evaluation_rubric, xp_reward, order, published, created_at')
    .eq('module_id', moduleId)
    .eq('published', true)
    .order('order')

  if (error) throw new Error(`Failed to fetch missions: ${error.message}`)
  if (!missions?.length) return []

  const missionIds = missions.map(m => m.id)

  const { data: completions } = await db
    .from('academy_mission_completions')
    .select('id, teacher_id, mission_id, tool_a_output, tool_b_output, comparison_notes, self_scores, ai_score, ai_verdict, completed_at, updated_at')
    .eq('teacher_id', teacherId)
    .in('mission_id', missionIds)

  const completionMap = new Map(
    (completions ?? []).map(c => [c.mission_id, c as MissionCompletion])
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
  const db = createServiceClient()

  const { data: mission, error } = await db
    .from('academy_missions')
    .select('id, module_id, phase, title, description, instructions, mission_type, tool_a_label, tool_b_label, tool_a_prompt, tool_b_link, evaluation_rubric, xp_reward, order, published, created_at')
    .eq('id', missionId)
    .eq('published', true)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch mission: ${error.message}`)
  if (!mission) return null

  const { data: completion } = await db
    .from('academy_mission_completions')
    .select('id, teacher_id, mission_id, tool_a_output, tool_b_output, comparison_notes, self_scores, ai_score, ai_verdict, completed_at, updated_at')
    .eq('teacher_id', teacherId)
    .eq('mission_id', missionId)
    .maybeSingle()

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
  const db = createServiceClient()

  const { data, error } = await db
    .from('academy_mission_completions')
    .upsert(
      {
        teacher_id:       teacherId,
        mission_id:       missionId,
        tool_a_output:    toolAOutput,
        tool_b_output:    toolBOutput,
        comparison_notes: comparisonNotes,
        self_scores:      selfScores,
        ai_score:         verdict.ai_score,
        ai_verdict:       verdict.ai_verdict,
        updated_at:       new Date().toISOString(),
      },
      { onConflict: 'teacher_id,mission_id' }
    )
    .select('id, teacher_id, mission_id, tool_a_output, tool_b_output, comparison_notes, self_scores, ai_score, ai_verdict, completed_at, updated_at')
    .single()

  if (error) throw new Error(`Failed to save mission completion: ${error.message}`)
  return data as MissionCompletion
}

export async function recordXpEvent(
  teacherId: string,
  eventType: string,
  xpEarned: number,
  metadata: Record<string, unknown>
): Promise<void> {
  const db = createServiceClient()
  const { error } = await db
    .from('academy_xp_events')
    .insert({ teacher_id: teacherId, event_type: eventType, xp_earned: xpEarned, metadata })
  if (error) throw new Error(`Failed to record XP: ${error.message}`)
}

export async function getTotalXp(teacherId: string): Promise<number> {
  const db = createServiceClient()
  const { data } = await db
    .from('academy_xp_events')
    .select('xp_earned')
    .eq('teacher_id', teacherId)
  return (data ?? []).reduce((sum, e) => sum + (e.xp_earned ?? 0), 0)
}
