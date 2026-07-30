// lib/assignments/printRoutes.ts
//
// Printable Adaptive Assignments pilot (Adaptive Assignment Domain audit,
// CONDITIONAL GO). Orchestration only — content generation lives in
// lib/assignments/printRouteContent.ts, persistence in
// lib/repositories/assignmentPrintRun.repository.ts, routing decisions
// reuse lib/adaptiveLearning/recommend.ts's existing canonical classifier
// (buildAdaptiveTask/classifyGroup) — no new learner classifier is
// introduced here.
//
// Locked routing rule (never deviate):
//   critical_gap | prerequisite_gap        -> guided
//   concept_confusion                       -> core
//   on_track                                -> extension
//   insufficient_data | no evidence          -> core
//   failed projection lookup                 -> core
// Thin, missing, or uncertain evidence must never default a learner to
// Guided Practice — recommendForClass() itself has no per-learner error
// isolation (a single failed recomputeLearnerProjection() call rejects the
// whole batch), so this module calls the same underlying primitives
// (recomputeLearnerProjection + buildAdaptiveTask) per learner directly,
// wrapped in its own try/catch, rather than recommendForClass() itself.
//
// Every route is a property of ONE print run — never a standing learner
// attribute. Nothing here writes anywhere a route could be read as a
// permanent classification.

import { requireAuthentication, requireClassTeacher } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { ResourceOwnershipError } from '@/lib/core/errors'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { buildAdaptiveTask, type AdaptiveGroupType } from '@/lib/adaptiveLearning/recommend'
import { CurriculumService } from '@/lib/curriculum/service'
import { repos } from '@/lib/repositories'
import type { AssignmentRow } from '@/lib/repositories/assignment.repository'
import type {
  PrintRunRow,
  PrintRouteRow,
  PrintRoute,
  PrintRouteSource,
  PrintEvidenceBand,
  AssignmentSnapshot,
  RouteContent,
} from '@/lib/repositories/assignmentPrintRun.repository'
import { buildRouteBody } from './printRouteContent'
import type { SupabaseClient } from '@supabase/supabase-js'

export const ADAPTATION_VERSION = 'print-routes-v1'

export const ROUTE_LABEL: Record<PrintRoute, string> = {
  guided: 'Guided Practice',
  core: 'Core Practice',
  extension: 'Extension Practice',
}

/** The one, locked mapping from adaptive-learning group to print route. Pure, no I/O — the single place this mapping lives. */
export function mapGroupToRoute(group: AdaptiveGroupType | 'insufficient_data' | null): PrintRoute {
  if (group === 'critical_gap' || group === 'prerequisite_gap') return 'guided'
  if (group === 'on_track') return 'extension'
  // 'concept_confusion', 'insufficient_data', and null (failed lookup) all land here.
  return 'core'
}

type LearnerRouteSuggestion = {
  studentId: string
  studentName: string
  route: PrintRoute
  evidenceBand: PrintEvidenceBand | null
  evidenceNote: string | null
}

/**
 * One learner's route suggestion, with per-learner error isolation — a
 * failed Projection lookup for one learner must never crash the whole
 * class's route generation, and must never default that learner anywhere
 * but Core (the routing rule's explicit "failed projection lookup -> core").
 */
/** Exported for direct unit testing of the "failed projection lookup -> core" resilience (see printRoutes.pure.test.ts) — not otherwise called outside this module. */
export async function suggestRouteForLearner(
  student: { id: string; name: string },
  subject: string,
  curriculumContext: Awaited<ReturnType<typeof CurriculumService.resolveSubstrandContext>> | null,
): Promise<LearnerRouteSuggestion> {
  try {
    const projection = await recomputeLearnerProjection(student.id)
    const task = buildAdaptiveTask(student.id, student.name, subject, projection, { curriculumContext })
    return {
      studentId: student.id,
      studentName: student.name,
      route: mapGroupToRoute(task.groupType),
      evidenceBand: task.groupType,
      evidenceNote: task.observation,
    }
  } catch (err) {
    console.error('[assignments/printRoutes] projection lookup failed for learner', student.id, err instanceof Error ? err.message : String(err))
    return {
      studentId: student.id,
      studentName: student.name,
      route: 'core',
      evidenceBand: null,
      evidenceNote: null,
    }
  }
}

