import { createServiceClient } from '@/utils/supabase/service'
import type { AcademyEvidence, EvidenceInput, RecentPlan } from './types'

const EVIDENCE_COLS = 'id, teacher_id, lesson_id, evidence_type, content, linked_id, linked_title, description, created_at, updated_at'

export async function getEvidenceForLesson(
  teacherId: string,
  lessonId: string
): Promise<AcademyEvidence[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('academy_evidence')
    .select(EVIDENCE_COLS)
    .eq('teacher_id', teacherId)
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch evidence: ${error.message}`)
  return (data ?? []) as AcademyEvidence[]
}

export async function getEvidenceForModule(
  teacherId: string,
  lessonIds: string[]
): Promise<Record<string, AcademyEvidence[]>> {
  if (!lessonIds.length) return {}

  const db = createServiceClient()
  const { data, error } = await db
    .from('academy_evidence')
    .select(EVIDENCE_COLS)
    .eq('teacher_id', teacherId)
    .in('lesson_id', lessonIds)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch module evidence: ${error.message}`)

  const map: Record<string, AcademyEvidence[]> = {}
  for (const row of (data ?? []) as AcademyEvidence[]) {
    if (!map[row.lesson_id]) map[row.lesson_id] = []
    map[row.lesson_id].push(row)
  }
  return map
}

export async function addEvidence(
  teacherId: string,
  input: EvidenceInput
): Promise<AcademyEvidence> {
  const db = createServiceClient()

  const { data, error } = await db
    .from('academy_evidence')
    .insert({
      teacher_id:    teacherId,
      lesson_id:     input.lesson_id,
      evidence_type: input.evidence_type,
      content:       input.content || null,
      linked_id:     input.linked_id || null,
      linked_title:  input.linked_title || null,
      description:   input.description,
    })
    .select(EVIDENCE_COLS)
    .single()

  if (error) throw new Error(`Failed to add evidence: ${error.message}`)
  return data as AcademyEvidence
}

export async function deleteEvidence(
  teacherId: string,
  evidenceId: string
): Promise<void> {
  const db = createServiceClient()

  const { error } = await db
    .from('academy_evidence')
    .delete()
    .eq('id', evidenceId)
    .eq('teacher_id', teacherId) // ownership guard

  if (error) throw new Error(`Failed to delete evidence: ${error.message}`)
}

export async function getRecentPlans(
  teacherId: string,
  limit = 20
): Promise<RecentPlan[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('lesson_plans')
    .select('id, strand, sub_strand, week_number, lesson_number, taught_date, created_at')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Failed to fetch plans: ${error.message}`)
  return (data ?? []) as RecentPlan[]
}

export async function getEvidenceStats(teacherId: string): Promise<{
  total: number
  byType: Record<string, number>
}> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('academy_evidence')
    .select('evidence_type')
    .eq('teacher_id', teacherId)

  if (error) throw new Error(`Failed to fetch evidence stats: ${error.message}`)

  const rows = data ?? []
  const byType: Record<string, number> = {}
  for (const r of rows) {
    byType[r.evidence_type] = (byType[r.evidence_type] ?? 0) + 1
  }
  return { total: rows.length, byType }
}
