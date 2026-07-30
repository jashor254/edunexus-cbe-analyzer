// lib/repositories/assignmentPrintRun.repository.ts
//
// Owns reads/writes for `assignment_print_runs`/`assignment_print_routes`
// (Printable Adaptive Assignments pilot — Adaptive Assignment Domain audit,
// CONDITIONAL GO). No authorization, no route-mapping logic, no content
// generation here — that lives in lib/assignments/printRoutes.ts. This
// repository only knows how to read and write rows, matching
// assignment.repository.ts's own discipline.
//
// Approved-run immutability is enforced by a database trigger
// (supabase/migrations/20260729120000_assignment_print_routes.sql), not
// application code — this repository does not attempt to re-check that
// itself; an update against an approved row simply fails at the DB.

import { BaseRepository } from './base'

export type PrintRunStatus = 'draft' | 'approved' | 'superseded'
export type PrintRoute = 'guided' | 'core' | 'extension'
export type PrintRouteSource = 'system_suggested' | 'teacher_override'
export type PrintEvidenceBand = 'critical_gap' | 'prerequisite_gap' | 'concept_confusion' | 'on_track' | 'insufficient_data'

export type AssignmentSnapshot = {
  title: string
  subject: string
  topic: string
  instructions: string
  due_date: string
  max_score: number | null
}

export type RouteContent = {
  guided: { html: string }
  core: { html: string }
  extension: { html: string }
}

export type PrintRunRow = {
  id: string
  assignment_id: string
  status: PrintRunStatus
  assignment_snapshot: AssignmentSnapshot
  route_content: RouteContent
  adaptation_version: string
  generated_at: string
  generated_by: string
  approved_at: string | null
  approved_by: string | null
  supersedes_print_run_id: string | null
  created_at: string
  updated_at: string
}

export type PrintRouteRow = {
  id: string
  print_run_id: string
  student_id: string
  route: PrintRoute
  source: PrintRouteSource
  evidence_band: PrintEvidenceBand | null
  evidence_note: string | null
  created_at: string
}

export type InsertPrintRunInput = {
  assignment_id: string
  assignment_snapshot: AssignmentSnapshot
  route_content: RouteContent
  adaptation_version: string
  generated_by: string
  supersedes_print_run_id: string | null
}

export type InsertPrintRouteInput = {
  print_run_id: string
  student_id: string
  route: PrintRoute
  source: PrintRouteSource
  evidence_band: PrintEvidenceBand | null
  evidence_note: string | null
}

const RUN_COLS = 'id, assignment_id, status, assignment_snapshot, route_content, adaptation_version, generated_at, generated_by, approved_at, approved_by, supersedes_print_run_id, created_at, updated_at'
const ROUTE_COLS = 'id, print_run_id, student_id, route, source, evidence_band, evidence_note, created_at'

export class AssignmentPrintRunRepository extends BaseRepository {
  async createDraftRun(input: InsertPrintRunInput): Promise<PrintRunRow> {
    const { data, error } = await this.db
      .from('assignment_print_runs')
      .insert({ ...input, status: 'draft' })
      .select(RUN_COLS)
      .single()
    if (error) throw new Error(`createDraftRun: ${error.message}`)
    return data as unknown as PrintRunRow
  }

  async findRunById(printRunId: string): Promise<PrintRunRow | null> {
    const { data, error } = await this.db
      .from('assignment_print_runs')
      .select(RUN_COLS)
      .eq('id', printRunId)
      .maybeSingle()
    if (error) throw new Error(`findRunById: ${error.message}`)
    return data as unknown as PrintRunRow | null
  }

  /** Every print run for one assignment, newest first — for the teacher review UI's history/regeneration list. */
  async listRunsForAssignment(assignmentId: string): Promise<PrintRunRow[]> {
    const { data, error } = await this.db
      .from('assignment_print_runs')
      .select(RUN_COLS)
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`listRunsForAssignment: ${error.message}`)
    return (data ?? []) as unknown as PrintRunRow[]
  }

  /**
   * Overwrites a draft run's content (teacher edits before approval). Fails
   * at the DB (trigger) if the run is already approved — never checked
   * here, the caller (lib/assignments/printRoutes.ts) is expected to have
   * already confirmed draft status for a clear error message, but the
   * trigger is the real guarantee.
   */
  async updateDraftRunContent(printRunId: string, routeContent: RouteContent): Promise<PrintRunRow> {
    const { data, error } = await this.db
      .from('assignment_print_runs')
      .update({ route_content: routeContent, updated_at: new Date().toISOString() })
      .eq('id', printRunId)
      .select(RUN_COLS)
      .single()
    if (error) throw new Error(`updateDraftRunContent: ${error.message}`)
    return data as unknown as PrintRunRow
  }

  async approveRun(printRunId: string, approvedBy: string): Promise<PrintRunRow> {
    const { data, error } = await this.db
      .from('assignment_print_runs')
      .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: approvedBy })
      .eq('id', printRunId)
      .select(RUN_COLS)
      .single()
    if (error) throw new Error(`approveRun: ${error.message}`)
    return data as unknown as PrintRunRow
  }

  async supersedeRun(printRunId: string): Promise<void> {
    const { error } = await this.db
      .from('assignment_print_runs')
      .update({ status: 'superseded' })
      .eq('id', printRunId)
    if (error) throw new Error(`supersedeRun: ${error.message}`)
  }

  async insertRouteRows(rows: InsertPrintRouteInput[]): Promise<void> {
    if (rows.length === 0) return
    const { error } = await this.db.from('assignment_print_routes').insert(rows)
    if (error) throw new Error(`insertRouteRows: ${error.message}`)
  }

  async listRoutesForRun(printRunId: string): Promise<PrintRouteRow[]> {
    const { data, error } = await this.db
      .from('assignment_print_routes')
      .select(ROUTE_COLS)
      .eq('print_run_id', printRunId)
    if (error) throw new Error(`listRoutesForRun: ${error.message}`)
    return (data ?? []) as unknown as PrintRouteRow[]
  }

  /** Teacher override of one learner's route within a still-draft run — upsert on the (print_run_id, student_id) unique constraint. */
  async upsertRouteOverride(input: InsertPrintRouteInput): Promise<PrintRouteRow> {
    const { data, error } = await this.db
      .from('assignment_print_routes')
      .upsert(input, { onConflict: 'print_run_id,student_id' })
      .select(ROUTE_COLS)
      .single()
    if (error) throw new Error(`upsertRouteOverride: ${error.message}`)
    return data as unknown as PrintRouteRow
  }
}
