import { repos } from '@/lib/repositories'
import type { AcademyEvidence, EvidenceInput, RecentPlan } from './types'

export async function getEvidenceForLesson(
  teacherId: string,
  lessonId: string
): Promise<AcademyEvidence[]> {
  return repos.academy.findEvidenceForLesson(teacherId, lessonId)
}

export async function getEvidenceForModule(
  teacherId: string,
  lessonIds: string[]
): Promise<Record<string, AcademyEvidence[]>> {
  if (!lessonIds.length) return {}

  const rows = await repos.academy.findEvidenceForLessons(teacherId, lessonIds)

  const map: Record<string, AcademyEvidence[]> = {}
  for (const row of rows) {
    if (!map[row.lesson_id]) map[row.lesson_id] = []
    map[row.lesson_id].push(row)
  }
  return map
}

export async function addEvidence(
  teacherId: string,
  input: EvidenceInput
): Promise<AcademyEvidence> {
  return repos.academy.insertEvidence(teacherId, input)
}

export async function deleteEvidence(
  teacherId: string,
  evidenceId: string
): Promise<void> {
  await repos.academy.deleteEvidence(teacherId, evidenceId)
}

export async function getRecentPlans(
  teacherId: string,
  limit = 20
): Promise<RecentPlan[]> {
  return repos.academy.findRecentPlans(teacherId, limit)
}

export async function getEvidenceStats(teacherId: string): Promise<{
  total: number
  byType: Record<string, number>
}> {
  const rows = await repos.academy.findEvidenceTypes(teacherId)

  const byType: Record<string, number> = {}
  for (const r of rows) {
    byType[r.evidence_type] = (byType[r.evidence_type] ?? 0) + 1
  }
  return { total: rows.length, byType }
}
