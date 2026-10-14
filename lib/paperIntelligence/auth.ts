// lib/paperIntelligence/auth.ts
//
// Two resolvers. requireOwnedAssignment: the routes that act on a teacher's
// own assignment (scheme extraction, rubric persist). requireScriptAccess /
// requireAssignmentClassTeacher: the routes that act on a LEARNER's script —
// those gate on "does this teacher currently teach this learner's class"
// (requireClassTeacher on the submission's class_id), never on who created
// the assignment (CLAUDE.md: teacher_id is "who entered this", not access).
//
// requireOwnedAssignment reuses the shared requireAuthentication +
// resolveTeacher primitives and the exact assignments.teacher_id check
// mark/route.ts already performs — the assignment-authoring owner, never a
// check that gates a learner's evidence. Centralised here so the routes do not
// each re-spell the same resolution.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { requireAuthentication, requireClassTeacher } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { ResourceOwnershipError } from '@/lib/core/errors'

export class AssignmentOwnershipError extends Error {}
/** The submission does not exist, or belongs to a different assignment — indistinguishable on purpose. */
export class SubmissionNotFoundError extends Error {}
/** The caller does not currently teach the class this script belongs to. */
export class ScriptAccessError extends Error {}

export type OwnedAssignment = {
  /** teachers.id — the identity open_response_rubrics.created_by points to. */
  teacherId: string
  /** auth.users.id — needed where an ingestion/evidence FK expects it. */
  teacherUserId: string
  assignment: {
    id: string
    class_id: string | null
    subject: string | null
    max_score: number | null
  }
}

/**
 * Throws UnauthorizedError (no session) or AssignmentOwnershipError (not a
 * teacher, or the assignment is not this teacher's). Resolves the assignment
 * only after confirming the caller owns it.
 */
export async function requireOwnedAssignment(
  supabase: SupabaseClient,
  assignmentId: string,
): Promise<OwnedAssignment> {
  const user = await requireAuthentication(supabase)
  const teacher = await resolveTeacher(user.id)
  if (!teacher) throw new AssignmentOwnershipError('This account has no teacher record.')

  const db = createServiceClient()
  const { data: assignment } = await db
    .from('assignments')
    .select('id, class_id, subject, max_score')
    .eq('id', assignmentId)
    .eq('teacher_id', teacher.id)
    .maybeSingle()

  if (!assignment) throw new AssignmentOwnershipError('Assignment not found for this teacher.')
  return { teacherId: teacher.id, teacherUserId: user.id, assignment }
}

export type ScriptSubmission = {
  id: string
  assignment_id: string
  class_id: string
  student_id: string
}

export type ScriptAccess = {
  /** auth.users.id — ingestion_runs.initiated_by and evidence review actor. */
  teacherUserId: string
  submission: ScriptSubmission
}

/**
 * Throws UnauthorizedError (no session), SubmissionNotFoundError (unknown
 * submission, or one belonging to another assignment), or ScriptAccessError
 * (not the teacher of the learner's class). Only `submissionId` comes from
 * the client; student and class are read from the submission row itself.
 */
export async function requireScriptAccess(
  supabase: SupabaseClient,
  assignmentId: string,
  submissionId: string,
): Promise<ScriptAccess> {
  const user = await requireAuthentication(supabase)
  const db = createServiceClient()
  const { data: submission } = await db
    .from('assignment_submissions')
    .select('id, assignment_id, class_id, student_id')
    .eq('id', submissionId)
    .maybeSingle()

  if (!submission || submission.assignment_id !== assignmentId) {
    throw new SubmissionNotFoundError('Submission not found for this assignment.')
  }
  try {
    await requireClassTeacher(supabase, submission.class_id, db)
  } catch (err) {
    if (err instanceof ResourceOwnershipError) throw new ScriptAccessError(err.message)
    throw err
  }
  return { teacherUserId: user.id, submission }
}

export type AssignmentClassAccess = {
  teacherUserId: string
  /** teachers.id — the reviewer identity on paper_intelligence_script_marks. */
  teacherId: string
  assignment: { id: string; class_id: string; subject: string | null; title: string | null; max_score: number | null }
}

/** The class-level twin of requireScriptAccess, for reads across a whole class's scripts. */
export async function requireAssignmentClassTeacher(
  supabase: SupabaseClient,
  assignmentId: string,
): Promise<AssignmentClassAccess> {
  const user = await requireAuthentication(supabase)
  const db = createServiceClient()
  const { data: assignment } = await db
    .from('assignments')
    .select('id, class_id, subject, title, max_score')
    .eq('id', assignmentId)
    .maybeSingle()

  if (!assignment?.class_id) throw new AssignmentOwnershipError('Assignment not found.')
  try {
    await requireClassTeacher(supabase, assignment.class_id, db)
  } catch (err) {
    if (err instanceof ResourceOwnershipError) throw new AssignmentOwnershipError('Assignment not found.')
    throw err
  }
  const teacher = await resolveTeacher(user.id)
  if (!teacher) throw new AssignmentOwnershipError('Assignment not found.')
  return { teacherUserId: user.id, teacherId: teacher.id, assignment }
}
