import { BaseRepository } from './base'
import type {
  ClassWithDetails,
  Stream,
  Grade,
  Subject,
  GradeSubject,
  SubjectCategory,
  SchoolUser,
  SchoolUserRole,
} from '@/types/core'

const CLASS_COLS = `
  id, school_id, class_name, display_name, grade_id, stream_id,
  class_teacher_id, academic_year_id, capacity, created_at, updated_at,
  grades (id, name, code, category),
  streams (id, name)
`

const SUBJECT_COLS = 'id, name, code, category, is_core, created_at, updated_at'

const SCHOOL_USER_COLS =
  'id, school_id, user_id, role, is_active, invited_by, joined_at, created_at, updated_at'

export class TeacherRepository extends BaseRepository {
  // ── Grades ─────────────────────────────────────────────────────────────────

  async listGrades(): Promise<Grade[]> {
    const { data, error } = await this.db
      .from('grades')
      .select('id, name, code, level_order, category, created_at, updated_at')
      .order('level_order')
    if (error) throw new Error(`listGrades: ${error.message}`)
    return data
  }

  async findGrades(): Promise<{ id: string; code: string }[]> {
    const { data } = await this.db.from('grades').select('id, code')
    return data ?? []
  }

  // ── Streams ────────────────────────────────────────────────────────────────

  async listStreams(schoolId: string): Promise<Stream[]> {
    const { data, error } = await this.db
      .from('streams')
      .select('id, school_id, name, created_at, updated_at')
      .eq('school_id', schoolId)
      .order('name')
    if (error) throw new Error(`listStreams: ${error.message}`)
    return data
  }

  async insertStream(schoolId: string, name: string): Promise<Stream> {
    const { data, error } = await this.db
      .from('streams')
      .insert({ school_id: schoolId, name })
      .select('id, school_id, name, created_at, updated_at')
      .single()
    if (error) throw new Error(`createStream: ${error.message}`)
    return data
  }

  // ── Classes ────────────────────────────────────────────────────────────────

  async listClasses(schoolId: string, academicYearId?: string): Promise<ClassWithDetails[]> {
    let query = this.db
      .from('classes')
      .select(CLASS_COLS)
      .eq('school_id', schoolId)
      .order('created_at')
    if (academicYearId) query = query.eq('academic_year_id', academicYearId)
    const { data, error } = await query
    if (error) throw new Error(`listClasses: ${error.message}`)
    return data as unknown as ClassWithDetails[]
  }

  async findClassById(classId: string, schoolId: string): Promise<ClassWithDetails> {
    const { data, error } = await this.db
      .from('classes')
      .select(CLASS_COLS)
      .eq('id', classId)
      .eq('school_id', schoolId)
      .single()
    if (error) throw new Error(`getClass: ${error.message}`)
    return data as unknown as ClassWithDetails
  }

  async insertClass(
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
    const { data, error } = await this.db
      .from('classes')
      .insert({
        school_id:         schoolId,
        class_name:        input.display_name,
        grade_id:          input.grade_id,
        stream_id:         input.stream_id ?? null,
        academic_year_id:  input.academic_year_id,
        class_teacher_id:  input.class_teacher_id ?? null,
        capacity:          input.capacity ?? null,
        display_name:      input.display_name,
      })
      .select(CLASS_COLS)
      .single()
    if (error) throw new Error(`createClass: ${error.message}`)
    return data as unknown as ClassWithDetails
  }

  async updateClass(
    classId: string,
    schoolId: string,
    updates: { class_teacher_id?: string; capacity?: number; display_name?: string }
  ): Promise<ClassWithDetails> {
    const { data, error } = await this.db
      .from('classes')
      .update(updates)
      .eq('id', classId)
      .eq('school_id', schoolId)
      .select(CLASS_COLS)
      .single()
    if (error) throw new Error(`updateClass: ${error.message}`)
    return data as unknown as ClassWithDetails
  }

  // ── Class Subjects ─────────────────────────────────────────────────────────

  async upsertClassSubjectTeacher(
    schoolId: string,
    classId: string,
    subjectId: string,
    teacherId: string
  ): Promise<void> {
    const { error } = await this.db
      .from('class_subjects')
      .upsert(
        { school_id: schoolId, class_id: classId, subject_id: subjectId, teacher_id: teacherId },
        { onConflict: 'class_id,subject_id' }
      )
    if (error) throw new Error(`assignSubjectTeacher: ${error.message}`)
  }

  async listClassSubjects(classId: string): Promise<Array<{
    id: string
    subject_id: string
    teacher_id: string
    subjects: { id: string; name: string; code: string }
  }>> {
    const { data, error } = await this.db
      .from('class_subjects')
      .select('id, subject_id, teacher_id, subjects (id, name, code)')
      .eq('class_id', classId)
    if (error) throw new Error(`listClassSubjects: ${error.message}`)
    return data as unknown as Array<{
      id: string
      subject_id: string
      teacher_id: string
      subjects: { id: string; name: string; code: string }
    }>
  }

