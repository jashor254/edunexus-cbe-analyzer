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

/**
 * Assigns a teacher to a subject in a class, closing the outgoing teacher's
 * tenure rather than overwriting it.
 *
 * `teacherId` is a `school_users.id` — the membership, not the person.
 *
 * Returns what actually happened so a caller can word its confirmation
 * honestly ("replaced Peter" vs "assigned" vs "already assigned").
 */
export async function assignSubjectTeacher(
  schoolId: string,
  classId: string,
  subjectId: string,
  teacherId: string
): Promise<{ replaced: boolean; unchanged: boolean }> {
  return repos.teachers.assignClassSubjectTeacher(schoolId, classId, subjectId, teacherId)
}

/** Every teacher who has held one class+subject post, newest first. Closed tenures included. */
export async function getClassSubjectHistory(classId: string, subjectId: string): Promise<Array<{
  id: string
  teacherId: string
  startedAt: string
  endedAt: string | null
}>> {
  return repos.teachers.listClassSubjectHistory(classId, subjectId)
}

export async function listClassSubjects(classId: string): Promise<Array<{
  id: string
  subject_id: string
  teacher_id: string
  subjects: { id: string; name: string; code: string }
}>> {
  return repos.teachers.listClassSubjects(classId)
}
