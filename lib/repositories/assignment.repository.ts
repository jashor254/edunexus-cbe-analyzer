// lib/repositories/assignment.repository.ts
//
// Owns writes to `assignments` and the submission-fan-out rows it creates in
// `assignment_submissions` at creation time. Extracted in Phase 2A
// (docs/architecture/assignment-creation-service-phase2a.md) from inline
// logic in app/api/teacher/assignments/route.ts — no business logic here
// (no authorization, no adaptive/quiz derivation), that lives in
// lib/assignments/create.ts. This repository only knows how to read and
// write rows.
//
// `blueprint_action_item_id` (Phase 2B, docs/architecture/
// blueprint-assignment-delivery-phase2b.md) is trusted provenance metadata,
// never a client-controlled field — see lib/assignments/create.ts's
// `CreateAssignmentCommand` for the boundary that keeps it that way.

import { ConflictError } from '@/lib/core/errors'
import { BaseRepository } from './base'

export type AssignmentRow = {
  id: string
  class_id: string
  teacher_id: string
  title: string
  subject: string
  topic: string
  substrand_id: string | null
  instructions: string
  due_date: string
  type: string
  max_score: number | null
  is_quiz: boolean
  is_adaptive: boolean
  is_compass_guided: boolean | null
  is_holiday_assignment: boolean | null
  holiday_period: string | null
  lesson_plan_id: string | null
  blueprint_action_item_id: string | null
  status: string
  created_at: string
  updated_at: string | null
}

export type InsertAssignmentInput = {
  class_id: string
  teacher_id: string
  title: string
  subject: string
  topic: string
  substrand_id: string | null
  instructions: string
  due_date: string
  type: string
  max_score: number
  is_quiz: boolean
  is_adaptive: boolean
  is_compass_guided: boolean
  is_holiday_assignment: boolean
  holiday_period: string | null
  lesson_plan_id: string | null
  /** Server-derived only — see module header. `null`/omitted for every ordinary-route assignment. */
  blueprint_action_item_id: string | null
  status: string
}

export type InsertAssignmentSubmissionInput = {
  assignment_id: string
  student_id: string
  class_id: string
  status: string
}

const ASSIGNMENT_COLS =
  'id, class_id, teacher_id, title, subject, topic, substrand_id, instructions, due_date, type, max_score, is_quiz, is_adaptive, is_compass_guided, is_holiday_assignment, holiday_period, lesson_plan_id, blueprint_action_item_id, status, created_at, updated_at'

export class AssignmentRepository extends BaseRepository {
  /**
   * Throws {@link ConflictError} (not a generic `Error`) on a
   * `blueprint_action_item_id` uniqueness violation (Postgres `23505` against
   * `uq_assignments_blueprint_action_item_id`) — the concurrent-delivery race
   * the Phase 2B delivery adapter's idempotency contract depends on the DB
   * to resolve deterministically. Never fires for an ordinary (`null`
   * provenance) assignment, since the backing index is partial.
   */
  async createAssignmentRecord(input: InsertAssignmentInput): Promise<AssignmentRow> {
    const { data, error } = await this.db
      .from('assignments')
      .insert(input)
      .select(ASSIGNMENT_COLS)
      .single()
    if (error) {
      if (error.code === '23505') throw new ConflictError(`createAssignmentRecord: duplicate blueprint_action_item_id (${error.message})`)
      throw new Error(`createAssignmentRecord: ${error.message}`)
    }
    return data as unknown as AssignmentRow
  }

  /** One assignment by id, full canonical content — Printable Adaptive Assignments pilot loads this before any ownership check, then re-verifies ownership via requireClassTeacher(assignment.class_id) itself; this method performs no authorization. */
  async findById(assignmentId: string): Promise<AssignmentRow | null> {
    const { data, error } = await this.db
      .from('assignments')
      .select(ASSIGNMENT_COLS)
      .eq('id', assignmentId)
      .maybeSingle()
    if (error) throw new Error(`findById: ${error.message}`)
    return data as unknown as AssignmentRow | null
  }

  /** The assignment already delivered from this Blueprint action item, if any — the natural-key idempotency lookup Phase 2B uses instead of title/date matching. */
  async findByBlueprintActionItemId(actionItemId: string): Promise<AssignmentRow | null> {
    const { data, error } = await this.db
      .from('assignments')
      .select(ASSIGNMENT_COLS)
      .eq('blueprint_action_item_id', actionItemId)
      .maybeSingle()
    if (error) throw new Error(`findAssignmentByBlueprintActionItemId: ${error.message}`)
    return data as unknown as AssignmentRow | null
  }

  /** Every current `student_id` on the roster of `classId` — the set that receives a pending submission row at assignment-creation time. */
  async listClassStudentIds(classId: string): Promise<string[]> {
    const { data, error } = await this.db
      .from('class_students')
      .select('student_id')
      .eq('class_id', classId)
    if (error) throw new Error(`listClassStudentIds: ${error.message}`)
    return (data ?? []).map(row => row.student_id as string)
  }