  // ── Subjects ───────────────────────────────────────────────────────────────

  async listSubjects(category?: SubjectCategory): Promise<Subject[]> {
    let query = this.db.from('subjects').select(SUBJECT_COLS).order('category').order('name')
    if (category) query = query.eq('category', category)
    const { data, error } = await query
    if (error) throw new Error(`listSubjects: ${error.message}`)
    return data
  }

  async findSubjectById(subjectId: string): Promise<Subject> {
    const { data, error } = await this.db
      .from('subjects')
      .select(SUBJECT_COLS)
      .eq('id', subjectId)
      .single()
    if (error) throw new Error(`getSubject: ${error.message}`)
    return data
  }

  async findAllSubjectsForSeed(): Promise<{ id: string; code: string; category: string }[]> {
    const { data } = await this.db.from('subjects').select('id, code, category')
    return (data ?? []) as { id: string; code: string; category: string }[]
  }

  async listGradeSubjects(
    schoolId: string,
    gradeId: string
  ): Promise<Array<GradeSubject & { subjects: Subject }>> {
    const { data, error } = await this.db
      .from('grade_subjects')
      .select(`id, school_id, grade_id, subject_id, is_compulsory, created_at, updated_at, subjects (${SUBJECT_COLS})`)
      .eq('school_id', schoolId)
      .eq('grade_id', gradeId)
    if (error) throw new Error(`listGradeSubjects: ${error.message}`)
    return data as unknown as Array<GradeSubject & { subjects: Subject }>
  }

