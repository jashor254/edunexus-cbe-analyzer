import { BaseRepository } from './base'
import { BridgeAlreadyClaimedError, AssignmentBridgeAlreadyClaimedError } from '@/lib/core/errors'
import type {
  ClassWithDetails,
  Stream,
  Grade,
  Subject,
  GradeSubject,
  SubjectCategory,
  SchoolUser,
  SchoolUserRole,
  TeachingAssignment,
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

  /**
   * Assigns `teacherId` (a `school_users.id`) to teach `subjectId` in
   * `classId`, closing whoever currently holds that post.
   *
   * This REPLACED an upsert on (class_id, subject_id). That upsert overwrote
   * `teacher_id` in place, so a replacement erased the previous teacher's
   * tenure — there was no row anywhere recording that they ever taught it.
   * Now the outgoing assignment is closed (`ended_at` set) and the incoming
   * one is a new row, so both tenures survive.
   *
   * Idempotent: re-assigning the teacher who already holds the post is a
   * no-op. It deliberately does NOT close-and-reopen, which would reset
   * `started_at` and manufacture a fake succession event out of a double
   * click.
   *
   * ORDERING AND FAILURE (deliberate). The close must precede the insert:
   * inserting first would momentarily place two current teachers on one
   * class+subject, which `class_subjects_current_assignment_uniq` rejects
   * outright. So a failure between the two statements leaves the post VACANT
   * rather than double-staffed. That is the correct direction to fail — a
   * vacancy is visibly wrong and an admin re-assigns; a silent second current
   * teacher would corrupt every downstream read of "who teaches this."
   *
   * The critical invariant (never two current teachers) is enforced by the
   * partial unique index, not by this ordering, so it holds even under
   * concurrent callers. A SECURITY DEFINER RPC would additionally remove the
   * transient-vacancy window, and was consciously not added: this codebase has
   * already had one privilege-escalation incident from a SECURITY DEFINER
   * function's default PUBLIC grant, and transient vacancy is a far smaller
   * problem than new privileged surface.
   */
  async assignClassSubjectTeacher(
    schoolId: string,
    classId: string,
    subjectId: string,
    teacherId: string,
    now: Date = new Date()
  ): Promise<{ replaced: boolean; unchanged: boolean }> {
    const { data: current, error: readErr } = await this.db
      .from('class_subjects')
      .select('id, teacher_id')
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .is('ended_at', null)
      .maybeSingle()
    if (readErr) throw new Error(`assignClassSubjectTeacher (read current): ${readErr.message}`)

    if (current && current.teacher_id === teacherId) {
      return { replaced: false, unchanged: true }
    }

    if (current) {
      const { error: closeErr } = await this.db
        .from('class_subjects')
        .update({ ended_at: now.toISOString() })
        .eq('id', current.id)
        .is('ended_at', null) // never re-close an already-closed row
      if (closeErr) throw new Error(`assignClassSubjectTeacher (close outgoing): ${closeErr.message}`)
    }

    const { error: insertErr } = await this.db
      .from('class_subjects')
      .insert({
        school_id:  schoolId,
        class_id:   classId,
        subject_id: subjectId,
        teacher_id: teacherId,
        started_at: now.toISOString(),
      })
    if (insertErr) throw new Error(`assignClassSubjectTeacher (insert incoming): ${insertErr.message}`)

    return { replaced: !!current, unchanged: false }
  }

  /**
   * Closes every CURRENT assignment held by one membership — the assignment
   * half of "this person no longer works here."
   *
   * Keyed on `school_users.id` rather than a user id because that is what an
   * assignment actually belongs to: an employment relationship, not a person.
   * The same human at another school keeps their assignments there untouched.
   *
   * Idempotent by construction: `.is('ended_at', null)` means a second call
   * matches nothing and closes nothing, so a double-submitted "remove staff"
   * action cannot rewrite the first closure's timestamp.
   *
   * Never deletes. A closed row is the record that this teacher taught this
   * subject, and it outlives their employment.
   */
  async closeCurrentAssignmentsForMembership(
    schoolUserId: string,
    now: Date = new Date()
  ): Promise<number> {
    const { data, error } = await this.db
      .from('class_subjects')
      .update({ ended_at: now.toISOString() })
      .eq('teacher_id', schoolUserId)
      .is('ended_at', null)
      .select('id')
    if (error) throw new Error(`closeCurrentAssignmentsForMembership: ${error.message}`)
    return (data ?? []).length
  }

  /**
   * Full tenure history for one class+subject, newest first — who has taught
   * it, and when. Exists so closed rows are reachable rather than orphaned
   * data nothing can read (there is no history UI in this phase).
   */
  async listClassSubjectHistory(classId: string, subjectId: string): Promise<Array<{
    id: string
    teacherId: string
    startedAt: string
    endedAt: string | null
  }>> {
    const { data, error } = await this.db
      .from('class_subjects')
      .select('id, teacher_id, started_at, ended_at')
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .order('started_at', { ascending: false })
    if (error) throw new Error(`listClassSubjectHistory: ${error.message}`)
    return (data ?? []).map(r => ({
      id:        r.id as string,
      teacherId: r.teacher_id as string,
      startedAt: r.started_at as string,
      endedAt:   r.ended_at as string | null,
    }))
  }

  /**
   * The school ids where this user currently holds an ACTIVE teacher
   * membership. Exists to answer "is this person a school teacher at all",
   * separately from "what are they assigned to teach" — a teacher with a
   * membership and no assignments must be distinguishable from a Solo
   * Teacher, and `listTeachingAssignmentsByUser` collapses both to [].
   */
  async listActiveTeacherMembershipSchoolIds(userId: string): Promise<string[]> {
    const { data, error } = await this.db
      .from('school_users')
      .select('school_id')
      .eq('user_id', userId)
      .eq('role', 'teacher')
      .eq('is_active', true)
    if (error) throw new Error(`listActiveTeacherMembershipSchoolIds: ${error.message}`)
    return (data ?? []).map(r => r.school_id as string)
  }

  /**
   * THE institutional read: every teaching assignment currently held by
   * `userId`, resolved from their own active memberships outward.
   *
   * Two queries, deliberately, rather than one PostgREST embed:
   * `class_subjects.teacher_id` FKs to `school_users.id`, so an embed would
   * let PostgREST resolve the membership but gives no way to filter it by
   * `user_id` AND `is_active` AND `role` in the same statement. Resolving
   * memberships first also makes the security property inspectable — the
   * `.in()` list is built ONLY from rows proven to belong to this user, so
   * there is no id a caller could supply that widens the result.
   *
   * Returns [] (never throws) for a user with no active teacher membership:
   * "not a school teacher" is an ordinary answer, not an error.
   *
   * `is_active = true` is required here, and so is `ended_at IS NULL` below.
   * They are two independent guards on the same rule and both are needed: a
   * membership can go inactive while its assignments are still open (a
   * departure recorded in two steps), and an assignment can be closed while
   * the membership stays active (an ordinary reassignment). Either alone
   * would let a stale post surface as current work.
   */
  async listTeachingAssignmentsByUser(userId: string): Promise<TeachingAssignment[]> {
    const { data: memberships, error: membershipError } = await this.db
      .from('school_users')
      .select('id, school_id')
      .eq('user_id', userId)
      .eq('role', 'teacher')
      .eq('is_active', true)
    if (membershipError) throw new Error(`listTeachingAssignmentsByUser (memberships): ${membershipError.message}`)
    if (!memberships || memberships.length === 0) return []

    const membershipIds = memberships.map(m => m.id as string)

    const { data, error } = await this.db
      .from('class_subjects')
      .select(`
        id, school_id, class_id, subject_id, teacher_id,
        classes (id, class_name, display_name, academic_year_id, grades (name, code), streams (name)),
        subjects (id, name, code),
        schools (id, school_name)
      `)
      .in('teacher_id', membershipIds)
      // CURRENT assignments only — My Teaching shows what this teacher teaches
      // now, never a post they used to hold. A closed row is history, and
      // history is not a timetable.
      .is('ended_at', null)
    if (error) throw new Error(`listTeachingAssignmentsByUser: ${error.message}`)

    type Row = {
      id: string
      school_id: string
      class_id: string
      subject_id: string
      teacher_id: string
      classes: {
        class_name: string | null
        display_name: string | null
        academic_year_id: string | null
        grades: { name: string; code: string } | null
        streams: { name: string } | null
      } | null
      subjects: { id: string; name: string; code: string } | null
      schools: { id: string; school_name: string } | null
    }

    return ((data ?? []) as unknown as Row[])
      // A class_subjects row whose class or subject no longer resolves is
      // corrupt, not renderable — dropped rather than surfaced as a blank
      // card the teacher cannot act on.
      .filter(r => r.classes !== null && r.subjects !== null)
      .map(r => ({
        assignmentId:        r.id,
        schoolId:            r.school_id,
        schoolName:          r.schools?.school_name ?? '',
        classId:             r.class_id,
        className:           r.classes!.display_name ?? r.classes!.class_name ?? '',
        gradeName:           r.classes!.grades?.name ?? null,
        gradeCode:           r.classes!.grades?.code ?? null,
        streamName:          r.classes!.streams?.name ?? null,
        academicYearId:      r.classes!.academic_year_id,
        subjectId:           r.subjects!.id,
        subjectName:         r.subjects!.name,
        subjectCode:         r.subjects!.code,
        teacherMembershipId: r.teacher_id,
      }))
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
      // CURRENT assignments only. Without this the admin structure page would
      // list every teacher who has ever held each post, and a class with one
      // replacement would appear to have two Mathematics teachers.
      .is('ended_at', null)
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

  // Phase 9 — the reinstatement counterpart to deactivateSchoolUser. Flips
  // is_active back to true only; joined_at is left untouched (it already
  // holds this membership's original acceptance date from the first time
  // they activated, and reinstatement is not a second acceptance).
  async reactivateSchoolUser(schoolUserId: string): Promise<void> {
    const { error } = await this.db
      .from('school_users')
      .update({ is_active: true })
      .eq('id', schoolUserId)
    if (error) throw new Error(`reactivateSchoolUser: ${error.message}`)
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

  // Sprint 9E: school-wide teacher-readiness aggregation needs "which of
  // these N school_users have a canonical teachers row," batched with
  // .in() per CLAUDE.md's "never query inside a loop" rule — one query for
  // the whole school instead of one per teacher.
  async findUserIdsWithTeacherRecord(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return []
    const { data, error } = await this.db
      .from('teachers')
      .select('user_id')
      .in('user_id', userIds)
    if (error) throw new Error(`findUserIdsWithTeacherRecord: ${error.message}`)
    return (data ?? []).map(r => r.user_id)
  }

  // Sprint 9C: canonical teacher-identity creation (ADR-0002 — teachers.id
  // is the Teacher-domain identity `createAssessment` etc. actually need,
  // not school_users.id). Mirrors app/api/teacher/profile/route.ts's
  // existing insert shape, but through the repository layer instead of an
  // inline route query, since this is now the canonical (not legacy
  // free-text) creation path.
  async insertTeacher(
    userId: string,
    fields: { full_name: string; school: string; subject?: string; grade_levels?: number[]; phone?: string }
  ): Promise<{ id: string }> {
    const { data, error } = await this.db
      .from('teachers')
      .insert({
        user_id:      userId,
        full_name:    fields.full_name,
        school:       fields.school,
        subject:      fields.subject ?? null,
        grade_levels: fields.grade_levels ?? [7, 8, 9, 10, 11, 12],
        phone:        fields.phone ?? null,
      })
      .select('id')
      .single()
    if (error) throw new Error(`insertTeacher: ${error.message}`)
    return data
  }

  // Mirrors app/auth/callback/route.ts's existing profiles upsert shape
  // (onConflict: 'id') — consolidated here so the canonical teacher-onboarding
  // path doesn't grow a second inline copy of the same upsert.
  async upsertProfile(userId: string, fields: { role: string; full_name?: string }): Promise<void> {
    const { error } = await this.db
      .from('profiles')
      .upsert(
        { id: userId, role: fields.role, ...(fields.full_name ? { full_name: fields.full_name } : {}), updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
    if (error) throw new Error(`upsertProfile: ${error.message}`)
  }

  // Status-agnostic counterpart to findSchoolUser (which filters
  // is_active=true only) — needed to distinguish "never invited" from
  // "invited but not yet accepted" from "already an active member" without
  // three separate queries.
  async findSchoolUserByUserIdAndRole(schoolId: string, userId: string, role: SchoolUserRole): Promise<SchoolUser | null> {
    const { data } = await this.db
      .from('school_users')
      .select(SCHOOL_USER_COLS)
      .eq('school_id', schoolId)
      .eq('user_id', userId)
      .eq('role', role)
      .maybeSingle()
    return data
  }

  // Every school_users row this user holds at this school, regardless of role
  // OR status.
  //
  // findSchoolUserByUserIdAndRole answers "is this person a pending/active X
  // here"; this answers the question an invitation actually needs to ask
  // first: "does this person already hold ANY membership here, under any
  // role." Without it, inviting an existing teacher as a school_admin would
  // insert a SECOND active row (the unique key is school_id+user_id+role, so
  // the database permits it) — and repos.schools.findSchoolUserByUserId()
  // uses .maybeSingle(), so a second active row would make that lookup throw
  // for every downstream caller. Membership changes role in place instead.
  async listSchoolUserRowsForUser(schoolId: string, userId: string): Promise<SchoolUser[]> {
    const { data, error } = await this.db
      .from('school_users')
      .select(SCHOOL_USER_COLS)
      .eq('school_id', schoolId)
      .eq('user_id', userId)
      .order('created_at')
    if (error) throw new Error(`listSchoolUserRowsForUser: ${error.message}`)
    return data ?? []
  }

  // Phase 2 — the activation page's own read: "what invitations, at any
  // school, is the CURRENTLY AUTHENTICATED user waiting to accept." Unlike
  // listSchoolUserRowsForUser (school-scoped, needs a schoolId the
  // invitee doesn't have yet), this is deliberately global and self-scoped
  // by userId only — same safety shape as GET /api/core/my-membership
  // (findSchoolUserByUserId): the caller can only ever see their OWN
  // pending rows, never anyone else's, because userId always comes from
  // auth.getUser() at the route, never from a query param.
  async listPendingInvitationsForUser(userId: string): Promise<Array<SchoolUser & { school_name: string }>> {
    const { data, error } = await this.db
      .from('school_users')
      .select(`${SCHOOL_USER_COLS}, schools!inner (school_name)`)
      .eq('user_id', userId)
      .eq('is_active', false)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`listPendingInvitationsForUser: ${error.message}`)
    return (data ?? []).map((row) => {
      const { schools, ...rest } = row as unknown as SchoolUser & { schools: { school_name: string } }
      return { ...rest, school_name: schools.school_name }
    })
  }

  // Creates a *pending* membership (is_active: false) — the "invited, not
  // yet accepted" state. Deliberately a plain insert, not an upsert: an
  // upsert here would risk silently flipping an already-active member back
  // to pending on a careless re-invite. Callers must check
  // findSchoolUserByUserIdAndRole first (Sprint 9C's inviteTeacher does).
  async insertPendingSchoolUser(schoolId: string, userId: string, role: SchoolUserRole, invitedBy: string): Promise<SchoolUser> {
    const { data, error } = await this.db
      .from('school_users')
      .insert({ school_id: schoolId, user_id: userId, role, is_active: false, invited_by: invitedBy })
      .select(SCHOOL_USER_COLS)
      .single()
    if (error) throw new Error(`insertPendingSchoolUser: ${error.message}`)
    return data
  }

  // Resolves an existing auth.users account by email, for invite flows that
  // need to check "does this person already have an account" before they
  // can be added to school_users (user_id is NOT NULL, FK'd to auth.users —
  // there is no way to reference someone who hasn't signed up yet).
  // Mirrors the exact auth.admin.listUsers()-then-find-by-email pattern
  // already used in app/api/admin/activate-user/route.ts and siblings —
  // consolidated here rather than re-implemented inline a second time.
  async findAuthUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
    const normalized = email.toLowerCase().trim()
    const match = await this.findAuthUser(u => u.email?.toLowerCase().trim() === normalized)
    return match?.email ? { id: match.id, email: match.email } : null
  }

  // Phase 2 (admin-provisioned teacher activation) — creates the
  // auth.users account for someone who has never used EduNexus, so a
  // school admin can invite a genuinely new teacher rather than dead-
  // ending at {status:'no_account'}. Uses Supabase's own invite-link
  // machinery (the same primitive scripts/captureDemoScreens.ts already
  // uses for magiclinks) rather than a custom token: Supabase owns the
  // token's entropy, expiry and single-use semantics end to end, so this
  // adds no new security surface and no new schema. `action_link` is the
  // full, ready-to-email URL; opening it authenticates the browser and
  // redirects to `redirectTo` carrying a `code` for the existing
  // /auth/callback exchange — no new verification code needed either.
  // Returns null on failure (e.g. a race where the email was registered
  // between the caller's own findAuthUserByEmail check and this call) so
  // the caller can degrade rather than silently proceed with no account.
  async createInvitedAuthAccount(email: string, redirectTo: string): Promise<{ userId: string; actionLink: string } | null> {
    const { data, error } = await this.db.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo },
    })
    if (error || !data?.user?.id || !data.properties?.action_link) {
      console.error('[teacher.repository] createInvitedAuthAccount failed', { email, error: error?.message })
      return null
    }
    return { userId: data.user.id, actionLink: data.properties.action_link }
  }

  /**
   * Walks every page of auth.users, stopping early when `predicate` matches.
   *
   * `listUsers()` is PAGINATED and defaults to 50 users per page. Called
   * bare, it silently searches only the newest 50 accounts on a platform with
   * hundreds — so an existing user simply "did not exist", and a school
   * handoff or teacher invite would tell the founder to ask a colleague to
   * sign up for an account they already had. Absence must mean absence.
   */
  private async findAuthUser(
    predicate: (u: { id: string; email?: string | null }) => boolean
  ): Promise<{ id: string; email?: string | null } | null> {
    for await (const page of this.eachAuthUserPage()) {
      const match = page.find(predicate)
      if (match) return match
    }
    return null
  }

  private async *eachAuthUserPage(): AsyncGenerator<Array<{ id: string; email?: string | null }>> {
    const perPage = 1000
    for (let page = 1; ; page++) {
      const { data, error } = await this.db.auth.admin.listUsers({ page, perPage })
      if (error) throw new Error(`listUsers(page ${page}): ${error.message}`)
      const users = (data.users ?? []) as Array<{ id: string; email?: string | null }>
      if (users.length === 0) return
      yield users
      // A short page is the last page. GoTrue may cap perPage below what was
      // asked for, so the loop trusts the response size, not the request.
      if (users.length < perPage) return
    }
  }

  // Batched profile lookup for a teacher-membership list screen (Sprint
  // 10E) — mirrors findUserIdsWithTeacherRecord's .in() batching, one query
  // for the whole roster instead of one per row.
  async findProfilesByUserIds(userIds: string[]): Promise<Map<string, { full_name: string | null }>> {
    if (userIds.length === 0) return new Map()
    const { data, error } = await this.db
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)
    if (error) throw new Error(`findProfilesByUserIds: ${error.message}`)
    return new Map((data ?? []).map(row => [row.id, { full_name: row.full_name }]))
  }

  // Same auth.admin.listUsers() call findAuthUserByEmail already uses,
  // batched by id instead of matched by email — a pending school_users row
  // has no `teachers`/`profiles` row yet (those only materialize on
  // accept), so email is the only identifying field available for an
  // invited-but-not-yet-accepted teacher in a list UI.
  async findAuthUsersByIds(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map()
    const idSet = new Set(userIds)
    const result = new Map<string, string>()
    // Paginated for the same reason as findAuthUserByEmail: unpaginated, a
    // 49-member school listed no emails at all, because none of its staff were
    // among the newest 50 accounts on the platform.
    for await (const page of this.eachAuthUserPage()) {
      for (const u of page) {
        if (idSet.has(u.id) && u.email) result.set(u.id, u.email)
      }
      if (result.size === idSet.size) break
    }
    return result
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

  // ── Sprint 9F: Core↔legacy academic identity bridge ─────────────────────────
  // TEMPORARY infrastructure per docs/architecture/learning-intelligence-
  // migration-strategy.md §3's Phase-0-style carve-out — NOT the "permanent
  // bridging adapter" that document rejects. Retire when Phase 11 (Compass
  // port) lands and Intelligence consumes Core natively. See
  // lib/core/academicBridge.ts for the full rationale.

  async findLegacyClassByExternalId(externalId: string, teacherId: string): Promise<{ id: string } | null> {
    const { data } = await this.db
      .from('teacher_classes')
      .select('id')
      .eq('external_id', externalId)
      .eq('teacher_id', teacherId)
      .maybeSingle()
    return data
  }

  // Teacher-agnostic version of the lookup above — computeTermSummaries
  // (lib/core/assessments.ts) needs every legacy class bridged to a Core
  // class regardless of which teacher created the bridge, to read
  // class_assessments (legacy-keyed) for a Core-keyed class_id input.
  async findLegacyClassIdsByExternalId(externalId: string): Promise<string[]> {
    const { data, error } = await this.db
      .from('teacher_classes')
      .select('id')
      .eq('external_id', externalId)
    if (error) throw new Error(`findLegacyClassIdsByExternalId: ${error.message}`)
    return (data ?? []).map((r) => r.id)
  }

  async insertLegacyClass(input: {
    teacherId: string
    name: string
    grade: number
    subject: string
    academicYear: string
    classCode: string
    externalId: string
  }): Promise<{ id: string }> {
    const { data, error } = await this.db
      .from('teacher_classes')
      .insert({
        teacher_id:    input.teacherId,
        name:          input.name,
        grade:         input.grade,
        subject:       input.subject,
        academic_year: input.academicYear,
        class_code:    input.classCode,
        external_id:   input.externalId,
      })
      .select('id')
      .single()
    if (error) throw new Error(`insertLegacyClass: ${error.message}`)
    return data
  }

  async findLegacyStudentByExternalId(externalId: string): Promise<{ id: string } | null> {
    const { data } = await this.db
      .from('students')
      .select('id')
      .eq('external_id', externalId)
      .maybeSingle()
    return data
  }

  // Reverse of findLegacyStudentByExternalId — legacy students.id -> the
  // Core learners.id that bridged it (Sprint 9F's external_id link).
  // Batched (not called per-row in a loop) for
  // lib/core/assessments.ts::computeTermSummaries, which must resolve
  // every learner_marks.student_id in a class/term back to a real
  // learners.id before writing term_subject_summaries.learner_id (a real
  // FK to `learners`, never `students` — see Sprint 10A audit).
  // Forward batch bridge — Core learners.id[] -> the legacy students.id that
  // was bridged for each. The singular `findLegacyStudentByExternalId` above is
  // fine for one learner (Blueprint composes one at a time), but a class view
  // resolves a whole roster at once and must never call it in a loop.
  // Returns only learners that actually have a bridge; an absent row means "no
  // legacy identity yet", a normal state for a newly-enrolled learner.
  async findLegacyStudentsByExternalIds(externalIds: string[]): Promise<Array<{ id: string; external_id: string | null }>> {
    if (!externalIds.length) return []
    const { data, error } = await this.db
      .from('students')
      .select('id, external_id')
      .in('external_id', externalIds)
    if (error) throw new Error(`findLegacyStudentsByExternalIds: ${error.message}`)
    return (data ?? []) as Array<{ id: string; external_id: string | null }>
  }

  async findExternalIdsByStudentIds(studentIds: string[]): Promise<Array<{ id: string; external_id: string | null }>> {
    if (!studentIds.length) return []
    const { data, error } = await this.db
      .from('students')
      .select('id, external_id')
      .in('id', studentIds)
    if (error) throw new Error(`findExternalIdsByStudentIds: ${error.message}`)
    return (data ?? []) as Array<{ id: string; external_id: string | null }>
  }

  /**
   * Throws {@link BridgeAlreadyClaimedError} — never a bare `Error` — when the
   * insert loses a race against a concurrent request bridging the same Core
   * learner. IDENTITY-1 Phase 2's `uq_students_external_id_bridge` partial
   * unique index makes that race a real Postgres `23505`, not a possibility;
   * this method names it precisely (constraint name, not just the error code)
   * so `ensureBridgedLearner` can recover from exactly this violation and
   * nothing else. See lib/core/academicBridge.ts (IDENTITY-1 Phase 3).
   */
  async insertLegacyStudent(input: {
    name: string
    grade: number
    level: string
    teacherId: string
    externalId: string
    upi?: string | null
  }): Promise<{ id: string }> {
    const { data, error } = await this.db
      .from('students')
      .insert({
        name:            input.name,
        grade:           input.grade,
        level:           input.level,
        curriculum_type: 'cbc',
        added_by:        'system',
        teacher_id:      input.teacherId,
        external_id:     input.externalId,
        upi:             input.upi ?? null,
      })
      .select('id')
      .single()
    if (error) {
      if (error.code === '23505' && error.message.includes('uq_students_external_id_bridge')) {
        throw new BridgeAlreadyClaimedError(input.externalId)
      }
      throw new Error(`insertLegacyStudent: ${error.message}`)
    }
    return data
  }

  // Sprint 9G: class_students.parent_id is nullable (confirmed live —
  // the static teacher_portal_migration.sql this table was originally
  // defined in says NOT NULL, but a later, unlogged migration relaxed it;
  // always trust the live schema, not the historical file). This closes a
  // real gap Sprint 9F's bridge left: without a class_students row, a
  // bridged learner was invisible to the roster-based class view
  // (app/api/teacher/classes/[classId]/route.ts reads class_students, not
  // students.teacher_id directly) even though Compass/Evidence/Projection
  // (all direct-link-based) already worked. Upserts on the live
  // UNIQUE(class_id, student_id) constraint — idempotent.
  async upsertLegacyClassRoster(legacyClassId: string, legacyStudentId: string): Promise<void> {
    const { error } = await this.db
      .from('class_students')
      .upsert(
        { class_id: legacyClassId, student_id: legacyStudentId, joined_at: new Date().toISOString() },
        { onConflict: 'class_id,student_id' }
      )
    if (error) throw new Error(`upsertLegacyClassRoster: ${error.message}`)
  }

  // Phase 5 (legacy roster convergence on learner move) — the first
  // production DELETE against class_students. Proven safe before writing
  // this: no table anywhere in the schema has a foreign key referencing
  // class_students.id (checked live via pg_constraint/information_schema);
  // every historical academic table (learner_marks, learner_evidence,
  // learner_projections, assessments, assignment_submissions, ...)
  // references students.id directly, never class_students.id. Deleting a
  // class_students row therefore removes only "this student currently
  // appears on this legacy class's roster" — nothing historical.
  //
  // Scoped to an explicit, caller-resolved set of legacyClassIds (never a
  // bare student_id match) — the caller (removeStaleLegacyRosterMembership,
  // lib/core/academicBridge.ts) resolves that set from
  // findLegacyClassIdsByExternalId(vacatedCoreClassId), so this can only
  // ever remove rows tied to the EXACT vacated Core class, never a
  // same-student row on an unrelated class. Returns the count removed
  // (0 is a normal, safe outcome — not an error — for a never-bridged
  // learner/class or an already-clean retry).
  async removeLegacyClassRosterMembership(legacyClassIds: string[], legacyStudentId: string): Promise<number> {
    if (legacyClassIds.length === 0) return 0
    const { data, error } = await this.db
      .from('class_students')
      .delete()
      .in('class_id', legacyClassIds)
      .eq('student_id', legacyStudentId)
      .select('id')
    if (error) throw new Error(`removeLegacyClassRosterMembership: ${error.message}`)
    return data?.length ?? 0
  }

  // ── Phase 1C: institutional learner -> legacy compatibility student ────────
  // See lib/core/assignmentLearnerBridge.ts for the full rationale. Reuses
  // the same `students.external_id` bridge column IDENTITY-1 Phase 1-3
  // already made canonical (via lib/core/identity.ts::resolveLegacyStudentId
  // for reads) — this is a second, independent WRITE path for the Assignment
  // domain, deliberately not routed through lib/core/academicBridge.ts's own
  // `insertLegacyStudent`, matching the same boundary Phase 1B already drew
  // for the class side.

  /**
   * Creates the compatibility `students` row for a Core learner, scoped to
   * `schoolId` (the one write-path difference from academicBridge.ts's own
   * `insertLegacyStudent`, which never sets `school_id` — see module header
   * for why that's a deliberate, additive improvement, not a correction of
   * existing rows). Throws {@link BridgeAlreadyClaimedError} — never a bare
   * `Error` — when a concurrent caller wins the same `uq_students_external_id_bridge`
   * race; the caller recovers by re-reading via `resolveLegacyStudentId`.
   */
  async insertAssignmentCompatibilityStudent(input: {
    name: string
    grade: number
    level: string
    schoolId: string
    externalId: string
    upi?: string | null
  }): Promise<{ id: string }> {
    const { data, error } = await this.db
      .from('students')
      .insert({
        name:            input.name,
        grade:           input.grade,
        level:           input.level,
        curriculum_type: 'cbc',
        added_by:        'system',
        school_id:       input.schoolId,
        external_id:     input.externalId,
        upi:             input.upi ?? null,
      })
      .select('id')
      .single()
    if (error) {
      if (error.code === '23505' && error.message.includes('uq_students_external_id_bridge')) {
        throw new BridgeAlreadyClaimedError(input.externalId)
      }
      throw new Error(`insertAssignmentCompatibilityStudent: ${error.message}`)
    }
    return data
  }

  /** Every `students.id` currently on a compatibility class's roster — used by roster-sync to compute who to remove (present on the legacy roster but no longer in the current Core enrollment). */
  async findClassStudentIds(teacherClassId: string): Promise<string[]> {
    const { data, error } = await this.db
      .from('class_students')
      .select('student_id')
      .eq('class_id', teacherClassId)
    if (error) throw new Error(`findClassStudentIds: ${error.message}`)
    return (data ?? []).map((r) => r.student_id as string)
  }

  /**
   * Removes a specific set of students from one compatibility class's
   * roster. Scoped to exactly one `teacherClassId` and an explicit,
   * caller-resolved student id set (never a bare student_id match across
   * classes) — same safety shape as {@link removeLegacyClassRosterMembership},
   * proven safe by the same precedent (`class_students` has zero downstream
   * foreign keys; every historical academic table references `students.id`
   * directly, never `class_students.id`).
   */
  async removeLegacyClassRosterMembershipForStudents(teacherClassId: string, studentIds: string[]): Promise<number> {
    if (studentIds.length === 0) return 0
    const { data, error } = await this.db
      .from('class_students')
      .delete()
      .eq('class_id', teacherClassId)
      .in('student_id', studentIds)
      .select('id')
    if (error) throw new Error(`removeLegacyClassRosterMembershipForStudents: ${error.message}`)
    return data?.length ?? 0
  }

  /**
   * A single teaching tenure by its own id, with everything
   * `ensureAssignmentCompatibilityClass` needs to authorize and build a
   * compatibility class: the tenure itself (including `ended_at`, unlike
   * {@link listTeachingAssignmentsByUser} which filters it away), and the
   * owning membership's `user_id`/`is_active` (the tenure row alone cannot
   * answer "is this teacher still employed here").
   */
  async findTenureForCompatibilityBridge(classSubjectId: string): Promise<{
    id: string
    schoolId: string
    classId: string
    className: string
    gradeCode: string | null
    academicYearId: string | null
    subjectId: string
    subjectName: string
    teacherMembershipId: string
    membershipUserId: string
    membershipIsActive: boolean
    endedAt: string | null
  } | null> {
    const { data, error } = await this.db
      .from('class_subjects')
      .select(`
        id, school_id, class_id, subject_id, teacher_id, ended_at,
        classes (class_name, display_name, academic_year_id, grades (code)),
        subjects (id, name),
        school_users (user_id, is_active)
      `)
      .eq('id', classSubjectId)
      .maybeSingle()
    if (error) throw new Error(`findTenureForCompatibilityBridge: ${error.message}`)
    if (!data) return null

    type Row = {
      id: string
      school_id: string
      class_id: string
      subject_id: string
      teacher_id: string
      ended_at: string | null
      classes: {
        class_name: string | null
        display_name: string | null
        academic_year_id: string | null
        grades: { code: string } | null
      } | null
      subjects: { id: string; name: string } | null
      school_users: { user_id: string; is_active: boolean } | null
    }
    const row = data as unknown as Row
    if (!row.classes || !row.subjects || !row.school_users) return null

    return {
      id:                  row.id,
      schoolId:            row.school_id,
      classId:             row.class_id,
      className:           row.classes.display_name ?? row.classes.class_name ?? '',
      gradeCode:           row.classes.grades?.code ?? null,
      academicYearId:      row.classes.academic_year_id,
      subjectId:           row.subjects.id,
      subjectName:         row.subjects.name,
      teacherMembershipId: row.teacher_id,
      membershipUserId:    row.school_users.user_id,
      membershipIsActive:  row.school_users.is_active,
      endedAt:             row.ended_at,
    }
  }

  // ── Phase 1B: institutional -> legacy assignment-class compatibility bridge ─
  // See supabase/migrations/20260818120000_assignment_class_subject_bridge.sql
  // and lib/core/assignmentCompatibilityBridge.ts for the full rationale.
  // Deliberately NOT part of the Sprint 9F academicBridge.ts section above —
  // this is a second, independent bridge keyed on the teaching TENURE
  // (class_subjects.id), not on (coreClassId, teacherId).

  /** The existing compatibility class for this teaching tenure, if one has already been created. */
  async findAssignmentCompatibilityBridge(classSubjectId: string): Promise<{ teacherClassId: string } | null> {
    const { data, error } = await this.db
      .from('class_subject_legacy_bridge')
      .select('teacher_class_id')
      .eq('class_subject_id', classSubjectId)
      .maybeSingle()
    if (error) throw new Error(`findAssignmentCompatibilityBridge: ${error.message}`)
    return data ? { teacherClassId: data.teacher_class_id as string } : null
  }

  /**
   * Phase 2 Step 6 — EVERY teaching-tenure compatibility bridge a Core
   * `classId` has ever had (current AND historical `class_subjects` rows),
   * not just the current one `findAssignmentCompatibilityBridge` resolves
   * for a single tenure. A Core class legitimately accumulates more than one
   * compatibility class over time — one per `class_subjects` tenure (Peter's
   * tenure -> bridge A, Mary's replacement tenure -> bridge B) — because
   * Phase 1B never repoints an existing bridge row to a new tenure.
   *
   * Read-only, never creates anything (a `class_subjects` tenure with no
   * bridge row yet — never had an institutional assignment created under
   * it — surfaces with `teacherClassId: null`, not filtered out, so a
   * caller can tell "no institutional assignment history" apart from "not
   * queried"). GET-safe: no call to `ensureAssignmentCompatibilityClass`
   * anywhere in this path.
   */
  async findAssignmentCompatibilityBridgesForClass(classId: string): Promise<Array<{
    classSubjectId: string
    teacherClassId: string | null
    endedAt: string | null
  }>> {
    const { data, error } = await this.db
      .from('class_subjects')
      .select('id, ended_at, class_subject_legacy_bridge (teacher_class_id)')
      .eq('class_id', classId)
    if (error) throw new Error(`findAssignmentCompatibilityBridgesForClass: ${error.message}`)
    type Row = { id: string; ended_at: string | null; class_subject_legacy_bridge: { teacher_class_id: string } | { teacher_class_id: string }[] | null }
    return ((data ?? []) as unknown as Row[]).map(row => {
      const bridge = Array.isArray(row.class_subject_legacy_bridge)
        ? row.class_subject_legacy_bridge[0] ?? null
        : row.class_subject_legacy_bridge
      return {
        classSubjectId: row.id,
        teacherClassId: bridge?.teacher_class_id ?? null,
        endedAt: row.ended_at,
      }
    })
  }

  /**
   * Creates the compatibility `teacher_classes` row for a teaching tenure.
   * Institution-linked (unlike a genuine Solo Teacher class): `school_id` is
   * always set, `external_id` is deliberately left NULL — this bridge never
   * writes or reads `teacher_classes.external_id`, which belongs entirely to
   * the separate, unrelated `academicBridge.ts` mechanism.
   */
  /**
   * Throws {@link AssignmentBridgeAlreadyClaimedError} — never a bare
   * `Error` — when a concurrent caller for the SAME tenure already claimed
   * `class_code` (deterministic per `classSubjectId`, see
   * `deterministicClassCode`) first. This is the other half of Step 6's
   * race safety alongside {@link insertAssignmentCompatibilityBridge}: the
   * bridge-table unique constraint alone is not enough, because two
   * concurrent callers both pass the "no existing bridge yet" check and
   * both then attempt to INSERT a `teacher_classes` row before either gets
   * to the bridge insert — `teacher_classes_class_code_key` is what
   * actually rejects the loser here, one insert earlier than the bridge
   * table's own constraint would.
   */
  async insertAssignmentCompatibilityTeacherClass(input: {
    classSubjectId: string
    teacherId: string
    schoolId: string
    name: string
    grade: number
    subject: string
    academicYear: string
    classCode: string
  }): Promise<{ id: string }> {
    const { data, error } = await this.db
      .from('teacher_classes')
      .insert({
        teacher_id:    input.teacherId,
        school_id:     input.schoolId,
        name:          input.name,
        grade:         input.grade,
        subject:       input.subject,
        academic_year: input.academicYear,
        class_code:    input.classCode,
      })
      .select('id')
      .single()
    if (error) {
      if (error.code === '23505' && error.message.includes('teacher_classes_class_code_key')) {
        throw new AssignmentBridgeAlreadyClaimedError(input.classSubjectId)
      }
      throw new Error(`insertAssignmentCompatibilityTeacherClass: ${error.message}`)
    }
    return data
  }

  /**
   * Claims the bridge row linking a teaching tenure to its compatibility
   * class. Throws {@link AssignmentBridgeAlreadyClaimedError} — never a bare
   * `Error` — when `class_subject_legacy_bridge`'s
   * `UNIQUE (class_subject_id)` constraint rejects a concurrent duplicate;
   * the caller recovers by re-reading via {@link findAssignmentCompatibilityBridge}.
   */
  async insertAssignmentCompatibilityBridge(input: {
    classSubjectId: string
    teacherClassId: string
  }): Promise<{ id: string; teacherClassId: string }> {
    const { data, error } = await this.db
      .from('class_subject_legacy_bridge')
      .insert({ class_subject_id: input.classSubjectId, teacher_class_id: input.teacherClassId })
      .select('id, teacher_class_id')
      .single()
    if (error) {
      if (error.code === '23505' && error.message.includes('class_subject_legacy_bridge_class_subject_id_key')) {
        throw new AssignmentBridgeAlreadyClaimedError(input.classSubjectId)
      }
      throw new Error(`insertAssignmentCompatibilityBridge: ${error.message}`)
    }
    return { id: data.id as string, teacherClassId: data.teacher_class_id as string }
  }
}
