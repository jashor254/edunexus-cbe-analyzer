import { repos } from '@/lib/repositories'
import type { ClassWithDetails, Stream, Grade } from '@/types/core'

// ── Grades catalogue ──────────────────────────────────────────────────────────

export async function listGrades(): Promise<Grade[]> {
  return repos.teachers.listGrades()
}

// ── Streams ───────────────────────────────────────────────────────────────────

export async function listStreams(schoolId: string): Promise<Stream[]> {
  return repos.teachers.listStreams(schoolId)
}

export async function createStream(schoolId: string, name: string): Promise<Stream> {
  return repos.teachers.insertStream(schoolId, name)
}

// ── Classes ───────────────────────────────────────────────────────────────────

export async function listClasses(
  schoolId: string,
  academicYearId?: string
): Promise<ClassWithDetails[]> {
  return repos.teachers.listClasses(schoolId, academicYearId)
}

export async function getClass(classId: string, schoolId: string): Promise<ClassWithDetails> {
  return repos.teachers.findClassById(classId, schoolId)
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
  return repos.teachers.insertClass(schoolId, input)
}

export async function updateClass(
  classId: string,
  schoolId: string,
  updates: { class_teacher_id?: string; capacity?: number; display_name?: string }
): Promise<ClassWithDetails> {
  return repos.teachers.updateClass(classId, schoolId, updates)
}

// ── Class → Subject → Teacher assignment ─────────────────────────────────────

export async function assignSubjectTeacher(
  schoolId: string,
  classId: string,
  subjectId: string,
  teacherId: string
): Promise<void> {
  return repos.teachers.upsertClassSubjectTeacher(schoolId, classId, subjectId, teacherId)
}

export async function listClassSubjects(classId: string): Promise<Array<{
  id: string
  subject_id: string
  teacher_id: string
  subjects: { id: string; name: string; code: string }
}>> {
  return repos.teachers.listClassSubjects(classId)
}