  /** Current roster of `classId` with display names — Printable Adaptive Assignments pilot needs both id and name (id for Projection lookup, name for the teacher routing sheet and per-copy content). */
  async listClassRoster(classId: string): Promise<Array<{ id: string; name: string }>> {
    const { data, error } = await this.db
      .from('class_students')
      .select('students(id, name)')
      .eq('class_id', classId)
    if (error) throw new Error(`listClassRoster: ${error.message}`)
    return (data ?? [])
      .map(row => row.students as unknown as { id: string; name: string } | null)
      .filter((s): s is { id: string; name: string } => !!s)
  }

  /** No-ops on an empty array — callers do not need to branch on roster size before calling. */
  async createAssignmentSubmissions(rows: InsertAssignmentSubmissionInput[]): Promise<void> {
    if (rows.length === 0) return
    const { error } = await this.db.from('assignment_submissions').insert(rows)
    if (error) throw new Error(`createAssignmentSubmissions: ${error.message}`)
  }

  /**
   * Read-only submission-status counts for one assignment — Phase 2D's
   * Teacher Review needs "how far along is this assignment," never a full
   * gradebook matrix (that's `lib/gradebook/gradebook.ts`, which is
   * class-scoped and needs `teacherId`, not what a single-assignment,
   * single-action-item review has on hand). Never called from anything
   * that writes `assignment_submissions` — a pure count.
   */
  async getSubmissionSummary(assignmentId: string): Promise<{
    total: number
    pending: number
    submitted: number
    marked: number
    averageScore: number | null
  }> {
    const { data, error } = await this.db
      .from('assignment_submissions')
      .select('status, score')
      .eq('assignment_id', assignmentId)
    if (error) throw new Error(`getSubmissionSummary: ${error.message}`)
    const rows = (data ?? []) as Array<{ status: string; score: number | null }>
    const scored = rows.filter(r => typeof r.score === 'number') as Array<{ status: string; score: number }>
    return {
      total: rows.length,
      pending: rows.filter(r => r.status === 'pending').length,
      submitted: rows.filter(r => r.status === 'submitted').length,
      marked: rows.filter(r => r.status === 'marked').length,
      averageScore: scored.length > 0 ? scored.reduce((sum, r) => sum + r.score, 0) / scored.length : null,
    }
  }

  /**
   * The most recent submission-side activity timestamp for one assignment
   * (max of every `submitted_at`/`marked_at` across its submissions) — Phase
   * 2E's Teacher Review Workspace needs this to detect "new activity since
   * the last review," which the `assignments` row's own `updated_at` does
   * NOT reflect (marking a submission never touches the parent assignment
   * row). A separate, narrow read from `getSubmissionSummary` on purpose —
   * that method's return type is spread directly into
   * `AssignmentReviewSnapshot` (review.ts), so adding a timestamp field
   * there would leak into a type that doesn't declare it.
   */
  async getLatestSubmissionActivityAt(assignmentId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('assignment_submissions')
      .select('submitted_at, marked_at')
      .eq('assignment_id', assignmentId)
    if (error) throw new Error(`getLatestSubmissionActivityAt: ${error.message}`)
    const rows = (data ?? []) as Array<{ submitted_at: string | null; marked_at: string | null }>
    return rows.reduce<string | null>((latest, r) => {
      for (const ts of [r.submitted_at, r.marked_at]) {
        if (ts && (!latest || ts > latest)) latest = ts
      }
      return latest
    }, null)
  }

