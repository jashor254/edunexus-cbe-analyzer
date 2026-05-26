import { createServiceClient } from '@/utils/supabase/service'
import type { GradeBand, CurriculumType } from './gradeCalculator'

export type DbGradeScale = {
  id:              string
  teacher_id:      string
  name:            string
  curriculum_hint: CurriculumType | 'custom'
  bands:           GradeBand[]
  is_default:      boolean
  created_at:      string
  updated_at:      string
}

const SCALE_COLS = 'id, teacher_id, name, curriculum_hint, bands, is_default, created_at, updated_at'

export async function getTeacherGradeScales(teacherId: string): Promise<DbGradeScale[]> {
  const db = createServiceClient()
  const { data } = await db
    .from('teacher_grade_scales')
    .select(SCALE_COLS)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: true })
  return data || []
}

export async function createGradeScale(
  teacherId: string,
  input: {
    name:           string
    curriculumHint: CurriculumType | 'custom'
    bands:          GradeBand[]
    isDefault?:     boolean
  }
): Promise<DbGradeScale> {
  const db = createServiceClient()

  if (input.isDefault) {
    await db.from('teacher_grade_scales').update({ is_default: false }).eq('teacher_id', teacherId)
  }

  const { data, error } = await db
    .from('teacher_grade_scales')
    .insert({
      teacher_id:      teacherId,
      name:            input.name,
      curriculum_hint: input.curriculumHint,
      bands:           input.bands,
      is_default:      input.isDefault ?? false,
    })
    .select(SCALE_COLS)
    .single()

  if (error) throw new Error('Failed to create grade scale')
  return data
}

export async function updateGradeScale(
  id: string,
  teacherId: string,
  input: {
    name?:           string
    curriculumHint?: CurriculumType | 'custom'
    bands?:          GradeBand[]
    isDefault?:      boolean
  }
): Promise<DbGradeScale> {
  const db = createServiceClient()

  if (input.isDefault) {
    await db.from('teacher_grade_scales').update({ is_default: false }).eq('teacher_id', teacherId)
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.name !== undefined)           updates.name = input.name
  if (input.curriculumHint !== undefined) updates.curriculum_hint = input.curriculumHint
  if (input.bands !== undefined)          updates.bands = input.bands
  if (input.isDefault !== undefined)      updates.is_default = input.isDefault

  const { data, error } = await db
    .from('teacher_grade_scales')
    .update(updates)
    .eq('id', id)
    .eq('teacher_id', teacherId)
    .select(SCALE_COLS)
    .single()

  if (error) throw new Error('Failed to update grade scale')
  return data
}

export async function deleteGradeScale(id: string, teacherId: string): Promise<void> {
  const db = createServiceClient()
  const { error } = await db
    .from('teacher_grade_scales')
    .delete()
    .eq('id', id)
    .eq('teacher_id', teacherId)
  if (error) throw new Error('Failed to delete grade scale')
}
