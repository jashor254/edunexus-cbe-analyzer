import { repos } from '@/lib/repositories'
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

export async function getTeacherGradeScales(teacherId: string): Promise<DbGradeScale[]> {
  return repos.assessments.findGradeScalesByTeacher(teacherId)
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
  return repos.assessments.upsertGradeScale(teacherId, input)
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
  return repos.assessments.updateGradeScaleRecord(id, teacherId, input)
}

export async function deleteGradeScale(id: string, teacherId: string): Promise<void> {
  return repos.assessments.deleteGradeScale(id, teacherId)
}
