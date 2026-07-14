import { BaseRepository } from './base'

// Data access for Phase A — class archival + promotion history
// (docs/architecture/academic-evidence-layer.md §2). Deliberately its own
// repository, not bolted onto TeacherRepository's existing mixed-bag
// surface, matching the Evidence Domain's precedent of one dedicated
// repository per new domain concept.

export type StudentPromotionRow = {
  id: string
  student_id: string
  from_grade: number | null
  to_grade: number
  from_class_id: string | null
  to_class_id: string | null
  academic_year: string
  promoted_by: string | null
  promoted_at: string
  notes: string | null
}

export type NewStudentPromotion = {
  student_id: string
  from_grade: number | null
  to_grade: number
  from_class_id: string | null
  to_class_id: string | null
  academic_year: string
  promoted_by: string
  notes?: string | null
}

const PROMOTION_COLS =
  'id, student_id, from_grade, to_grade, from_class_id, to_class_id, academic_year, promoted_by, promoted_at, notes'

export class PromotionRepository extends BaseRepository {
  // ── Class archival ───────────────────────────────────────────────────────

  async archiveClass(classId: string, teacherId: string): Promise<{ id: string; status: string; archived_at: string | null }> {
    const { data, error } = await this.db
      .from('teacher_classes')
      .update({ status: 'archived', archived_at: new Date().toISOString() })
      .eq('id', classId)
      .eq('teacher_id', teacherId) // ownership check, matching every other teacher_classes write in this codebase
      .select('id, status, archived_at')
      .single()
    if (error) throw new Error(`archiveClass: ${error.message}`)
    return data
  }

  async findActiveClassesForTeacher(teacherId: string): Promise<Array<{ id: string; name: string; grade: number; academic_year: string }>> {
    const { data, error } = await this.db
      .from('teacher_classes')
      .select('id, name, grade, academic_year')
      .eq('teacher_id', teacherId)
      .eq('status', 'active')
    if (error) throw new Error(`findActiveClassesForTeacher: ${error.message}`)
    return data ?? []
  }

  // ── Student grade + class membership ─────────────────────────────────────

  async findStudentGrade(studentId: string): Promise<number | null> {
    const { data, error } = await this.db.from('students').select('grade').eq('id', studentId).maybeSingle()
    if (error) throw new Error(`findStudentGrade: ${error.message}`)
    return data?.grade ?? null
  }

  async updateStudentGrade(studentId: string, grade: number): Promise<void> {
    const { error } = await this.db.from('students').update({ grade }).eq('id', studentId)
    if (error) throw new Error(`updateStudentGrade: ${error.message}`)
  }

  async addStudentToClass(classId: string, studentId: string): Promise<void> {
    const { error } = await this.db
      .from('class_students')
      .insert({ class_id: classId, student_id: studentId })
    if (error) throw new Error(`addStudentToClass: ${error.message}`)
  }

  // ── Promotion history (append-only) ──────────────────────────────────────

  async insertPromotion(row: NewStudentPromotion): Promise<StudentPromotionRow> {
    const { data, error } = await this.db
      .from('student_promotions')
      .insert(row)
      .select(PROMOTION_COLS)
      .single()
    if (error) throw new Error(`insertPromotion: ${error.message}`)
    return data
  }

  async findPromotionsForStudent(studentId: string): Promise<StudentPromotionRow[]> {
    const { data, error } = await this.db
      .from('student_promotions')
      .select(PROMOTION_COLS)
      .eq('student_id', studentId)
      .order('promoted_at', { ascending: true })
    if (error) throw new Error(`findPromotionsForStudent: ${error.message}`)
    return data ?? []
  }
}
