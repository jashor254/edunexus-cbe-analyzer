// lib/promotions/promote.ts
//
// Domain service for Phase A (docs/architecture/academic-evidence-layer.md
// §2, Rules 1+2: learner permanence, class archival). The one place "a
// student moves to the next grade/class" happens — records an append-only
// student_promotions event and updates students.grade (the fast-read
// current value); never mutates or deletes the old class_students row,
// which remains the permanent historical record of "this student was in
// this class, this year," per Rule 2.
//
// Scope note, not addressed by any ratified architecture document:
// `teacher_classes` is subject-scoped (one row per teacher+subject+grade,
// not one homeroom per student — confirmed against the live schema), so a
// single student is typically enrolled in several `teacher_classes` rows
// at once, one per subject. This function deliberately operates on ONE
// student + at most ONE class-membership transition per call — it does
// not attempt to atomically move a student across their entire subject
// schedule, which no document in this series specified a design for. A
// caller promoting a student across N classes calls this N times, once
// per class, each producing its own permanent promotion record. If a
// promotion has no specific class context yet (e.g. a whole-cohort grade
// bump before next year's classes exist), pass `toClassId: null`.

import { repos } from '@/lib/repositories'
import type { StudentPromotionRow } from '@/lib/repositories/promotion.repository'

export type PromoteStudentInput = {
  studentId: string
  toGrade: number
  fromClassId?: string | null
  toClassId?: string | null
  academicYear: string
  promotedBy: string
  notes?: string | null
}

/**
 * Records one promotion event and updates the student's current grade.
 * Also enrolls the student in `toClassId` if given — does not remove them
 * from `fromClassId`'s `class_students` row, since that row is the
 * permanent historical record of the prior enrollment (Rule 2), not
 * something a promotion should delete.
 */
export async function promoteStudent(input: PromoteStudentInput): Promise<StudentPromotionRow> {
  const fromGrade = await repos.promotions.findStudentGrade(input.studentId)

  const promotion = await repos.promotions.insertPromotion({
    student_id: input.studentId,
    from_grade: fromGrade,
    to_grade: input.toGrade,
    from_class_id: input.fromClassId ?? null,
    to_class_id: input.toClassId ?? null,
    academic_year: input.academicYear,
    promoted_by: input.promotedBy,
    notes: input.notes ?? null,
  })

  await repos.promotions.updateStudentGrade(input.studentId, input.toGrade)
  if (input.toClassId) {
    await repos.promotions.addStudentToClass(input.toClassId, input.studentId)
  }

  return promotion
}

/**
 * Archives a class at year-end — sets status='archived', never deletes the
 * row. `class_students` rows for the archived class are untouched: they
 * remain the historical record of who was in it (Rule 2). Ownership
 * (teacherId) is enforced at the repository layer, same as every other
 * teacher_classes write in this codebase.
 */
export async function archiveClassForYearEnd(
  classId: string,
  teacherId: string
): Promise<{ id: string; status: string; archived_at: string | null }> {
  return repos.promotions.archiveClass(classId, teacherId)
}

export async function getPromotionHistory(studentId: string): Promise<StudentPromotionRow[]> {
  return repos.promotions.findPromotionsForStudent(studentId)
}