  /**
   * Phase 2 — Institutional Learner Portal Discovery, Step 8/11/12.
   *
   * The recipient-materialization signal `fanOutPendingSubmissions` (above)
   * already creates at assignment-creation time: one `assignment_submissions`
   * row per student who was on the class roster AT THAT MOMENT. This is a
   * strictly more precise and more durable eligibility signal than
   * `class_students` membership (which is a mutable, roster-synced-on-demand
   * table — see lib/core/assignmentLearnerBridge.ts's roster-sync comments)
   * for the institutional discovery path specifically, because it:
   *   - naturally EXCLUDES an assignment created before a learner joined the
   *     class (they were never fanned into it — no submission row exists);
   *   - naturally INCLUDES an assignment created while enrolled even after
   *     the learner later transfers out (their submission row is never
   *     deleted — `syncAssignmentCompatibilityRoster` only reconciles
   *     `class_students`, never touches `assignment_submissions`);
   *   - naturally EXCLUDES any assignment created after a learner has left
   *     the class (roster sync removes them from `class_students` before the
   *     next fan-out runs, so they are not in the new fan-out set).
   *   - survives teacher replacement transparently: a departed teacher's
   *     compatibility class keeps its own historical submission rows; a
   *     replacement teacher's new compatibility class (Phase 1B: a NEW
   *     tenure gets its OWN bridge row) produces its own new submission rows
   *     for the same student — both surface here via a single `student_id`
   *     join, with no need to enumerate which compatibility class or which
   *     teaching tenure produced which assignment.
   *
   * Filtered to `assignments.status = 'active'`, mirroring the legacy
   * app/api/student/assignments/route.ts filter exactly (Step 20 — no new
   * status model introduced). One query, `!inner` join so the status filter
   * applies to the embedded resource — no N+1 regardless of how many
   * assignments or students are involved (Step 21).
   */
  async findSubmissionsWithAssignmentsForStudents(studentIds: string[]): Promise<Array<{
    id: string
    assignment_id: string
    student_id: string
    status: string
    score: number | null
    submitted_at: string | null
    marked_at: string | null
    assignments: {
      id: string
      class_id: string
      title: string
      topic: string
      instructions: string
      type: string
      is_compass_guided: boolean | null
      is_quiz: boolean
      max_score: number | null
      due_date: string
      status: string
      created_at: string
      teacher_classes: { name: string | null; grade: number | null; subject: string | null } | null
      teachers: { full_name: string | null } | null
    }
  }>> {
    if (studentIds.length === 0) return []
    const { data, error } = await this.db
      .from('assignment_submissions')
      .select(`
        id, assignment_id, student_id, status, score, submitted_at, marked_at,
        assignments!inner (
          id, class_id, title, topic, instructions, type, is_compass_guided, is_quiz,
          max_score, due_date, status, created_at,
          teacher_classes (name, grade, subject),
          teachers (full_name)
        )
      `)
      .in('student_id', studentIds)
      .eq('assignments.status', 'active')
      .order('due_date', { referencedTable: 'assignments', ascending: true })
    if (error) throw new Error(`findSubmissionsWithAssignmentsForStudents: ${error.message}`)
    return (data ?? []) as unknown as Array<{
      id: string
      assignment_id: string
      student_id: string
      status: string
      score: number | null
      submitted_at: string | null
      marked_at: string | null
      assignments: {
        id: string
        class_id: string
        title: string
        topic: string
        instructions: string
        type: string
        is_compass_guided: boolean | null
        is_quiz: boolean
        max_score: number | null
        due_date: string
        status: string
        created_at: string
        teacher_classes: { name: string | null; grade: number | null; subject: string | null } | null
        teachers: { full_name: string | null } | null
      }
    }>
  }

  /**
   * A single submission row (if any) belonging to one of `studentIds`
   * against one specific `assignmentId` — the per-assignment READ-
   * authorization check Phase 2 Step 23/24 needs (does ANY of this
   * identity's current compatibility students have a materialized
   * recipient relationship with this exact assignment), distinct from
   * {@link findSubmissionsWithAssignmentsForStudents}'s list-projection use.
   * Batched over `studentIds` (never one query per id) even though that set
   * is normally 1-2 rows (dual-active enrollment, Step 17).
   */
  async findSubmissionForStudentsAndAssignment(studentIds: string[], assignmentId: string): Promise<{ id: string; student_id: string } | null> {
    if (studentIds.length === 0) return null
    const { data, error } = await this.db
      .from('assignment_submissions')
      .select('id, student_id')
      .in('student_id', studentIds)
      .eq('assignment_id', assignmentId)
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`findSubmissionForStudentsAndAssignment: ${error.message}`)
    return data
  }

  /**
   * PHASE 3 — read-only content projection for the learner-facing assignment
   * PDF. Deliberately its own narrow select (never ASSIGNMENT_COLS, which
   * carries no school/teacher context) — only the fields Step 2's PDF
   * semantics call for, joined once, no per-field follow-up query. This
   * method performs no authorization; callers must already hold a proven
   * read-access grant (resolveInstitutionalAssignmentReadAccess for
   * institutional learners, the legacy self/parent check otherwise) before
   * calling it.
   */
  async findPdfContext(assignmentId: string): Promise<{
    id: string
    class_id: string
    title: string
    subject: string
    topic: string
    instructions: string
    due_date: string
    type: string
    is_quiz: boolean
    max_score: number | null
    updated_at: string | null
    teacher_classes: { name: string | null; grade: number | null; subject: string | null; school_id: string | null } | null
    teachers: { full_name: string | null } | null
  } | null> {
    const { data, error } = await this.db
      .from('assignments')
      .select(`
        id, class_id, title, subject, topic, instructions, due_date, type, is_quiz, max_score, updated_at,
        teacher_classes (name, grade, subject, school_id),
        teachers (full_name)
      `)
      .eq('id', assignmentId)
      .maybeSingle()
    if (error) return null
    return data as unknown as {
      id: string
      class_id: string
      title: string
      subject: string
      topic: string
      instructions: string
      due_date: string
      type: string
      is_quiz: boolean
      max_score: number | null
      updated_at: string | null
      teacher_classes: { name: string | null; grade: number | null; subject: string | null; school_id: string | null } | null
      teachers: { full_name: string | null } | null
    } | null
  }

  /** School display name for the PDF header — best-effort, never authorization-relevant. */
  async findSchoolName(schoolId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('schools')
      .select('school_name')
      .eq('id', schoolId)
      .maybeSingle()
    if (error) throw new Error(`findSchoolName: ${error.message}`)
    return data?.school_name ?? null
  }
}