function toAssignmentSnapshot(assignment: AssignmentRow): AssignmentSnapshot {
  return {
    title: assignment.title,
    subject: assignment.subject,
    topic: assignment.topic,
    instructions: assignment.instructions,
    due_date: assignment.due_date,
    max_score: assignment.max_score,
  }
}

function buildRouteContent(snapshot: AssignmentSnapshot): RouteContent {
  return {
    guided: { html: buildRouteBody(snapshot, 'guided') },
    core: { html: buildRouteBody(snapshot, 'core') },
    extension: { html: buildRouteBody(snapshot, 'extension') },
  }
}

async function loadOwnedAssignment(supabase: SupabaseClient, assignmentId: string): Promise<AssignmentRow> {
  const assignment = await repos.assignments.findById(assignmentId)
  if (!assignment) throw new ResourceOwnershipError('Assignment not found.')
  // Canonical class-ownership gate — never re-implemented locally.
  await requireClassTeacher(supabase, assignment.class_id)
  return assignment
}

/**
 * Generates a new DRAFT print run: loads the real assignment content and
 * current roster, suggests a route per learner from live Projection data,
 * builds the three route bodies, and persists everything as one draft run
 * plus one route row per learner. Nothing is approved or printable yet.
 */
export async function generatePrintRun(supabase: SupabaseClient, assignmentId: string): Promise<{ run: PrintRunRow; routes: PrintRouteRow[] }> {
  const user = await requireAuthentication(supabase)
  const teacher = await resolveTeacher(user.id)
  if (!teacher) throw new ResourceOwnershipError('This account has no teacher record.')

  const assignment = await loadOwnedAssignment(supabase, assignmentId)
  const roster = await repos.assignments.listClassRoster(assignment.class_id)

  const curriculumContext = assignment.substrand_id
    ? await CurriculumService.resolveSubstrandContext(assignment.substrand_id)
    : null

  const suggestions = await Promise.all(
    roster.map(student => suggestRouteForLearner(student, assignment.subject, curriculumContext)),
  )

  const snapshot = toAssignmentSnapshot(assignment)
  const content = buildRouteContent(snapshot)

  const run = await repos.assignmentPrintRuns.createDraftRun({
    assignment_id: assignmentId,
    assignment_snapshot: snapshot,
    route_content: content,
    adaptation_version: ADAPTATION_VERSION,
    generated_by: teacher.id,
    supersedes_print_run_id: null,
  })

  await repos.assignmentPrintRuns.insertRouteRows(
    suggestions.map(s => ({
      print_run_id: run.id,
      student_id: s.studentId,
      route: s.route,
      source: 'system_suggested' as PrintRouteSource,
      evidence_band: s.evidenceBand,
      evidence_note: s.evidenceNote,
    })),
  )

  const routes = await repos.assignmentPrintRuns.listRoutesForRun(run.id)
  return { run, routes }
}

/**
 * Regenerates: marks the current run 'superseded' and generates a fresh
 * draft referencing it via `supersedes_print_run_id`. The old run — and
 * anything already approved on it — is never mutated, only its status
 * changes (the one field the DB trigger allows to change post-approval).
 */
