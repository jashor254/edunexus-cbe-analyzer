import { repos } from '@/lib/repositories'
import type { Subject, GradeSubject, SubjectCategory } from '@/types/core'

export async function listSubjects(category?: SubjectCategory): Promise<Subject[]> {
  return repos.teachers.listSubjects(category)
}

export async function getSubject(subjectId: string): Promise<Subject> {
  return repos.teachers.findSubjectById(subjectId)
}

export async function listGradeSubjects(
  schoolId: string,
  gradeId: string
): Promise<Array<GradeSubject & { subjects: Subject }>> {
  return repos.teachers.listGradeSubjects(schoolId, gradeId)
}

export async function assignSubjectToGrade(
  schoolId: string,
  gradeId: string,
  subjectId: string,
  isCompulsory = true
): Promise<GradeSubject> {
  return repos.teachers.upsertGradeSubject(schoolId, gradeId, subjectId, isCompulsory)
}

export async function removeSubjectFromGrade(
  schoolId: string,
  gradeId: string,
  subjectId: string
): Promise<void> {
  return repos.teachers.deleteGradeSubject(schoolId, gradeId, subjectId)
}

// ── Seed a school's grade_subjects from the global catalogue (CBC defaults) ──

export async function seedGradeSubjectsForSchool(schoolId: string): Promise<void> {
  const grades = await repos.teachers.findGrades()
  const gradeMap: Record<string, string> = {}
  grades.forEach((g) => { gradeMap[g.code] = g.id })

  const subjects = await repos.teachers.findAllSubjectsForSeed()

  const rows: Array<{ school_id: string; grade_id: string; subject_id: string; is_compulsory: boolean }> = []

  subjects.forEach((s) => {
    const gradeCodes: string[] = s.category === 'pre_primary'
      ? ['PP1', 'PP2']
      : s.category === 'primary'
        ? ['G1', 'G2', 'G3', 'G4', 'G5', 'G6']
        : ['G7', 'G8', 'G9']

    gradeCodes.forEach((code) => {
      if (gradeMap[code]) {
        rows.push({
          school_id: schoolId,
          grade_id: gradeMap[code],
          subject_id: s.id,
          is_compulsory: s.code.startsWith('LP-') || s.code.startsWith('UP-') || s.code.startsWith('JS-')
            ? !['UP-AGR', 'UP-HSC', 'UP-RE', 'JS-AGN', 'JS-BUS', 'JS-CRE2', 'JS-IRE', 'JS-HRE'].includes(s.code)
            : true,
        })
      }
    })
  })

  await repos.teachers.bulkUpsertGradeSubjects(rows)
}
