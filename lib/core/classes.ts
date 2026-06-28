import { createServiceClient } from '@/utils/supabase/service'
import type { ClassWithDetails, Stream, Grade } from '@/types/core'

const CLASS_COLS = `
  id, school_id, class_name, display_name, grade_id, stream_id,
  class_teacher_id, academic_year_id, capacity, created_at, updated_at,
  grades (id, name, code, category),
  streams (id, name)
`

// ── Grades catalogue ──────────────────────────────────────────────────────────

export async function listGrades(): Promise<Grade[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('grades')
    .select('id, name, code, level_order, category, created_at, updated_at')
    .order('level_order')
  if (error) throw new Error(`listGrades: ${error.message}`)
  return data
}

// ── Streams ───────────────────────────────────────────────────────────────────

export async function listStreams(schoolId: string): Promise<Stream[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('streams')
    .select('id, school_id, name, created_at, updated_at')
    .eq('school_id', schoolId)
    .order('name')
  if (error) throw new Error(`listStreams: ${error.message}`)
  return data
}

export async function createStream(schoolId: string, name: string): Promise<Stream> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('streams')
    .insert({ school_id: schoolId, name })
    .select('id, school_id, name, created_at, updated_at')
    .single()
  if (error) throw new Error(`createStream: ${error.message}`)
  return data
}

// ── Classes ───────────────────────────────────────────────────────────────────

export async function listClasses(
  schoolId: string,
  academicYearId?: string
): Promise<ClassWithDetails[]> {
  const supabase = createServiceClient()
  let query = supabase
    .from('classes')
    .select(CLASS_COLS)
    .eq('school_id', schoolId)
    .order('created_at')
  if (academicYearId) query = query.eq('academic_year_id', academicYearId)
  const { data, error } = await query
  if (error) throw new Error(`listClasses: ${error.message}`)
  return data as unknown as ClassWithDetails[]
}

export async function getClass(classId: string, schoolId: string): Promise<ClassWithDetails> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('classes')
    .select(CLASS_COLS)
    .eq('id', classId)
    .eq('school_id', schoolId)
    .single()
  if (error) throw new Error(`getClass: ${error.message}`)
  return data as unknown as ClassWithDetails
}

export async function createClass(
  schoolId: string,
  input: {
    grade_id: string
    stream_id?: string
    academic_year_id: string
    class_teacher_id?: string
    capacity?: number
    display_name: string
  }
): Promise<ClassWithDetails> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('classes')
    .insert({
      school_id: schoolId,
      class_name: input.display_name,
      grade_id: input.grade_id,
      stream_id: input.stream_id ?? null,
      academic_year_id: input.academic_year_id,
      class_teacher_id: input.class_teacher_id ?? null,
      capacity: input.capacity ?? null,
      display_name: input.display_name,
    })
    .select(CLASS_COLS)
    .single()
  if (error) throw new Error(`createClass: ${error.message}`)
  return data as unknown as ClassWithDetails
}

export async function updateClass(
  classId: string,
  schoolId: string,
  updates: { class_teacher_id?: string; capacity?: number; display_name?: string }
): Promise<ClassWithDetails> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('classes')
    .update(updates)
    .eq('id', classId)
    .eq('school_id', schoolId)
    .select(CLASS_COLS)
    .single()
  if (error) throw new Error(`updateClass: ${error.message}`)
  return data as unknown as ClassWithDetails
}

// ── Class → Subject → Teacher assignment ─────────────────────────────────────

export async function assignSubjectTeacher(
  schoolId: string,
  classId: string,
  subjectId: string,
  teacherId: string
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('class_subjects')
    .upsert(
      { school_id: schoolId, class_id: classId, subject_id: subjectId, teacher_id: teacherId },
      { onConflict: 'class_id,subject_id' }
    )
  if (error) throw new Error(`assignSubjectTeacher: ${error.message}`)
}

export async function listClassSubjects(classId: string): Promise<Array<{
  id: string
  subject_id: string
  teacher_id: string
  subjects: { id: string; name: string; code: string }
}>> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('class_subjects')
    .select('id, subject_id, teacher_id, subjects (id, name, code)')
    .eq('class_id', classId)
  if (error) throw new Error(`listClassSubjects: ${error.message}`)
  return data as unknown as Array<{ id: string; subject_id: string; teacher_id: string; subjects: { id: string; name: string; code: string } }>
}