export async function regeneratePrintRun(supabase: SupabaseClient, assignmentId: string, previousRunId: string): Promise<{ run: PrintRunRow; routes: PrintRouteRow[] }> {
  const user = await requireAuthentication(supabase)
  const teacher = await resolveTeacher(user.id)
  if (!teacher) throw new ResourceOwnershipError('This account has no teacher record.')

  const assignment = await loadOwnedAssignment(supabase, assignmentId)
  const previous = await repos.assignmentPrintRuns.findRunById(previousRunId)
  if (!previous || previous.assignment_id !== assignmentId) throw new ResourceOwnershipError('Print run not found for this assignment.')

  const roster = await repos.assignments.listClassRoster(assignment.class_id)
  const curriculumContext = assignment.substrand_id
    ? await CurriculumService.resolveSubstrandContext(assignment.substrand_id)
    : null
  const suggestions = await Promise.all(
    roster.map(student => suggestRouteForLearner(student, assignment.subject, curriculumContext)),
  )
  const snapshot = toAssignmentSnapshot(assignment)
  const content = buildRouteContent(snapshot)

  const run = await repos.assignmentPrintRuns.createDraftRun({
    assignment_id: assignmentId,
    assignment_snapshot: snapshot,
    route_content: content,
    adaptation_version: ADAPTATION_VERSION,
    generated_by: teacher.id,
    supersedes_print_run_id: previousRunId,
  })
  await repos.assignmentPrintRuns.insertRouteRows(
    suggestions.map(s => ({
      print_run_id: run.id,
      student_id: s.studentId,
      route: s.route,
      source: 'system_suggested' as PrintRouteSource,
      evidence_band: s.evidenceBand,
      evidence_note: s.evidenceNote,
    })),
  )
  await repos.assignmentPrintRuns.supersedeRun(previousRunId)

  const routes = await repos.assignmentPrintRuns.listRoutesForRun(run.id)
  return { run, routes }
}

/** Teacher edits one route's printable HTML content on a still-draft run. Fails at the DB if the run is already approved. */
export async function editRouteContent(supabase: SupabaseClient, assignmentId: string, printRunId: string, route: PrintRoute, html: string): Promise<PrintRunRow> {
  await loadOwnedAssignment(supabase, assignmentId)
  const run = await repos.assignmentPrintRuns.findRunById(printRunId)
  if (!run || run.assignment_id !== assignmentId) throw new ResourceOwnershipError('Print run not found for this assignment.')
  if (run.status !== 'draft') throw new Error('Only a draft print run may be edited — regenerate a new one instead.')

  const updatedContent: RouteContent = { ...run.route_content, [route]: { html } }
  return repos.assignmentPrintRuns.updateDraftRunContent(printRunId, updatedContent)
}

/** Teacher overrides one learner's suggested route before approval. */
export async function overrideLearnerRoute(supabase: SupabaseClient, assignmentId: string, printRunId: string, studentId: string, route: PrintRoute): Promise<PrintRouteRow> {
  await loadOwnedAssignment(supabase, assignmentId)
  const run = await repos.assignmentPrintRuns.findRunById(printRunId)
  if (!run || run.assignment_id !== assignmentId) throw new ResourceOwnershipError('Print run not found for this assignment.')
  if (run.status !== 'draft') throw new Error('Only a draft print run\'s routing may be overridden — regenerate a new one instead.')

  const existing = (await repos.assignmentPrintRuns.listRoutesForRun(printRunId)).find(r => r.student_id === studentId)
  return repos.assignmentPrintRuns.upsertRouteOverride({
    print_run_id: printRunId,
    student_id: studentId,
    route,
    source: 'teacher_override',
    evidence_band: existing?.evidence_band ?? null,
    evidence_note: existing?.evidence_note ?? null,
  })
}

/** Explicit teacher approval — the only action that makes a print run printable. No automatic/time-based path exists anywhere in this module. */
export async function approvePrintRun(supabase: SupabaseClient, assignmentId: string, printRunId: string): Promise<PrintRunRow> {
  const user = await requireAuthentication(supabase)
  const teacher = await resolveTeacher(user.id)
  if (!teacher) throw new ResourceOwnershipError('This account has no teacher record.')

  await loadOwnedAssignment(supabase, assignmentId)
  const run = await repos.assignmentPrintRuns.findRunById(printRunId)
  if (!run || run.assignment_id !== assignmentId) throw new ResourceOwnershipError('Print run not found for this assignment.')
  if (run.status !== 'draft') throw new Error('Only a draft print run may be approved.')

  return repos.assignmentPrintRuns.approveRun(printRunId, teacher.id)
}