  async upsertGradeSubject(
    schoolId: string,
    gradeId: string,
    subjectId: string,
    isCompulsory: boolean
  ): Promise<GradeSubject> {
    const { data, error } = await this.db
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

  async deleteGradeSubject(schoolId: string, gradeId: string, subjectId: string): Promise<void> {
    const { error } = await this.db
      .from('grade_subjects')
      .delete()
      .eq('school_id', schoolId)
      .eq('grade_id', gradeId)
      .eq('subject_id', subjectId)
    if (error) throw new Error(`removeSubjectFromGrade: ${error.message}`)
  }

  async bulkUpsertGradeSubjects(
    rows: { school_id: string; grade_id: string; subject_id: string; is_compulsory: boolean }[]
  ): Promise<void> {
    const { error } = await this.db
      .from('grade_subjects')
      .upsert(rows, { onConflict: 'school_id,grade_id,subject_id' })
    if (error) throw new Error(`seedGradeSubjectsForSchool: ${error.message}`)
  }

  // ── School Users ───────────────────────────────────────────────────────────

  async findSchoolUser(userId: string, schoolId: string): Promise<SchoolUser | null> {
    const { data } = await this.db
      .from('school_users')
      .select(SCHOOL_USER_COLS)
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .single()
    return data
  }

  async listSchoolUsers(schoolId: string, role?: SchoolUserRole): Promise<SchoolUser[]> {
    let query = this.db
      .from('school_users')
      .select(SCHOOL_USER_COLS)
      .eq('school_id', schoolId)
      .order('created_at')
    if (role) query = query.eq('role', role)
    const { data, error } = await query
    if (error) throw new Error(`listSchoolUsers: ${error.message}`)
    return data
  }

  async upsertSchoolUser(
    schoolId: string,
    userId: string,
    role: SchoolUserRole,
    invitedBy: string
  ): Promise<SchoolUser> {
    const { data, error } = await this.db
      .from('school_users')
      .upsert(
        {
          school_id:  schoolId,
          user_id:    userId,
          role,
          is_active:  true,
          invited_by: invitedBy,
          joined_at:  new Date().toISOString(),
        },
        { onConflict: 'school_id,user_id,role' }
      )
      .select(SCHOOL_USER_COLS)
      .single()
    if (error) throw new Error(`addSchoolUser: ${error.message}`)
    return data
  }

  async updateSchoolUserRole(schoolUserId: string, role: SchoolUserRole): Promise<SchoolUser> {
    const { data, error } = await this.db
      .from('school_users')
      .update({ role })
      .eq('id', schoolUserId)
      .select(SCHOOL_USER_COLS)
      .single()
    if (error) throw new Error(`updateSchoolUserRole: ${error.message}`)
    return data
  }

  async deactivateSchoolUser(schoolUserId: string): Promise<void> {
    const { error } = await this.db
      .from('school_users')
      .update({ is_active: false })
      .eq('id', schoolUserId)
    if (error) throw new Error(`deactivateSchoolUser: ${error.message}`)
  }

  async isSchoolAdmin(userId: string, schoolId: string): Promise<boolean> {
    const { data } = await this.db
      .from('school_users')
      .select('id')
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .in('role', ['school_admin', 'headteacher', 'deputy_headteacher'])
      .eq('is_active', true)
      .single()
    return !!data
  }

  async isTeacherInSchool(userId: string, schoolId: string): Promise<boolean> {
    const { data } = await this.db
      .from('school_users')
      .select('id')
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .single()
    return !!data
  }

  // ── Auth: profile-based role checks ───────────────────────────────────────

  async findProfileRole(userId: string): Promise<{ role: string } | null> {
    const { data } = await this.db
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    return data
  }

  async findProfileWithSecondaryRole(
    userId: string
  ): Promise<{ role: string; secondary_role: string | null } | null> {
    const { data } = await this.db
      .from('profiles')
      .select('role, secondary_role')
      .eq('id', userId)
      .maybeSingle()
    return data
  }

  async findTeacherByUserId(userId: string): Promise<{ id: string } | null> {
    const { data } = await this.db
      .from('teachers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
    return data
  }

  // ── Legacy students table (ragContext, search) ────────────────────────────────

  async findLegacyStudentById(id: string): Promise<{ name: string; grade: number; curriculum_type: string } | null> {
    const { data } = await this.db
      .from('students')
      .select('name, grade, curriculum_type')
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    return {
      name:            data.name as string,
      grade:           data.grade as number,
      curriculum_type: data.curriculum_type as string,
    }
  }

  async findLegacyAssessmentsByStudent(id: string): Promise<Array<{
    subject_scores:  Record<string, number | string>
    term:            number
    year:            number
    curriculum_type: string
  }>> {
    const { data } = await this.db
      .from('assessments')
      .select('subject_scores, term, year, curriculum_type')
      .eq('student_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
    return (data ?? []).map(r => ({
      subject_scores:  r.subject_scores as Record<string, number | string>,
      term:            r.term as number,
      year:            r.year as number,
      curriculum_type: r.curriculum_type as string,
    }))
  }

  // ── Study groups ──────────────────────────────────────────────────────────────

  async findStudyGroupById(id: string): Promise<{ id: string; subject: string; grade: number } | null> {
    const { data } = await this.db
      .from('study_groups')
      .select('id, subject, grade')
      .eq('id', id)
      .single()
    if (!data) return null
    return { id: data.id as string, subject: data.subject as string, grade: data.grade as number }
  }

  async findActiveStudyGroups(): Promise<Array<{ id: string }>> {
    const { data } = await this.db
      .from('study_groups')
      .select('id')
      .eq('status', 'active')
    return (data ?? []) as Array<{ id: string }>
  }

  async findCoveredChallenges(
    groupIds: string[],
    today:    string,
  ): Promise<Array<{ group_id: string }>> {
    const { data } = await this.db
      .from('study_group_challenges')
      .select('group_id')
      .eq('date', today)
      .in('group_id', groupIds)
    return (data ?? []) as Array<{ group_id: string }>
  }

  async insertStudyGroupChallenge(row: {
    group_id:       string
    date:           string
    subject:        string
    question:       string
    correct_answer: string
    hint:           string | null
    explanation:    string | null
    difficulty:     number
    kenyan_context: string | null
  }): Promise<void> {
    const { error } = await this.db.from('study_group_challenges').insert(row)
    if (error) throw new Error(`Failed to insert study challenge: ${error.message}`)
  }

  // ── Search ────────────────────────────────────────────────────────────────────

  async searchStudentsByQuery(
    q:         string,
    teacherId: string,
  ): Promise<Array<{ id: string; full_name: string; admission_number: string | null; grade: number; class_name: string | null }>> {
    const { data } = await this.db
      .from('students')
      .select('id, full_name, admission_number, grade, class_name')
      .eq('teacher_id', teacherId)
      .or(`full_name.ilike.%${q}%,admission_number.ilike.%${q}%`)
      .order('full_name', { ascending: true })
      .limit(10)
    return (data ?? []) as Array<{ id: string; full_name: string; admission_number: string | null; grade: number; class_name: string | null }>
  }

  async searchClassesByQuery(
    q:         string,
    teacherId: string,
  ): Promise<Array<{ id: string; name: string; grade: number; subject: string; stream: string | null }>> {
    const { data } = await this.db
      .from('teacher_classes')
      .select('id, name, grade, subject, stream')
      .eq('teacher_id', teacherId)
      .or(`name.ilike.%${q}%,subject.ilike.%${q}%`)
      .order('name', { ascending: true })
      .limit(10)
    return (data ?? []) as Array<{ id: string; name: string; grade: number; subject: string; stream: string | null }>
  }

  async findProfileFullName(userId: string): Promise<string | null> {
    const { data } = await this.db
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()
    return (data?.full_name as string | null) ?? null
  }
}
