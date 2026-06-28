import { createServiceClient } from '@/utils/supabase/service'
import type { Subject, GradeSubject, SubjectCategory } from '@/types/core'

const SUBJECT_COLS = 'id, name, code, category, is_core, created_at, updated_at'

export async function listSubjects(category?: SubjectCategory): Promise<Subject[]> {
  const supabase = createServiceClient()
  let query = supabase.from('subjects').select(SUBJECT_COLS).order('category').order('name')
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) throw new Error(`listSubjects: ${error.message}`)
  return data
}

export async function getSubject(subjectId: string): Promise<Subject> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('subjects')
    .select(SUBJECT_COLS)
    .eq('id', subjectId)
    .single()
  if (error) throw new Error(`getSubject: ${error.message}`)
  return data
}

export async function listGradeSubjects(
  schoolId: string,
  gradeId: string
): Promise<Array<GradeSubject & { subjects: Subject }>> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('grade_subjects')
    .select(`id, school_id, grade_id, subject_id, is_compulsory, created_at, updated_at, subjects (${SUBJECT_COLS})`)
    .eq('school_id', schoolId)
    .eq('grade_id', gradeId)
  if (error) throw new Error(`listGradeSubjects: ${error.message}`)
  return data as unknown as Array<GradeSubject & { subjects: Subject }>
}

export async function assignSubjectToGrade(
  schoolId: string,
  gradeId: string,
  subjectId: string,
  isCompulsory = true
): Promise<GradeSubject> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('grade_subjects')
    .upsert(
      { school_id: schoolId, grade_id: gradeId, subject_id: subjectId, is_compulsory: isCompulsory },
      { onConflict: 'school_id,grade_id,subject_id' }
    )
    .select('id, school_id, grade_id, subject_id, is_compulsory, created_at, updated_at')
    .single()
  if (error) throw new Error(`assignSubjectToGrade: ${error.message}`)
  return data
}

export async function removeSubjectFromGrade(
  schoolId: string,
  gradeId: string,
  subjectId: string
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('grade_subjects')
    .delete()
    .eq('school_id', schoolId)
    .eq('grade_id', gradeId)
    .eq('subject_id', subjectId)
  if (error) throw new Error(`removeSubjectFromGrade: ${error.message}`)
}

// ── Seed a school's grade_subjects from the global catalogue (CBC defaults) ──

export async function seedGradeSubjectsForSchool(schoolId: string): Promise<void> {
  const supabase = createServiceClient()

  const gradeMap: Record<string, string> = {}
  const { data: grades } = await supabase.from('grades').select('id, code')
  grades?.forEach((g) => { gradeMap[g.code] = g.id })

  const { data: subjects } = await supabase.from('subjects').select('id, code, category')

  const rows: Array<{ school_id: string; grade_id: string; subject_id: string; is_compulsory: boolean }> = []

  subjects?.forEach((s) => {
    const gradeCodes: string[] = s.category === 'pre_primary'
      ? ['PP1', 'PP2']
      : s.category === 'primary'
        ? ['G1', 'G2', 'G3', 'G4', 'G5', 'G6']
        : ['G7', 'G8', 'G9']

    gradeCodes.forEach((code) => {
      if (gradeMap[code]) {
        rows.push({ school_id: schoolId, grade_id: gradeMap[code], subject_id: s.id, is_compulsory: s.code.startsWith('LP-') || s.code.startsWith('UP-') || s.code.startsWith('JS-') ? !['UP-AGR','UP-HSC','UP-RE','JS-AGN','JS-BUS','JS-CRE2','JS-IRE','JS-HRE'].includes(s.code) : true })
      }
    })
  })

  const { error } = await supabase
    .from('grade_subjects')
    .upsert(rows, { onConflict: 'school_id,grade_id,subject_id' })
  if (error) throw new Error(`seedGradeSubjectsForSchool: ${error.message}`)
}
