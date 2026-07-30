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
}
