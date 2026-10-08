// lib/paperIntelligence/auth.ts
//
// One ownership resolver for every Paper Intelligence route that acts on a
// teacher's own assignment (scheme extraction, rubric persist). It reuses the
// shared requireAuthentication + resolveTeacher primitives and the exact
// assignments.teacher_id check mark/route.ts already performs — this is the
// assignment-authoring owner (who created the assignment), never a check that
// gates a learner's evidence (those routes use requireClassTeacher on the
// submission's class_id instead). Centralised here so the three routes do not
// each re-spell the same resolution.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'

export class AssignmentOwnershipError extends Error {}

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
